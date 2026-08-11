import { promises as fs } from "node:fs";
import path from "node:path";

// Name of the on-disk directory holding a Cairn repository, analogous to `.git`.
export const REPO_DIR_NAME = ".cairn";

export interface RepoPaths {
  /** Directory the repository is rooted at — the parent of `.cairn`. */
  workTree: string;
  repoPath: string;
  objectsPath: string;
  refsPath: string;
  headsPath: string;
  headPath: string;
  indexPath: string;
  configPath: string;
}

export function repoPathsFor(workTree: string): RepoPaths {
  const repoPath = path.join(workTree, REPO_DIR_NAME);

  return {
    workTree,
    repoPath,
    objectsPath: path.join(repoPath, "objects"),
    refsPath: path.join(repoPath, "refs"),
    headsPath: path.join(repoPath, "refs", "heads"),
    headPath: path.join(repoPath, "HEAD"),
    indexPath: path.join(repoPath, "index"),
    configPath: path.join(repoPath, "config.json"),
  };
}

/**
 * Walks up from `startDir` looking for a `.cairn` directory, so commands work
 * from anywhere inside a repository rather than only at its root.
 */
export async function findRepo(
  startDir: string = process.cwd()
): Promise<RepoPaths | null> {
  let current = path.resolve(startDir);

  for (;;) {
    const candidate = path.join(current, REPO_DIR_NAME);

    try {
      const stats = await fs.stat(candidate);
      if (stats.isDirectory()) return repoPathsFor(current);
    } catch {
      // Not here; keep climbing.
    }

    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

/** Same as findRepo but throws the message a user should see. */
export async function requireRepo(
  startDir: string = process.cwd()
): Promise<RepoPaths> {
  const repo = await findRepo(startDir);

  if (!repo) {
    throw new Error(
      `Not a Cairn repository (or any parent directory). Run \`cairn init\` first.`
    );
  }

  return repo;
}

/** Repository-relative, forward-slash path — the form used inside tree objects. */
export function toRepoRelative(repo: RepoPaths, absolutePath: string): string {
  return path
    .relative(repo.workTree, path.resolve(absolutePath))
    .split(path.sep)
    .join("/");
}
