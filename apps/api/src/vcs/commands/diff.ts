import { logger } from "../../lib/logger";
import { readCommit } from "../commits";
import { diffLines, looksBinary, splitLines, toHunks } from "../diff";
import { readTyped } from "../objects";
import { requireRepo } from "../paths";
import { resolveHead } from "../refs";
import { readIndex } from "../stage";
import { readTreeFlat } from "../trees";
import { listWorkTreeFiles, readWorkTreeFile } from "../worktree";

/**
 * Shows what changed between the last commit and the working tree.
 *
 * `--staged` compares HEAD against the index instead, which is what will
 * actually be committed.
 */
export async function diffRepo(staged = false): Promise<void> {
  try {
    const repo = await requireRepo();
    const head = await resolveHead(repo);

    const committed = head
      ? await readTreeFlat(repo, (await readCommit(repo, head)).tree)
      : {};

    const index = await readIndex(repo);

    // Content on the right-hand side of the comparison.
    const rightHand = async (file: string): Promise<Buffer | null> => {
      if (staged) {
        const hash = index[file];
        return hash ? readTyped(repo, hash, "blob") : null;
      }

      return readWorkTreeFile(repo, file);
    };

    const candidates = staged
      ? new Set([...Object.keys(committed), ...Object.keys(index)])
      : new Set([
          ...Object.keys(committed),
          ...Object.keys(index),
          ...(await listWorkTreeFiles(repo)).filter(
            (file) => committed[file] !== undefined || index[file] !== undefined
          ),
        ]);

    const output: string[] = [];

    for (const file of [...candidates].sort()) {
      const beforeHash = committed[file];
      const before = beforeHash
        ? await readTyped(repo, beforeHash, "blob")
        : null;
      const after = await rightHand(file);

      if (before === null && after === null) continue;
      if (before && after && before.equals(after)) continue;

      output.push(`--- ${before ? `a/${file}` : "/dev/null"}`);
      output.push(`+++ ${after ? `b/${file}` : "/dev/null"}`);

      if ((before && looksBinary(before)) || (after && looksBinary(after))) {
        output.push("Binary files differ");
        output.push("");
        continue;
      }

      const hunks = toHunks(
        diffLines(splitLines(before ?? ""), splitLines(after ?? ""))
      );

      for (const hunk of hunks) {
        const firstOld = hunk.find((line) => line.oldLine !== undefined);
        const firstNew = hunk.find((line) => line.newLine !== undefined);

        output.push(
          `@@ -${firstOld?.oldLine ?? 0} +${firstNew?.newLine ?? 0} @@`
        );

        for (const line of hunk) {
          const marker =
            line.op === "add" ? "+" : line.op === "remove" ? "-" : " ";
          output.push(`${marker}${line.text}`);
        }
      }

      output.push("");
    }

    logger.info(
      output.length === 0
        ? staged
          ? "No staged changes."
          : "No changes."
        : `\n${output.join("\n")}`
    );
  } catch (err) {
    logger.error({ err }, "Unable to diff");
    process.exitCode = 1;
  }
}
