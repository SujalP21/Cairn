import { promises as fs } from "node:fs";
import path from "node:path";
import { readTyped, writeObject } from "./objects";
import type { RepoPaths } from "./paths";

/*
 * Tree objects.
 *
 * A tree is a directory: a sorted list of `<type> <hash> <name>` lines naming
 * blobs and subtrees. A commit points at one tree, which is the entire snapshot
 * of the project at that moment.
 *
 * Entries are sorted by name so that identical directory content always
 * serialises to identical bytes, and therefore hashes to the same id. Without
 * that, two commits of unchanged content would produce different trees and the
 * deduplication would silently stop working.
 */

export interface TreeEntry {
  type: "blob" | "tree";
  hash: string;
  name: string;
}

export function serializeTree(entries: TreeEntry[]): Buffer {
  const sorted = [...entries].sort((a, b) => (a.name < b.name ? -1 : 1));

  return Buffer.from(
    sorted.map((e) => `${e.type} ${e.hash} ${e.name}`).join("\n") +
      (sorted.length > 0 ? "\n" : ""),
    "utf8"
  );
}

export function parseTree(content: Buffer): TreeEntry[] {
  return content
    .toString("utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      // Split only twice: a filename may legitimately contain spaces.
      const firstSpace = line.indexOf(" ");
      const secondSpace = line.indexOf(" ", firstSpace + 1);

      const type = line.slice(0, firstSpace);
      if (type !== "blob" && type !== "tree") {
        throw new Error(`Corrupt tree entry: "${line}"`);
      }

      return {
        type,
        hash: line.slice(firstSpace + 1, secondSpace),
        name: line.slice(secondSpace + 1),
      };
    });
}

export async function readTree(
  repo: RepoPaths,
  hash: string
): Promise<TreeEntry[]> {
  return parseTree(await readTyped(repo, hash, "tree"));
}

/**
 * Builds nested tree objects from a flat `path -> blob hash` map and returns
 * the root tree's hash.
 */
export async function buildTree(
  repo: RepoPaths,
  files: Record<string, string>
): Promise<string> {
  interface Node {
    files: Record<string, string>;
    dirs: Record<string, Node>;
  }

  const root: Node = { files: {}, dirs: {} };

  for (const [filePath, hash] of Object.entries(files)) {
    const segments = filePath.split("/");
    let node = root;

    for (const segment of segments.slice(0, -1)) {
      node.dirs[segment] ??= { files: {}, dirs: {} };
      node = node.dirs[segment]!;
    }

    node.files[segments[segments.length - 1]!] = hash;
  }

  const write = async (node: Node): Promise<string> => {
    const entries: TreeEntry[] = Object.entries(node.files).map(
      ([name, hash]) => ({ type: "blob" as const, hash, name })
    );

    for (const [name, child] of Object.entries(node.dirs)) {
      entries.push({ type: "tree", hash: await write(child), name });
    }

    return writeObject(repo, "tree", serializeTree(entries));
  };

  return write(root);
}

/** Flattens a tree back into `path -> blob hash`, recursing into subtrees. */
export async function readTreeFlat(
  repo: RepoPaths,
  treeHash: string,
  prefix = ""
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};

  for (const entry of await readTree(repo, treeHash)) {
    const full = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.type === "blob") {
      files[full] = entry.hash;
    } else {
      Object.assign(files, await readTreeFlat(repo, entry.hash, full));
    }
  }

  return files;
}

/** Writes a tree's contents into the working directory. */
export async function materialiseTree(
  repo: RepoPaths,
  treeHash: string
): Promise<string[]> {
  const files = await readTreeFlat(repo, treeHash);
  const written: string[] = [];

  for (const [relative, hash] of Object.entries(files)) {
    const target = path.join(repo.workTree, ...relative.split("/"));

    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, await readTyped(repo, hash, "blob"));
    written.push(relative);
  }

  return written;
}
