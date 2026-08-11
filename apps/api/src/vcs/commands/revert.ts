import { logger } from "../../lib/logger";
import { readCommit } from "../commits";
import { expandHash } from "../objects";
import { requireRepo } from "../paths";
import { computeStatus, isClean } from "../status";
import { materialiseTree } from "../trees";

/**
 * Restores the working tree to a commit's content without moving HEAD.
 *
 * Distinct from `checkout`: history stays where it is, so the restored files
 * show up as uncommitted changes you can inspect and then commit or discard.
 */
export async function revertRepo(
  commitID: string,
  options: { force?: boolean } = {}
): Promise<void> {
  try {
    const repo = await requireRepo();

    const status = await computeStatus(repo);
    if (!isClean(status) && !options.force) {
      logger.error(
        "You have uncommitted changes that this would overwrite. " +
          "Commit them, or re-run with --force to discard them."
      );
      process.exitCode = 1;
      return;
    }

    let hash: string;
    try {
      hash = await expandHash(repo, commitID);
    } catch (err) {
      logger.error((err as Error).message);
      process.exitCode = 1;
      return;
    }

    const commit = await readCommit(repo, hash);
    const restored = await materialiseTree(repo, commit.tree);

    logger.info(
      `Restored ${restored.length} file(s) from ${hash.slice(0, 8)} ` +
        `("${commit.message.split("\n")[0] ?? ""}"). HEAD is unchanged — ` +
        `these are now uncommitted changes.`
    );
  } catch (err) {
    logger.error({ err }, "Unable to restore");
    process.exitCode = 1;
  }
}
