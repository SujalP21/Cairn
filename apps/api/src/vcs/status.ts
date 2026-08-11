import { readCommit } from "./commits";
import type { RepoPaths } from "./paths";
import { readHead, resolveHead } from "./refs";
import { readIndex } from "./stage";
import { readTreeFlat } from "./trees";
import { hashWorkTreeFile, listWorkTreeFiles } from "./worktree";

/*
 * The three-way comparison every version control system rests on:
 *
 *   HEAD commit  ──▶  index (staged)  ──▶  working tree
 *
 * "Staged" is the difference between HEAD and the index. "Not staged" is the
 * difference between the index and what is actually on disk.
 */

export interface Status {
  branch: string | null;
  detached: boolean;
  head: string | null;
  staged: { added: string[]; modified: string[]; deleted: string[] };
  notStaged: { modified: string[]; deleted: string[] };
  untracked: string[];
}

export async function computeStatus(repo: RepoPaths): Promise<Status> {
  const head = await readHead(repo);
  const headCommit = await resolveHead(repo);

  const committed = headCommit
    ? await readTreeFlat(repo, (await readCommit(repo, headCommit)).tree)
    : {};

  const index = await readIndex(repo);
  const workFiles = await listWorkTreeFiles(repo);

  const staged: Status["staged"] = { added: [], modified: [], deleted: [] };
  const notStaged: Status["notStaged"] = { modified: [], deleted: [] };
  const untracked: string[] = [];

  // index vs HEAD
  for (const [filePath, hash] of Object.entries(index)) {
    const previous = committed[filePath];

    if (previous === undefined) staged.added.push(filePath);
    else if (previous !== hash) staged.modified.push(filePath);
  }

  for (const filePath of Object.keys(committed)) {
    if (index[filePath] === undefined) staged.deleted.push(filePath);
  }

  // working tree vs index
  for (const [filePath, hash] of Object.entries(index)) {
    if (!workFiles.includes(filePath)) {
      notStaged.deleted.push(filePath);
      continue;
    }

    if ((await hashWorkTreeFile(repo, filePath)) !== hash) {
      notStaged.modified.push(filePath);
    }
  }

  for (const filePath of workFiles) {
    if (index[filePath] === undefined) untracked.push(filePath);
  }

  return {
    branch: head.type === "branch" ? head.branch : null,
    detached: head.type === "detached",
    head: headCommit,
    staged,
    notStaged,
    untracked: untracked.sort(),
  };
}

export function isClean(status: Status): boolean {
  return (
    status.staged.added.length === 0 &&
    status.staged.modified.length === 0 &&
    status.staged.deleted.length === 0 &&
    status.notStaged.modified.length === 0 &&
    status.notStaged.deleted.length === 0
  );
}
