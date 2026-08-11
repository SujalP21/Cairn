import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getRepoPaths } from "../config/repoPaths";
import { logger } from "../lib/logger";

export async function commitRepo(message: string): Promise<void> {
  const { stagingPath, commitsPath } = getRepoPaths();

  try {
    const commitID = randomUUID();
    const commitDir = path.join(commitsPath, commitID);
    await fs.mkdir(commitDir, { recursive: true });

    const files = await fs.readdir(stagingPath);

    if (files.length === 0) {
      logger.warn("Nothing to commit: the staging area is empty.");
      return;
    }

    for (const file of files) {
      await fs.copyFile(
        path.join(stagingPath, file),
        path.join(commitDir, file)
      );
    }

    await fs.writeFile(
      path.join(commitDir, "commit.json"),
      JSON.stringify({ message, date: new Date().toISOString() })
    );

    logger.info(`Commit ${commitID} created with message: ${message}`);
  } catch (err) {
    logger.error({ err }, "Error committing files");
    process.exitCode = 1;
  }
}
