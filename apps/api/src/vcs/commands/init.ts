import { promises as fs } from "node:fs";
import { logger } from "../../lib/logger";
import { findRepo, repoPathsFor } from "../paths";
import { DEFAULT_BRANCH, setHeadToBranch } from "../refs";

export async function initRepo(): Promise<void> {
  const existing = await findRepo();

  if (existing) {
    logger.warn(`A Cairn repository already exists at ${existing.repoPath}`);
    return;
  }

  const repo = repoPathsFor(process.cwd());

  await fs.mkdir(repo.objectsPath, { recursive: true });
  await fs.mkdir(repo.headsPath, { recursive: true });

  // HEAD points at a branch that does not exist yet — exactly what git calls an
  // unborn branch. The first commit creates it.
  await setHeadToBranch(repo, DEFAULT_BRANCH);

  await fs.writeFile(
    repo.configPath,
    `${JSON.stringify({ bucket: process.env.S3_BUCKET ?? null }, null, 2)}\n`
  );

  logger.info(
    `Initialised empty Cairn repository in ${repo.repoPath} on branch ${DEFAULT_BRANCH}`
  );
}
