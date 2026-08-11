import { promises as fs } from "node:fs";
import path from "node:path";
import type { RepoPaths } from "./paths";

/*
 * The staging index: repository-relative path -> blob hash.
 *
 * Held as sorted JSON rather than git's binary format. Nothing here needs the
 * compactness, and a file a developer can open and read is worth more than a
 * few saved bytes.
 */

export type Index = Record<string, string>;

export async function readIndex(repo: RepoPaths): Promise<Index> {
  try {
    const raw = await fs.readFile(repo.indexPath, "utf8");
    return JSON.parse(raw) as Index;
  } catch {
    return {};
  }
}

export async function writeIndex(repo: RepoPaths, index: Index): Promise<void> {
  // Sorted so the file has a stable diff between commands.
  const sorted = Object.fromEntries(
    Object.entries(index).sort(([a], [b]) => (a < b ? -1 : 1))
  );

  await fs.mkdir(path.dirname(repo.indexPath), { recursive: true });
  await fs.writeFile(repo.indexPath, `${JSON.stringify(sorted, null, 2)}\n`);
}

export async function clearIndex(repo: RepoPaths): Promise<void> {
  await fs.rm(repo.indexPath, { force: true });
}
