import { promises as fs } from "node:fs";
import path from "node:path";
import { logger } from "../../lib/logger";
import { readCommit } from "../commits";
import { expandHash } from "../objects";
import { requireRepo } from "../paths";
import {
  readBranch,
  resolveHead,
  setHeadDetached,
  setHeadToBranch,
} from "../refs";
import { writeIndex } from "../stage";
import { materialiseTree, readTreeFlat } from "../trees";
import { computeStatus, isClean } from "../status";

/**
 * Switches to a branch or commit, replacing the working tree with its content.
 *
 * Refuses to run with uncommitted changes. Overwriting work that exists in no
 * commit would destroy it irrecoverably, and no version control tool should do
 * that without being asked twice — hence `--force`.
 */
export async function checkoutRepo(
  target: string,
  options: { force?: boolean } = {}
): Promise<void> {
  try {
    const repo = await requireRepo();

    const status = await computeStatus(repo);
    if (!isClean(status) && !options.force) {
      logger.error(
        "You have uncommitted changes. Commit them, or re-run with --force to discard them."
      );
      process.exitCode = 1;
      return;
    }

    const branchCommit = await readBranch(repo, target);
    const isBranch = branchCommit !== null;

    let commitHash: string;
    try {
      commitHash = isBranch ? branchCommit : await expandHash(repo, target);
    } catch (err) {
      logger.error(
        `"${target}" is not a branch or a known commit: ${(err as Error).message}`
      );
      process.exitCode = 1;
      return;
    }

    const previous = await resolveHead(repo);
    const commit = await readCommit(repo, commitHash);
    const nextFiles = await readTreeFlat(repo, commit.tree);

    // Remove files the old commit had and the new one does not, so switching
    // branches does not leave stragglers behind.
    if (previous) {
      const previousFiles = await readTreeFlat(
        repo,
        (await readCommit(repo, previous)).tree
      );

      for (const file of Object.keys(previousFiles)) {
        if (nextFiles[file] === undefined) {
          await fs.rm(path.join(repo.workTree, ...file.split("/")), {
            force: true,
          });
        }
      }
    }

    await materialiseTree(repo, commit.tree);

    // The index now matches the checked-out tree: a fresh checkout is clean.
    await writeIndex(repo, nextFiles);

    if (isBranch) {
      await setHeadToBranch(repo, target);
      logger.info(`Switched to branch ${target} (${commitHash.slice(0, 8)}).`);
    } else {
      await setHeadDetached(repo, commitHash);
      logger.warn(
        `HEAD is now detached at ${commitHash.slice(0, 8)}. ` +
          `Commits made here belong to no branch — create one with "cairn branch <name>" to keep them.`
      );
    }
  } catch (err) {
    logger.error({ err }, "Unable to check out");
    process.exitCode = 1;
  }
}
