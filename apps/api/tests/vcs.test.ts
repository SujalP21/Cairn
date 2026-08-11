import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initRepo } from "../src/controllers/init";
import { addRepo } from "../src/controllers/add";
import { commitRepo } from "../src/controllers/commit";
import { revertRepo } from "../src/controllers/revert";
import { getRepoPaths, REPO_DIR_NAME } from "../src/config/repoPaths";

// The VCS commands operate on process.cwd(), so each test runs inside its own
// temporary directory rather than the repository being developed.
let workdir: string;
let originalCwd: string;

beforeEach(async () => {
  originalCwd = process.cwd();
  workdir = await fs.mkdtemp(path.join(os.tmpdir(), "cairn-test-"));
  process.chdir(workdir);
});

afterEach(async () => {
  process.chdir(originalCwd);
  await fs.rm(workdir, { recursive: true, force: true });
});

const read = (...segments: string[]) =>
  fs.readFile(path.join(workdir, ...segments), "utf8");

const exists = async (...segments: string[]) => {
  try {
    await fs.access(path.join(workdir, ...segments));
    return true;
  } catch {
    return false;
  }
};

const commitIds = async () => {
  const { commitsPath } = getRepoPaths(workdir);
  return fs.readdir(commitsPath);
};

describe("cairn init", () => {
  it("creates the repository directory", async () => {
    await initRepo();

    expect(await exists(REPO_DIR_NAME)).toBe(true);
    expect(await exists(REPO_DIR_NAME, "commits")).toBe(true);
    expect(await exists(REPO_DIR_NAME, "config.json")).toBe(true);
  });

  it("is safe to run twice", async () => {
    await initRepo();
    await initRepo();

    expect(await exists(REPO_DIR_NAME)).toBe(true);
  });
});

describe("cairn add", () => {
  it("copies a file into the staging area", async () => {
    await initRepo();
    await fs.writeFile(path.join(workdir, "notes.txt"), "hello cairn");

    await addRepo("notes.txt");

    expect(await read(REPO_DIR_NAME, "staging", "notes.txt")).toBe(
      "hello cairn"
    );
  });

  it("stages by basename, not by the path given", async () => {
    await initRepo();
    await fs.mkdir(path.join(workdir, "nested"));
    await fs.writeFile(path.join(workdir, "nested", "deep.txt"), "deep");

    await addRepo(path.join("nested", "deep.txt"));

    expect(await read(REPO_DIR_NAME, "staging", "deep.txt")).toBe("deep");
  });

  it("does not throw when the file is missing", async () => {
    await initRepo();

    await expect(addRepo("nope.txt")).resolves.toBeUndefined();
  });
});

describe("cairn commit", () => {
  it("snapshots staged files under a new commit id", async () => {
    await initRepo();
    await fs.writeFile(path.join(workdir, "a.txt"), "first");
    await addRepo("a.txt");

    await commitRepo("first commit");

    const ids = await commitIds();
    expect(ids).toHaveLength(1);

    expect(await read(REPO_DIR_NAME, "commits", ids[0]!, "a.txt")).toBe(
      "first"
    );

    const meta = JSON.parse(
      await read(REPO_DIR_NAME, "commits", ids[0]!, "commit.json")
    ) as { message: string; date: string };

    expect(meta.message).toBe("first commit");
    expect(Number.isNaN(Date.parse(meta.date))).toBe(false);
  });

  it("gives each commit its own directory", async () => {
    await initRepo();
    await fs.writeFile(path.join(workdir, "a.txt"), "one");
    await addRepo("a.txt");
    await commitRepo("one");

    await fs.writeFile(path.join(workdir, "a.txt"), "two");
    await addRepo("a.txt");
    await commitRepo("two");

    expect(await commitIds()).toHaveLength(2);
  });

  it("refuses to create an empty commit", async () => {
    await initRepo();
    await fs.mkdir(path.join(workdir, REPO_DIR_NAME, "staging"), {
      recursive: true,
    });

    await commitRepo("nothing staged");

    // The directory is created then abandoned; no commit.json means no commit.
    const ids = await commitIds();
    for (const id of ids) {
      expect(await exists(REPO_DIR_NAME, "commits", id, "commit.json")).toBe(
        false
      );
    }
  });
});

describe("cairn revert", () => {
  it("restores a commit's files into the working directory", async () => {
    await initRepo();
    await fs.writeFile(path.join(workdir, "a.txt"), "original");
    await addRepo("a.txt");
    await commitRepo("original");

    const [commitId] = await commitIds();

    await fs.writeFile(path.join(workdir, "a.txt"), "changed");
    expect(await read("a.txt")).toBe("changed");

    await revertRepo(commitId!);

    expect(await read("a.txt")).toBe("original");
  });

  it("does not litter the working directory with commit metadata", async () => {
    await initRepo();
    await fs.writeFile(path.join(workdir, "a.txt"), "content");
    await addRepo("a.txt");
    await commitRepo("with metadata");

    const [commitId] = await commitIds();
    await revertRepo(commitId!);

    // Regression: revert used to copy commit.json out alongside the snapshot.
    expect(await exists("commit.json")).toBe(false);
  });

  it("does not throw on an unknown commit id", async () => {
    await initRepo();

    await expect(revertRepo("no-such-commit")).resolves.toBeUndefined();
  });
});
