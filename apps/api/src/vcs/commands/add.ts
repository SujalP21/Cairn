import { promises as fs } from "node:fs";
import path from "node:path";
import { logger } from "../../lib/logger";
import { writeObject } from "../objects";
import { requireRepo, toRepoRelative } from "../paths";
import { readIndex, writeIndex } from "../stage";
import { listWorkTreeFiles } from "../worktree";

/**
 * Stages a file or directory.
 *
 * Content goes into the object store immediately and the index records the
 * resulting hash. Because objects are content-addressed, staging a file whose
 * content already exists costs nothing beyond the hash.
 */
export async function addRepo(target: string): Promise<void> {
  try {
    const repo = await requireRepo();
    const absolute = path.resolve(process.cwd(), target);

    let stats;
    try {
      stats = await fs.stat(absolute);
    } catch {
      logger.error(`Nothing matched "${target}".`);
      process.exitCode = 1;
      return;
    }

    const relativePaths = stats.isDirectory()
      ? await listWorkTreeFiles(repo, absolute)
      : [toRepoRelative(repo, absolute)];

    if (relativePaths.some((p) => p.startsWith(".."))) {
      logger.error("Cannot add paths outside the repository.");
      process.exitCode = 1;
      return;
    }

    if (relativePaths.length === 0) {
      logger.warn(`No files to add under "${target}".`);
      return;
    }

    const index = await readIndex(repo);
    let staged = 0;

    for (const relative of relativePaths) {
      const content = await fs.readFile(
        path.join(repo.workTree, ...relative.split("/"))
      );
      const hash = await writeObject(repo, "blob", content);

      if (index[relative] !== hash) staged += 1;
      index[relative] = hash;
    }

    await writeIndex(repo, index);

    logger.info(
      staged === 0
        ? `Nothing to update — ${relativePaths.length} file(s) already staged.`
        : `Staged ${staged} file(s).`
    );
  } catch (err) {
    logger.error({ err }, "Error adding file");
    process.exitCode = 1;
  }
}
