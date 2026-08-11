import { logger } from "../../lib/logger";
import { requireRepo } from "../paths";
import {
  deleteBranch,
  listBranches,
  readBranch,
  readHead,
  resolveHead,
  writeBranch,
} from "../refs";

export async function branchRepo(
  name?: string,
  options: { delete?: boolean } = {}
): Promise<void> {
  try {
    const repo = await requireRepo();
    const head = await readHead(repo);

    if (!name) {
      const branches = await listBranches(repo);

      if (branches.length === 0) {
        logger.info("No branches yet — the first commit creates one.");
        return;
      }

      const lines = branches.map((branch) => {
        const marker =
          head.type === "branch" && head.branch === branch ? "*" : " ";
        return `  ${marker} ${branch}`;
      });

      logger.info(`\n${lines.join("\n")}`);
      return;
    }

    if (options.delete) {
      if (head.type === "branch" && head.branch === name) {
        logger.error(`Cannot delete "${name}" — it is the current branch.`);
        process.exitCode = 1;
        return;
      }

      if ((await readBranch(repo, name)) === null) {
        logger.error(`Branch "${name}" does not exist.`);
        process.exitCode = 1;
        return;
      }

      await deleteBranch(repo, name);
      logger.info(`Deleted branch ${name}.`);
      return;
    }

    if ((await readBranch(repo, name)) !== null) {
      logger.error(`Branch "${name}" already exists.`);
      process.exitCode = 1;
      return;
    }

    const commit = await resolveHead(repo);

    if (!commit) {
      logger.error("Cannot create a branch before the first commit.");
      process.exitCode = 1;
      return;
    }

    // Creating a branch writes one file containing a commit id. That is all a
    // branch is, which is why it is instant regardless of repository size.
    await writeBranch(repo, name, commit);
    logger.info(`Created branch ${name} at ${commit.slice(0, 8)}.`);
  } catch (err) {
    logger.error({ err }, "Unable to manage branches");
    process.exitCode = 1;
  }
}
