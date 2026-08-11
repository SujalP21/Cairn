import { promises as fs } from "node:fs";
import path from "node:path";
import { hashObject } from "./objects";
import { REPO_DIR_NAME, type RepoPaths } from "./paths";

// Directories never worth walking. `.cairn` itself must be excluded or the
// repository would try to version its own object store.
const ALWAYS_IGNORED = new Set([
  REPO_DIR_NAME,
  ".git",
  "node_modules",
  ".DS_Store",
]);

/** Repository-relative paths of every file in the working tree. */
export async function listWorkTreeFiles(
  repo: RepoPaths,
  startDir: string = repo.workTree
): Promise<string[]> {
  const found: string[] = [];

  const walk = async (dir: string): Promise<void> => {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (ALWAYS_IGNORED.has(entry.name)) continue;

      const absolute = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(absolute);
      } else if (entry.isFile()) {
        found.push(
          path.relative(repo.workTree, absolute).split(path.sep).join("/")
        );
      }
    }
  };

  await walk(startDir);
  return found.sort();
}

/** Hashes a working-tree file without writing it to the object store. */
export async function hashWorkTreeFile(
  repo: RepoPaths,
  relativePath: string
): Promise<string> {
  const content = await fs.readFile(
    path.join(repo.workTree, ...relativePath.split("/"))
  );

  return hashObject("blob", content);
}

export async function readWorkTreeFile(
  repo: RepoPaths,
  relativePath: string
): Promise<Buffer | null> {
  try {
    return await fs.readFile(
      path.join(repo.workTree, ...relativePath.split("/"))
    );
  } catch {
    return null;
  }
}
