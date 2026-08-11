import path from "node:path";

// Name of the on-disk directory holding a Cairn repository, analogous to `.git`.
export const REPO_DIR_NAME = ".cairn";

export interface RepoPaths {
  repoPath: string;
  stagingPath: string;
  commitsPath: string;
  configPath: string;
}

// Resolves the standard paths of the Cairn repository rooted at `cwd`.
export function getRepoPaths(cwd: string = process.cwd()): RepoPaths {
  const repoPath = path.resolve(cwd, REPO_DIR_NAME);

  return {
    repoPath,
    stagingPath: path.join(repoPath, "staging"),
    commitsPath: path.join(repoPath, "commits"),
    configPath: path.join(repoPath, "config.json"),
  };
}
