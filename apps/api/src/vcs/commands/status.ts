import { logger } from "../../lib/logger";
import { requireRepo } from "../paths";
import { computeStatus, isClean } from "../status";

export async function statusRepo(): Promise<void> {
  try {
    const repo = await requireRepo();
    const status = await computeStatus(repo);

    const lines: string[] = [];

    lines.push(
      status.detached
        ? `HEAD detached at ${status.head?.slice(0, 8) ?? "?"}`
        : `On branch ${status.branch ?? "?"}`
    );

    if (!status.head) lines.push("No commits yet.");
    lines.push("");

    const section = (title: string, hint: string, files: string[]) => {
      if (files.length === 0) return;

      lines.push(`${title}`, `  (${hint})`, "");
      for (const file of files) lines.push(`      ${file}`);
      lines.push("");
    };

    section("Changes to be committed:", "these will go into the next commit", [
      ...status.staged.added.map((f) => `new file:  ${f}`),
      ...status.staged.modified.map((f) => `modified:  ${f}`),
      ...status.staged.deleted.map((f) => `deleted:   ${f}`),
    ]);

    section(
      "Changes not staged for commit:",
      'run "cairn add <file>" to include them',
      [
        ...status.notStaged.modified.map((f) => `modified:  ${f}`),
        ...status.notStaged.deleted.map((f) => `deleted:   ${f}`),
      ]
    );

    section(
      "Untracked files:",
      'run "cairn add <file>" to track them',
      status.untracked
    );

    if (isClean(status) && status.untracked.length === 0) {
      lines.push("Nothing to commit — working tree clean.");
    }

    logger.info(lines.join("\n"));
  } catch (err) {
    logger.error({ err }, "Unable to read status");
    process.exitCode = 1;
  }
}
