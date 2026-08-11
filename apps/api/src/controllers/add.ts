import { promises as fs } from "node:fs";
import path from "node:path";
import { getRepoPaths } from "../config/repoPaths";
import { logger } from "../lib/logger";

export async function addRepo(filePath: string): Promise<void> {
  const { stagingPath } = getRepoPaths();

  try {
    await fs.mkdir(stagingPath, { recursive: true });
    const fileName = path.basename(filePath);
    await fs.copyFile(filePath, path.join(stagingPath, fileName));
    logger.info(`File ${fileName} added to the staging area!`);
  } catch (err) {
    logger.error({ err }, "Error adding file");
    process.exitCode = 1;
  }
}
