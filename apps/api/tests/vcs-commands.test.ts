import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { initRepo } from "../src/vcs/commands/init";
import { addRepo } from "../src/vcs/commands/add";
import { commitRepo } from "../src/vcs/commands/commit";
import { branchRepo } from "../src/vcs/commands/branch";
import { checkoutRepo } from "../src/vcs/commands/checkout";
import { mergeRepo } from "../src/vcs/commands/merge";
import { revertRepo } from "../src/vcs/commands/revert";

import { REPO_DIR_NAME, repoPathsFor, findRepo } from "../src/vcs/paths";
import { listObjects } from "../src/vcs/objects";
import {
  readHead,
  resolveHead,
  listBranches,
  readBranch,
} from "../src/vcs/refs";
import { walkHistory, readCommit } from "../src/vcs/commits";
import { computeStatus } from "../src/vcs/status";
import { readTreeFlat } from "../src/vcs/trees";

// The commands operate on process.cwd(), so each test gets its own directory.
let workdir: string;
let originalCwd: string;

beforeEach(async () => {
  originalCwd = process.cwd();
  // macOS /tmp is a symlink to /private/tmp; realpath keeps path comparisons honest.
  workdir = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), "cairn-cmd-"))
  );
  process.chdir(workdir);
  process.exitCode = undefined;
});

afterEach(async () => {
  process.chdir(originalCwd);
  await fs.rm(workdir, { recursive: true, force: true });
  process.exitCode = undefined;
});

const repo = () => repoPathsFor(workdir);

const write = (relative: string, content: string) =>
  fs
    .mkdir(path.dirname(path.join(workdir, relative)), { recursive: true })
    .then(() => fs.writeFile(path.join(workdir, relative), content));

const read = (relative: string) =>
  fs.readFile(path.join(workdir, relative), "utf8");

const exists = async (relative: string) => {
  try {
    await fs.access(path.join(workdir, relative));
    return true;
  } catch {
    return false;
  }
};

/** init + one commit containing `files`. */
const commitFiles = async (
  files: Record<string, string>,
  message = "commit"
) => {
  for (const [name, content] of Object.entries(files)) {
    await write(name, content);
    await addRepo(name);
  }
  await commitRepo(message);
};

describe("init", () => {
  it("creates the object store and an unborn default branch", async () => {
    await initRepo();

    expect(await exists(`${REPO_DIR_NAME}/objects`)).toBe(true);
    expect(await exists(`${REPO_DIR_NAME}/refs/heads`)).toBe(true);

    const head = await readHead(repo());
    expect(head.type).toBe("branch");
    expect(head.type === "branch" && head.branch).toBe("main");
    // The branch does not exist until the first commit.
    expect(await resolveHead(repo())).toBeNull();
  });

  it("refuses to re-initialise over an existing repository", async () => {
    await initRepo();
    await write("a.txt", "content");
    await addRepo("a.txt");
    await commitRepo("first");

    const before = await resolveHead(repo());
    await initRepo();

    expect(await resolveHead(repo())).toBe(before);
  });

  it("is discoverable from a subdirectory", async () => {
    await initRepo();
    await fs.mkdir(path.join(workdir, "nested", "deep"), { recursive: true });

    const found = await findRepo(path.join(workdir, "nested", "deep"));
    expect(found?.workTree).toBe(workdir);
  });
});

describe("add", () => {
  beforeEach(async () => {
    await initRepo();
  });

  it("stages a file and stores its content", async () => {
    await write("notes.txt", "hello cairn");
    await addRepo("notes.txt");

    const status = await computeStatus(repo());
    expect(status.staged.added).toEqual(["notes.txt"]);
    expect(await listObjects(repo())).toHaveLength(1);
  });

  it("stages a directory recursively, preserving paths", async () => {
    await write("src/index.ts", "entry");
    await write("src/lib/util.ts", "util");
    await addRepo("src");

    const status = await computeStatus(repo());
    expect(status.staged.added.sort()).toEqual([
      "src/index.ts",
      "src/lib/util.ts",
    ]);
  });

  it("never stages the repository's own internals", async () => {
    await write("a.txt", "x");
    await addRepo(".");

    const status = await computeStatus(repo());
    expect(status.staged.added.some((f) => f.startsWith(REPO_DIR_NAME))).toBe(
      false
    );
  });

  it("reports a missing path instead of throwing", async () => {
    await addRepo("nope.txt");
    expect(process.exitCode).toBe(1);
  });

  it("stores identical content once across different filenames", async () => {
    await write("one.txt", "same bytes");
    await write("two.txt", "same bytes");
    await addRepo("one.txt");
    await addRepo("two.txt");

    // Two paths, one blob — this is the deduplication working.
    expect(await listObjects(repo())).toHaveLength(1);
  });
});

describe("commit", () => {
  beforeEach(async () => {
    await initRepo();
  });

  it("creates the branch on the first commit", async () => {
    await commitFiles({ "a.txt": "one" }, "first");

    expect(await listBranches(repo())).toEqual(["main"]);
    expect(await resolveHead(repo())).toBeTruthy();
  });

  it("links each commit to its parent", async () => {
    await commitFiles({ "a.txt": "one" }, "first");
    const first = await resolveHead(repo());

    await write("a.txt", "two");
    await addRepo("a.txt");
    await commitRepo("second");
    const second = await resolveHead(repo());

    expect(second).not.toBe(first);
    expect((await readCommit(repo(), second!)).parents).toEqual([first]);
  });

  it("produces a walkable history, newest first", async () => {
    await commitFiles({ "a.txt": "1" }, "first");
    await write("a.txt", "2");
    await addRepo("a.txt");
    await commitRepo("second");
    await write("a.txt", "3");
    await addRepo("a.txt");
    await commitRepo("third");

    const messages: string[] = [];
    for await (const commit of walkHistory(repo(), await resolveHead(repo()))) {
      messages.push(commit.message);
    }

    expect(messages).toEqual(["third", "second", "first"]);
  });

  it("refuses an empty staging area", async () => {
    await commitRepo("nothing");
    expect(await resolveHead(repo())).toBeNull();
  });

  it("refuses a commit that would not change the tree", async () => {
    await commitFiles({ "a.txt": "unchanged" }, "first");
    const first = await resolveHead(repo());

    await addRepo("a.txt");
    await commitRepo("same content again");

    expect(await resolveHead(repo())).toBe(first);
  });

  it("reuses blobs across commits instead of duplicating them", async () => {
    await commitFiles(
      { "big.txt": "a".repeat(1000), "other.txt": "x" },
      "first"
    );
    const afterFirst = (await listObjects(repo())).length;

    // Only other.txt changes; big.txt must not be stored a second time.
    await write("other.txt", "y");
    await addRepo("other.txt");
    await commitRepo("second");

    const afterSecond = (await listObjects(repo())).length;
    // one blob + one tree + one commit = 3 new objects, not 4.
    expect(afterSecond - afterFirst).toBe(3);
  });
});

describe("status", () => {
  beforeEach(async () => {
    await initRepo();
  });

  it("separates staged, unstaged and untracked", async () => {
    await commitFiles({ "committed.txt": "v1" }, "first");

    await write("committed.txt", "v2 on disk");
    await write("staged.txt", "staged");
    await addRepo("staged.txt");
    await write("untracked.txt", "loose");

    const status = await computeStatus(repo());

    expect(status.staged.added).toEqual(["staged.txt"]);
    expect(status.notStaged.modified).toEqual(["committed.txt"]);
    expect(status.untracked).toEqual(["untracked.txt"]);
  });

  it("notices a tracked file deleted from disk", async () => {
    await commitFiles({ "gone.txt": "here" }, "first");
    await fs.rm(path.join(workdir, "gone.txt"));

    expect((await computeStatus(repo())).notStaged.deleted).toEqual([
      "gone.txt",
    ]);
  });

  it("is clean straight after a commit", async () => {
    await commitFiles({ "a.txt": "x" }, "first");
    const status = await computeStatus(repo());

    expect(status.staged.added).toHaveLength(0);
    expect(status.notStaged.modified).toHaveLength(0);
    expect(status.branch).toBe("main");
  });
});

describe("branch", () => {
  beforeEach(async () => {
    await initRepo();
    await commitFiles({ "a.txt": "one" }, "first");
  });

  it("creates a branch pointing at the current commit", async () => {
    await branchRepo("feature");

    expect(await readBranch(repo(), "feature")).toBe(await resolveHead(repo()));
  });

  it("refuses a duplicate name", async () => {
    await branchRepo("feature");
    await branchRepo("feature");

    expect(process.exitCode).toBe(1);
  });

  it("refuses to delete the branch you are on", async () => {
    await branchRepo("main", { delete: true });

    expect(process.exitCode).toBe(1);
    expect(await readBranch(repo(), "main")).toBeTruthy();
  });

  it("deletes another branch", async () => {
    await branchRepo("scratch");
    await branchRepo("scratch", { delete: true });

    expect(await readBranch(repo(), "scratch")).toBeNull();
  });
});

describe("checkout", () => {
  beforeEach(async () => {
    await initRepo();
    await commitFiles({ "a.txt": "on main" }, "first");
  });

  it("switches branches and swaps the working tree", async () => {
    await branchRepo("feature");
    await checkoutRepo("feature");

    await write("a.txt", "on feature");
    await write("feature-only.txt", "new");
    await addRepo("a.txt");
    await addRepo("feature-only.txt");
    await commitRepo("feature work");

    await checkoutRepo("main");

    expect(await read("a.txt")).toBe("on main");
    // Files that exist only on the other branch must not linger.
    expect(await exists("feature-only.txt")).toBe(false);

    await checkoutRepo("feature");
    expect(await read("a.txt")).toBe("on feature");
    expect(await exists("feature-only.txt")).toBe(true);
  });

  it("refuses to discard uncommitted work", async () => {
    await branchRepo("feature");
    await write("a.txt", "uncommitted edit");

    await checkoutRepo("feature");

    expect(process.exitCode).toBe(1);
    expect(await read("a.txt")).toBe("uncommitted edit");
  });

  it("discards uncommitted work when forced", async () => {
    await branchRepo("feature");
    await write("a.txt", "uncommitted edit");

    await checkoutRepo("feature", { force: true });

    expect(await read("a.txt")).toBe("on main");
  });

  it("detaches HEAD when given a commit id", async () => {
    const first = await resolveHead(repo());

    await write("a.txt", "second version");
    await addRepo("a.txt");
    await commitRepo("second");

    await checkoutRepo(first!.slice(0, 8));

    const head = await readHead(repo());
    expect(head.type).toBe("detached");
    expect(await read("a.txt")).toBe("on main");
  });

  it("leaves the tree clean after switching", async () => {
    await branchRepo("feature");
    await checkoutRepo("feature");

    const status = await computeStatus(repo());
    expect(status.notStaged.modified).toHaveLength(0);
    expect(status.staged.added).toHaveLength(0);
  });

  it("reports an unknown target", async () => {
    await checkoutRepo("no-such-branch");
    expect(process.exitCode).toBe(1);
  });
});

describe("merge", () => {
  beforeEach(async () => {
    await initRepo();
    await commitFiles({ "a.txt": "base" }, "base");
  });

  it("fast-forwards when the branch is strictly ahead", async () => {
    await branchRepo("feature");
    await checkoutRepo("feature");

    await write("b.txt", "from feature");
    await addRepo("b.txt");
    await commitRepo("feature work");
    const featureCommit = await resolveHead(repo());

    await checkoutRepo("main");
    await mergeRepo("feature");

    expect(await resolveHead(repo())).toBe(featureCommit);
    expect(await read("b.txt")).toBe("from feature");
  });

  it("reports already up to date when nothing to do", async () => {
    await branchRepo("feature");
    await mergeRepo("feature");

    expect(process.exitCode).toBeUndefined();
    expect(await read("a.txt")).toBe("base");
  });

  it("refuses divergent histories rather than guessing", async () => {
    await branchRepo("feature");

    // main moves on
    await write("a.txt", "main change");
    await addRepo("a.txt");
    await commitRepo("main work");
    const mainCommit = await resolveHead(repo());

    // feature moves on independently
    await checkoutRepo("feature");
    await write("c.txt", "feature change");
    await addRepo("c.txt");
    await commitRepo("feature work");

    await checkoutRepo("main");
    await mergeRepo("feature");

    expect(process.exitCode).toBe(1);
    // Nothing was touched — refusing is safe, guessing would not be.
    expect(await resolveHead(repo())).toBe(mainCommit);
  });

  it("refuses to merge a branch that does not exist", async () => {
    await mergeRepo("ghost");
    expect(process.exitCode).toBe(1);
  });
});

describe("revert", () => {
  beforeEach(async () => {
    await initRepo();
  });

  it("restores a commit's files without moving HEAD", async () => {
    await commitFiles({ "a.txt": "original" }, "first");
    const first = await resolveHead(repo());

    await write("a.txt", "changed");
    await addRepo("a.txt");
    await commitRepo("second");
    const second = await resolveHead(repo());

    await revertRepo(first!.slice(0, 8));

    expect(await read("a.txt")).toBe("original");
    // History is untouched; the restore shows up as an uncommitted change.
    expect(await resolveHead(repo())).toBe(second);
  });

  it("does not litter the working tree with commit metadata", async () => {
    await commitFiles({ "a.txt": "content" }, "first");
    await revertRepo((await resolveHead(repo()))!);

    // Regression: the old copy-based implementation wrote commit.json out.
    expect(await exists("commit.json")).toBe(false);
  });

  it("refuses to overwrite uncommitted work", async () => {
    await commitFiles({ "a.txt": "committed" }, "first");
    await write("a.txt", "unsaved");

    await revertRepo((await resolveHead(repo()))!);

    expect(process.exitCode).toBe(1);
    expect(await read("a.txt")).toBe("unsaved");
  });

  it("reports an unknown commit", async () => {
    await commitFiles({ "a.txt": "x" }, "first");
    await revertRepo("deadbeef");

    expect(process.exitCode).toBe(1);
  });
});

describe("end to end", () => {
  it("survives a full branch, diverge, checkout and fast-forward cycle", async () => {
    await initRepo();

    await commitFiles(
      { "README.md": "# Project", "src/main.ts": "start" },
      "initial"
    );
    const initial = await resolveHead(repo());

    await branchRepo("feature");
    await checkoutRepo("feature");

    await write("src/main.ts", "start\nmore");
    await write("src/extra.ts", "extra");
    await addRepo("src");
    await commitRepo("extend");

    await checkoutRepo("main");
    expect(await read("src/main.ts")).toBe("start");
    expect(await exists("src/extra.ts")).toBe(false);

    await mergeRepo("feature");
    expect(await read("src/main.ts")).toBe("start\nmore");
    expect(await exists("src/extra.ts")).toBe(true);

    // History from the merged tip reaches the very first commit.
    const hashes: string[] = [];
    for await (const commit of walkHistory(repo(), await resolveHead(repo()))) {
      hashes.push(commit.hash);
    }
    expect(hashes).toContain(initial);

    // The committed tree matches what is actually on disk.
    const tree = await readTreeFlat(
      repo(),
      (await readCommit(repo(), (await resolveHead(repo()))!)).tree
    );
    expect(Object.keys(tree).sort()).toEqual([
      "README.md",
      "src/extra.ts",
      "src/main.ts",
    ]);
  });
});
