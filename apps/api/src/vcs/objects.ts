import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { RepoPaths } from "./paths";

/*
 * Content-addressable object store.
 *
 * Every object is identified by the SHA-256 of its framed bytes, so identical
 * content always produces the same id and is therefore stored exactly once.
 * That is what makes committing the same file twice cost nothing, where the
 * previous copy-everything design paid full price each time.
 *
 * Objects are immutable. Nothing in this module ever overwrites one.
 */

export type ObjectType = "blob" | "tree" | "commit";

export interface CairnObject {
  type: ObjectType;
  content: Buffer;
}

/**
 * Frames content as `<type> <byteLength>\0<content>` before hashing, the same
 * shape git uses. Without the type in the digest a blob and a tree with
 * identical bytes would collide.
 */
function frame(type: ObjectType, content: Buffer): Buffer {
  return Buffer.concat([Buffer.from(`${type} ${content.length}\0`), content]);
}

export function hashObject(type: ObjectType, content: Buffer): string {
  return createHash("sha256").update(frame(type, content)).digest("hex");
}

function objectPath(repo: RepoPaths, hash: string): string {
  // Sharded by the first two characters: a flat directory with tens of
  // thousands of entries is slow to list on most filesystems.
  return path.join(repo.objectsPath, hash.slice(0, 2), hash.slice(2));
}

/**
 * Writes an object and returns its hash.
 *
 * Already-present objects are left untouched — that is the deduplication. The
 * write goes to a temporary file and is renamed into place so a crash can
 * never leave a truncated object under a hash that claims to describe it.
 */
export async function writeObject(
  repo: RepoPaths,
  type: ObjectType,
  content: Buffer
): Promise<string> {
  const hash = hashObject(type, content);
  const target = objectPath(repo, hash);

  try {
    await fs.access(target);
    return hash;
  } catch {
    // Not stored yet.
  }

  await fs.mkdir(path.dirname(target), { recursive: true });

  const temp = `${target}.${process.pid}.tmp`;
  await fs.writeFile(temp, frame(type, content));
  await fs.rename(temp, target);

  return hash;
}

export async function objectExists(
  repo: RepoPaths,
  hash: string
): Promise<boolean> {
  try {
    await fs.access(objectPath(repo, hash));
    return true;
  } catch {
    return false;
  }
}

export async function readObject(
  repo: RepoPaths,
  hash: string
): Promise<CairnObject> {
  let raw: Buffer;

  try {
    raw = await fs.readFile(objectPath(repo, hash));
  } catch {
    throw new Error(`Object ${hash} not found.`);
  }

  const separator = raw.indexOf(0);
  if (separator === -1) {
    throw new Error(`Object ${hash} is corrupt: no header terminator.`);
  }

  const header = raw.subarray(0, separator).toString("utf8");
  const content = raw.subarray(separator + 1);
  const [type, size] = header.split(" ");

  if (type !== "blob" && type !== "tree" && type !== "commit") {
    throw new Error(`Object ${hash} has unknown type "${type ?? ""}".`);
  }

  if (Number(size) !== content.length) {
    throw new Error(
      `Object ${hash} is corrupt: header says ${size ?? "?"} bytes, found ${content.length}.`
    );
  }

  return { type, content };
}

export async function readTyped(
  repo: RepoPaths,
  hash: string,
  expected: ObjectType
): Promise<Buffer> {
  const object = await readObject(repo, hash);

  if (object.type !== expected) {
    throw new Error(
      `Expected ${hash} to be a ${expected}, found ${object.type}.`
    );
  }

  return object.content;
}

/** Lists every stored object id. Used by `push` to work out what to upload. */
export async function listObjects(repo: RepoPaths): Promise<string[]> {
  const hashes: string[] = [];

  let shards: string[];
  try {
    shards = await fs.readdir(repo.objectsPath);
  } catch {
    return hashes;
  }

  for (const shard of shards) {
    const entries = await fs.readdir(path.join(repo.objectsPath, shard));

    for (const entry of entries) {
      if (entry.endsWith(".tmp")) continue;
      hashes.push(`${shard}${entry}`);
    }
  }

  return hashes;
}

/**
 * Resolves a unique object-id prefix to the full id, so users can type the
 * first few characters of a hash the way they can with git.
 */
export async function expandHash(
  repo: RepoPaths,
  prefix: string
): Promise<string> {
  if (prefix.length === 64 && (await objectExists(repo, prefix))) {
    return prefix;
  }

  if (prefix.length < 4) {
    throw new Error(`Object id "${prefix}" is too short to be unambiguous.`);
  }

  const matches = (await listObjects(repo)).filter((hash) =>
    hash.startsWith(prefix)
  );

  if (matches.length === 0) throw new Error(`No object matches "${prefix}".`);
  if (matches.length > 1) {
    throw new Error(
      `"${prefix}" is ambiguous — ${matches.length} objects share that prefix.`
    );
  }

  return matches[0]!;
}
