import { logger } from "../../lib/logger";
import { isAncestor, readCommit } from "../commits";
import { requireRepo } from "../paths";
import { advanceHead, readBranch, resolveHead } from "../refs";
import { writeIndex } from "../stage";
import { computeStatus, isClean } from "../status";
import { materialiseTree, readTreeFlat } from "../trees";

/**
 * Fast-forward merge only.
 *
 * When the current branch is an ancestor of the one being merged, "merging" is
 * just moving the ref forward — no new commit, no content to reconcile.
 *
 * When the histories have genuinely diverged this refuses. A three-way content
 * merge is a substantial algorithm and getting it subtly wrong silently
 * corrupts files, which is far worse than declining to try.
 */
export async function mergeRepo(branchName: string): Promise<void> {
  try {
    const repo = await requireRepo();

    const status = await computeStatus(repo);
    if (!isClean(status)) {
      logger.error("You have uncommitted changes. Commit them before merging.");
      process.exitCode = 1;
      return;
    }

    const target = await readBranch(repo, branchName);
    if (!target) {
      logger.error(`Branch "${branchName}" does not exist.`);
      process.exitCode = 1;
      return;
    }

    const current = await resolveHead(repo);
    if (!current) {
      logger.error("Nothing to merge into — there are no commits yet.");
      process.exitCode = 1;
      return;
    }

    if (current === target) {
      logger.info("Already up to date.");
      return;
    }

    if (await isAncestor(repo, target, current)) {
      logger.info(`Already up to date — ${branchName} is behind.`);
      return;
    }

    if (!(await isAncestor(repo, current, target))) {
      logger.error(
        `Histories have diverged. Cairn only performs fast-forward merges, ` +
          `so this needs a three-way merge it cannot do. ` +
          `Rebase the work manually, or check out ${branchName} directly.`
      );
      process.exitCode = 1;
      return;
    }

    const commit = await readCommit(repo, target);
    await materialiseTree(repo, commit.tree);
    await writeIndex(repo, await readTreeFlat(repo, commit.tree));
    await advanceHead(repo, target);

    logger.info(
      `Fast-forwarded to ${target.slice(0, 8)} (${commit.message.split("\n")[0] ?? ""}).`
    );
  } catch (err) {
    logger.error({ err }, "Unable to merge");
    process.exitCode = 1;
  }
}
