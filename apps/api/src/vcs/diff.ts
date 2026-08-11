/*
 * Line diff via longest common subsequence.
 *
 * The LCS of two files is the largest set of lines that appear in both, in
 * order; everything outside it is an insertion or a deletion. This is the same
 * idea git uses, without the Myers optimisation — the table is O(n*m), which is
 * fine for source files and is guarded below for anything pathological.
 */

export type DiffOp = "context" | "add" | "remove";

export interface DiffLine {
  op: DiffOp;
  text: string;
  /** 1-based line number in the old file, if the line exists there. */
  oldLine?: number;
  /** 1-based line number in the new file, if the line exists there. */
  newLine?: number;
}

/** Beyond this the quadratic table costs more memory than the result is worth. */
const MAX_LINES = 5000;

export function diffLines(before: string[], after: string[]): DiffLine[] {
  if (before.length > MAX_LINES || after.length > MAX_LINES) {
    return [
      { op: "remove", text: `<${before.length} lines>` },
      { op: "add", text: `<${after.length} lines>` },
    ];
  }

  // lengths[i][j] = length of the LCS of before[i..] and after[j..]
  const lengths: number[][] = Array.from({ length: before.length + 1 }, () =>
    new Array<number>(after.length + 1).fill(0)
  );

  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      lengths[i]![j] =
        before[i] === after[j]
          ? lengths[i + 1]![j + 1]! + 1
          : Math.max(lengths[i + 1]![j]!, lengths[i]![j + 1]!);
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;

  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) {
      result.push({
        op: "context",
        text: before[i]!,
        oldLine: i + 1,
        newLine: j + 1,
      });
      i += 1;
      j += 1;
    } else if (lengths[i + 1]![j]! >= lengths[i]![j + 1]!) {
      result.push({ op: "remove", text: before[i]!, oldLine: i + 1 });
      i += 1;
    } else {
      result.push({ op: "add", text: after[j]!, newLine: j + 1 });
      j += 1;
    }
  }

  while (i < before.length) {
    result.push({ op: "remove", text: before[i]!, oldLine: i + 1 });
    i += 1;
  }

  while (j < after.length) {
    result.push({ op: "add", text: after[j]!, newLine: j + 1 });
    j += 1;
  }

  return result;
}

export function splitLines(content: Buffer | string): string[] {
  const text = typeof content === "string" ? content : content.toString("utf8");

  if (text === "") return [];

  // A trailing newline terminates the last line rather than starting an empty one.
  return text.replace(/\n$/, "").split("\n");
}

/** Heuristic binary check: a NUL byte in the first 8 KB. */
export function looksBinary(content: Buffer): boolean {
  return content.subarray(0, 8000).includes(0);
}

/**
 * Groups changes into unified-diff hunks with surrounding context, so output
 * shows the few lines that changed rather than the whole file.
 */
export function toHunks(lines: DiffLine[], context = 3): DiffLine[][] {
  const changed = lines
    .map((line, index) => (line.op === "context" ? -1 : index))
    .filter((index) => index !== -1);

  if (changed.length === 0) return [];

  const hunks: DiffLine[][] = [];
  let start = Math.max(0, changed[0]! - context);
  let end = Math.min(lines.length - 1, changed[0]! + context);

  for (const index of changed.slice(1)) {
    if (index - context <= end + 1) {
      end = Math.min(lines.length - 1, index + context);
    } else {
      hunks.push(lines.slice(start, end + 1));
      start = Math.max(0, index - context);
      end = Math.min(lines.length - 1, index + context);
    }
  }

  hunks.push(lines.slice(start, end + 1));
  return hunks;
}
