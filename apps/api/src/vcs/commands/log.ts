import { logger } from "../../lib/logger";
import { walkHistory } from "../commits";
import { requireRepo } from "../paths";
import { readHead, resolveHead } from "../refs";

export async function logRepo(limit = 20): Promise<void> {
  try {
    const repo = await requireRepo();
    const head = await resolveHead(repo);

    if (!head) {
      logger.info("No commits yet.");
      return;
    }

    const current = await readHead(repo);
    const label =
      current.type === "branch" ? `branch ${current.branch}` : "detached HEAD";

    const lines: string[] = [`History for ${label}:`, ""];

    for await (const commit of walkHistory(repo, head, limit)) {
      const when = new Date(commit.timestamp).toLocaleString();
      const subject = commit.message.split("\n")[0] ?? "";

      lines.push(`  ${commit.hash.slice(0, 8)}  ${subject}`);
      lines.push(
        `            ${commit.author} · ${when}` +
          (commit.parents.length > 1
            ? `  (merge of ${commit.parents.length})`
            : "")
      );
      lines.push("");
    }

    logger.info(lines.join("\n"));
  } catch (err) {
    logger.error({ err }, "Unable to read history");
    process.exitCode = 1;
  }
}
