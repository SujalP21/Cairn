import { logger } from "../../lib/logger";
import { authorName, readCommit, writeCommit } from "../commits";
import { requireRepo } from "../paths";
import { advanceHead, readHead, resolveHead } from "../refs";
import { readIndex } from "../stage";
import { buildTree } from "../trees";

export async function commitRepo(message: string): Promise<void> {
  try {
    const repo = await requireRepo();
    const index = await readIndex(repo);

    if (Object.keys(index).length === 0) {
      logger.warn("Nothing to commit — the staging area is empty.");
      return;
    }

    const tree = await buildTree(repo, index);
    const parent = await resolveHead(repo);

    // An unchanged tree means an empty commit. Refusing keeps history
    // meaningful rather than filling it with no-ops.
    if (parent) {
      const previous = await readCommit(repo, parent);

      if (previous.tree === tree) {
        logger.warn("Nothing to commit — the tree is identical to HEAD.");
        return;
      }
    }

    const hash = await writeCommit(repo, {
      tree,
      parents: parent ? [parent] : [],
      author: authorName(),
      timestamp: new Date().toISOString(),
      message,
    });

    await advanceHead(repo, hash);

    const head = await readHead(repo);
    const where = head.type === "branch" ? head.branch : "detached HEAD";

    logger.info(`[${where} ${hash.slice(0, 8)}] ${message}`);
  } catch (err) {
    logger.error({ err }, "Error committing files");
    process.exitCode = 1;
  }
}
