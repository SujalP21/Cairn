import { readTyped, writeObject } from "./objects";
import type { RepoPaths } from "./paths";

/*
 * Commit objects.
 *
 * A commit is a tree hash plus zero or more parent hashes. Those parent
 * pointers are what turn a pile of snapshots into a history: `log` walks them,
 * and `merge` uses them to decide whether one commit is an ancestor of another.
 *
 * Serialised as headers, a blank line, then the message — so `cat`ing a raw
 * object is still readable while debugging.
 */

export interface Commit {
  tree: string;
  parents: string[];
  author: string;
  timestamp: string;
  message: string;
}

export interface CommitWithHash extends Commit {
  hash: string;
}

export function serializeCommit(commit: Commit): Buffer {
  const headers = [
    `tree ${commit.tree}`,
    ...commit.parents.map((parent) => `parent ${parent}`),
    `author ${commit.author}`,
    `timestamp ${commit.timestamp}`,
  ];

  return Buffer.from(`${headers.join("\n")}\n\n${commit.message}`, "utf8");
}

export function parseCommit(content: Buffer): Commit {
  const text = content.toString("utf8");
  const split = text.indexOf("\n\n");

  const headerBlock = split === -1 ? text : text.slice(0, split);
  const message = split === -1 ? "" : text.slice(split + 2);

  const commit: Commit = {
    tree: "",
    parents: [],
    author: "",
    timestamp: "",
    message,
  };

  for (const line of headerBlock.split("\n")) {
    const space = line.indexOf(" ");
    const key = line.slice(0, space);
    const value = line.slice(space + 1);

    if (key === "tree") commit.tree = value;
    else if (key === "parent") commit.parents.push(value);
    else if (key === "author") commit.author = value;
    else if (key === "timestamp") commit.timestamp = value;
  }

  return commit;
}

export async function readCommit(
  repo: RepoPaths,
  hash: string
): Promise<Commit> {
  return parseCommit(await readTyped(repo, hash, "commit"));
}

export async function writeCommit(
  repo: RepoPaths,
  commit: Commit
): Promise<string> {
  return writeObject(repo, "commit", serializeCommit(commit));
}

export function authorName(): string {
  return process.env.CAIRN_AUTHOR?.trim() || "unknown";
}

/**
 * Walks history from `start` newest-first.
 *
 * Breadth-first across parents with a seen-set, so a merge commit's two lines
 * of history are both visited and neither is visited twice.
 */
export async function* walkHistory(
  repo: RepoPaths,
  start: string | null,
  limit = Infinity
): AsyncGenerator<CommitWithHash> {
  if (!start) return;

  const queue = [start];
  const seen = new Set<string>();
  let yielded = 0;

  while (queue.length > 0 && yielded < limit) {
    const hash = queue.shift()!;
    if (seen.has(hash)) continue;
    seen.add(hash);

    const commit = await readCommit(repo, hash);
    yield { hash, ...commit };
    yielded += 1;

    queue.push(...commit.parents);
  }
}

/** True when `ancestor` is reachable from `descendant` by following parents. */
export async function isAncestor(
  repo: RepoPaths,
  ancestor: string,
  descendant: string
): Promise<boolean> {
  for await (const commit of walkHistory(repo, descendant)) {
    if (commit.hash === ancestor) return true;
  }

  return false;
}
