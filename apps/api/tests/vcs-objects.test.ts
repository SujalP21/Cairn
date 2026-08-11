import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  hashObject,
  writeObject,
  readObject,
  readTyped,
  listObjects,
  expandHash,
  objectExists,
} from "../src/vcs/objects";
import {
  buildTree,
  readTreeFlat,
  serializeTree,
  parseTree,
} from "../src/vcs/trees";
import { parseCommit, serializeCommit } from "../src/vcs/commits";
import { diffLines, splitLines, toHunks } from "../src/vcs/diff";
import { repoPathsFor, type RepoPaths } from "../src/vcs/paths";

let workdir: string;
let repo: RepoPaths;

beforeEach(async () => {
  workdir = await fs.mkdtemp(path.join(os.tmpdir(), "cairn-obj-"));
  repo = repoPathsFor(workdir);
  await fs.mkdir(repo.objectsPath, { recursive: true });
});

afterEach(async () => {
  await fs.rm(workdir, { recursive: true, force: true });
});

describe("content addressing", () => {
  it("gives identical content the same id", () => {
    const a = hashObject("blob", Buffer.from("hello"));
    const b = hashObject("blob", Buffer.from("hello"));

    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("gives different content different ids", () => {
    expect(hashObject("blob", Buffer.from("hello"))).not.toBe(
      hashObject("blob", Buffer.from("hello "))
    );
  });

  it("distinguishes types with identical bytes", () => {
    // The type is part of the framed input; without it these would collide.
    expect(hashObject("blob", Buffer.from(""))).not.toBe(
      hashObject("tree", Buffer.from(""))
    );
  });

  it("stores identical content exactly once", async () => {
    const first = await writeObject(repo, "blob", Buffer.from("duplicated"));
    const second = await writeObject(repo, "blob", Buffer.from("duplicated"));

    expect(first).toBe(second);
    // This is the whole point of the rewrite: one object, not two copies.
    expect(await listObjects(repo)).toHaveLength(1);
  });

  it("round-trips content unchanged, including binary", async () => {
    const binary = Buffer.from([0, 1, 2, 255, 254, 0, 10]);
    const hash = await writeObject(repo, "blob", binary);

    expect(await readTyped(repo, hash, "blob")).toEqual(binary);
  });

  it("rejects reading an object as the wrong type", async () => {
    const hash = await writeObject(repo, "blob", Buffer.from("x"));

    await expect(readTyped(repo, hash, "tree")).rejects.toThrow(/tree/);
  });

  it("detects a corrupted object rather than returning bad data", async () => {
    const hash = await writeObject(repo, "blob", Buffer.from("intact"));
    const stored = path.join(repo.objectsPath, hash.slice(0, 2), hash.slice(2));

    // Truncate the payload while leaving the header claiming the old length.
    await fs.writeFile(stored, Buffer.from("blob 6\0tru"));

    await expect(readObject(repo, hash)).rejects.toThrow(/corrupt/i);
  });

  it("leaves no temporary files behind", async () => {
    await writeObject(repo, "blob", Buffer.from("clean"));

    expect((await listObjects(repo)).every((h) => !h.includes("tmp"))).toBe(
      true
    );
  });
});

describe("hash prefixes", () => {
  it("expands a unique prefix to the full id", async () => {
    const hash = await writeObject(repo, "blob", Buffer.from("prefix me"));

    expect(await expandHash(repo, hash.slice(0, 8))).toBe(hash);
  });

  it("refuses an ambiguous prefix instead of guessing", async () => {
    // Craft two objects and search for a prefix they share.
    const hashes = await Promise.all(
      Array.from({ length: 60 }, (_, i) =>
        writeObject(repo, "blob", Buffer.from(`content-${i}`))
      )
    );

    const shared = hashes.find((h, i) =>
      hashes.some((other, j) => i !== j && other.slice(0, 1) === h.slice(0, 1))
    );
    expect(shared).toBeDefined();

    // A 1-char prefix is rejected as too short before ambiguity even matters.
    await expect(expandHash(repo, shared!.slice(0, 1))).rejects.toThrow(
      /too short/
    );
  });

  it("reports an unknown prefix", async () => {
    await expect(expandHash(repo, "deadbeef")).rejects.toThrow(/No object/);
  });
});

describe("trees", () => {
  it("serialises deterministically regardless of input order", () => {
    const a = serializeTree([
      { type: "blob", hash: "b".repeat(64), name: "second" },
      { type: "blob", hash: "a".repeat(64), name: "first" },
    ]);
    const b = serializeTree([
      { type: "blob", hash: "a".repeat(64), name: "first" },
      { type: "blob", hash: "b".repeat(64), name: "second" },
    ]);

    // Same content must hash identically or deduplication silently breaks.
    expect(a).toEqual(b);
  });

  it("round-trips through parse", () => {
    const entries = [
      { type: "blob" as const, hash: "a".repeat(64), name: "file.txt" },
      { type: "tree" as const, hash: "b".repeat(64), name: "src" },
    ];

    expect(parseTree(serializeTree(entries))).toEqual(entries);
  });

  it("handles filenames containing spaces", () => {
    const entries = [
      { type: "blob" as const, hash: "c".repeat(64), name: "my notes.txt" },
    ];

    expect(parseTree(serializeTree(entries))[0]!.name).toBe("my notes.txt");
  });

  it("builds and flattens nested directories", async () => {
    const blob = await writeObject(repo, "blob", Buffer.from("x"));

    const files = {
      "readme.md": blob,
      "src/index.ts": blob,
      "src/lib/deep.ts": blob,
    };

    expect(await readTreeFlat(repo, await buildTree(repo, files))).toEqual(
      files
    );
  });

  it("gives unchanged content the same tree id", async () => {
    const blob = await writeObject(repo, "blob", Buffer.from("stable"));

    expect(await buildTree(repo, { "a.txt": blob })).toBe(
      await buildTree(repo, { "a.txt": blob })
    );
  });
});

describe("commits", () => {
  it("round-trips through parse", () => {
    const commit = {
      tree: "a".repeat(64),
      parents: ["b".repeat(64), "c".repeat(64)],
      author: "someone",
      timestamp: "2026-01-01T00:00:00.000Z",
      message: "a message\nwith two lines",
    };

    expect(parseCommit(serializeCommit(commit))).toEqual(commit);
  });

  it("handles a root commit with no parents", () => {
    const commit = {
      tree: "a".repeat(64),
      parents: [],
      author: "someone",
      timestamp: "2026-01-01T00:00:00.000Z",
      message: "first",
    };

    expect(parseCommit(serializeCommit(commit)).parents).toEqual([]);
  });
});

describe("diff", () => {
  it("reports no changes for identical input", () => {
    const lines = diffLines(["a", "b"], ["a", "b"]);

    expect(lines.every((line) => line.op === "context")).toBe(true);
  });

  it("finds an insertion without rewriting surrounding lines", () => {
    const result = diffLines(["a", "c"], ["a", "b", "c"]);

    expect(result.filter((l) => l.op === "add").map((l) => l.text)).toEqual([
      "b",
    ]);
    expect(result.filter((l) => l.op === "remove")).toHaveLength(0);
  });

  it("finds a deletion", () => {
    const result = diffLines(["a", "b", "c"], ["a", "c"]);

    expect(result.filter((l) => l.op === "remove").map((l) => l.text)).toEqual([
      "b",
    ]);
  });

  it("treats a replacement as a delete plus an add", () => {
    const result = diffLines(["old"], ["new"]);

    expect(result.map((l) => l.op).sort()).toEqual(["add", "remove"]);
  });

  it("numbers lines against the correct side", () => {
    const result = diffLines(["a"], ["a", "b"]);
    const added = result.find((l) => l.op === "add");

    expect(added?.newLine).toBe(2);
    expect(added?.oldLine).toBeUndefined();
  });

  it("does not treat a trailing newline as an extra empty line", () => {
    expect(splitLines("a\nb\n")).toEqual(["a", "b"]);
    expect(splitLines("")).toEqual([]);
  });

  it("groups distant changes into separate hunks", () => {
    const before = Array.from({ length: 40 }, (_, i) => `line ${i}`);
    const after = [...before];
    after[1] = "changed near the top";
    after[38] = "changed near the bottom";

    expect(toHunks(diffLines(before, after))).toHaveLength(2);
  });

  it("returns no hunks when nothing changed", () => {
    expect(toHunks(diffLines(["same"], ["same"]))).toHaveLength(0);
  });
});

describe("object store bookkeeping", () => {
  it("reports absence without throwing", async () => {
    expect(await objectExists(repo, "f".repeat(64))).toBe(false);
  });

  it("lists nothing for an empty store", async () => {
    const empty = repoPathsFor(
      await fs.mkdtemp(path.join(os.tmpdir(), "empty-"))
    );

    expect(await listObjects(empty)).toEqual([]);
  });
});
