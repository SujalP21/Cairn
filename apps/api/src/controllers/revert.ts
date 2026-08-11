import { promises as fs } from "node:fs";
import path from "node:path";
import { getRepoPaths } from "../config/repoPaths";
import { logger } from "../lib/logger";

export async function revertRepo(commitID: string): Promise<void> {
  const { repoPath, commitsPath } = getRepoPaths();

  try {
    const commitDir = path.join(commitsPath, commitID);
    const files = await fs.readdir(commitDir);
    const parentDir = path.resolve(repoPath, "..");

    for (const file of files) {
      // commit.json is the commit's own metadata, not part of the snapshot.
      if (file === "commit.json") continue;

      await fs.copyFile(path.join(commitDir, file), path.join(parentDir, file));
    }

    logger.info(`Commit ${commitID} reverted successfully!`);
  } catch (err) {
    logger.error({ err }, "Unable to revert");
    process.exitCode = 1;
  }
}
