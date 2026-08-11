import { promises as fs } from "node:fs";
import path from "node:path";
import type { RepoPaths } from "./paths";

/*
 * Refs and HEAD.
 *
 * A branch is nothing but a file containing a commit id. HEAD is a file
 * containing either `ref: refs/heads/<name>` (on a branch) or a raw commit id
 * (detached). Committing moves whichever ref HEAD names — that is the entire
 * mechanism, and it is why creating a branch is instant.
 */

export type Head =
  | { type: "branch"; branch: string; commit: string | null }
  | { type: "detached"; commit: string };

export const DEFAULT_BRANCH = "main";

const branchPath = (repo: RepoPaths, name: string) =>
  path.join(repo.headsPath, name);

export async function readBranch(
  repo: RepoPaths,
  name: string
): Promise<string | null> {
  try {
    return (await fs.readFile(branchPath(repo, name), "utf8")).trim();
  } catch {
    return null;
  }
}

export async function writeBranch(
  repo: RepoPaths,
  name: string,
  commit: string
): Promise<void> {
  const target = branchPath(repo, name);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${commit}\n`);
}

export async function deleteBranch(
  repo: RepoPaths,
  name: string
): Promise<void> {
  await fs.rm(branchPath(repo, name), { force: true });
}

export async function listBranches(repo: RepoPaths): Promise<string[]> {
  try {
    return (await fs.readdir(repo.headsPath)).sort();
  } catch {
    return [];
  }
}

export async function readHead(repo: RepoPaths): Promise<Head> {
  const raw = (await fs.readFile(repo.headPath, "utf8")).trim();

  if (raw.startsWith("ref:")) {
    const ref = raw.slice(4).trim();
    const branch = ref.replace(/^refs\/heads\//, "");

    return { type: "branch", branch, commit: await readBranch(repo, branch) };
  }

  return { type: "detached", commit: raw };
}

export async function setHeadToBranch(
  repo: RepoPaths,
  branch: string
): Promise<void> {
  await fs.writeFile(repo.headPath, `ref: refs/heads/${branch}\n`);
}

export async function setHeadDetached(
  repo: RepoPaths,
  commit: string
): Promise<void> {
  await fs.writeFile(repo.headPath, `${commit}\n`);
}

/** The commit HEAD currently points at, or null in a repository with no commits. */
export async function resolveHead(repo: RepoPaths): Promise<string | null> {
  const head = await readHead(repo);
  return head.type === "branch" ? head.commit : head.commit;
}

/**
 * Moves whatever HEAD points at to a new commit — the branch when attached,
 * HEAD itself when detached.
 */
export async function advanceHead(
  repo: RepoPaths,
  commit: string
): Promise<void> {
  const head = await readHead(repo);

  if (head.type === "branch") {
    await writeBranch(repo, head.branch, commit);
  } else {
    await setHeadDetached(repo, commit);
  }
}
