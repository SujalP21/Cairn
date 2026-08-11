#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/*
 * Creates the .env files a fresh clone needs, filling in the secrets that must
 * not be shipped in .env.example.
 *
 * Idempotent by design: an existing .env is never touched, so running this
 * again on a configured machine cannot clobber a working setup.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const targets = [
  {
    example: "apps/api/.env.example",
    output: "apps/api/.env",
    fill: {
      // 384 bits, well past the 32-character minimum the config loader enforces.
      JWT_ACCESS_SECRET: () => randomBytes(48).toString("hex"),
    },
  },
  {
    example: "apps/web/.env.example",
    output: "apps/web/.env",
    fill: {},
  },
];

let created = 0;
let skipped = 0;

for (const target of targets) {
  const outputPath = resolve(root, target.output);

  if (existsSync(outputPath)) {
    console.log(`  exists   ${target.output}  (left alone)`);
    skipped += 1;
    continue;
  }

  let contents = await readFile(resolve(root, target.example), "utf8");

  for (const [key, generate] of Object.entries(target.fill)) {
    const value = generate();
    const pattern = new RegExp(`^${key}=.*$`, "m");

    contents = pattern.test(contents)
      ? contents.replace(pattern, `${key}=${value}`)
      : `${contents}\n${key}=${value}\n`;
  }

  await writeFile(outputPath, contents);
  console.log(`  created  ${target.output}`);
  created += 1;
}

console.log(
  `\n${created} created, ${skipped} already present.` +
    (created > 0
      ? "\nA signing secret was generated for you. Edit MONGODB_URI if your database is not on localhost."
      : "")
);
