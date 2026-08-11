import { promises as fs } from "node:fs";
import { getRepoPaths } from "../config/repoPaths";
import { logger } from "../lib/logger";

export async function initRepo(): Promise<void> {
  const { repoPath, commitsPath, configPath } = getRepoPaths();

  try {
    await fs.mkdir(repoPath, { recursive: true });
    await fs.mkdir(commitsPath, { recursive: true });
    await fs.writeFile(
      configPath,
      JSON.stringify({ bucket: process.env.S3_BUCKET ?? null })
    );
    logger.info("Repository initialised!");
  } catch (err) {
    logger.error({ err }, "Error initialising repository");
    process.exitCode = 1;
  }
}
