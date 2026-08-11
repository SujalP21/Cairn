import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/*
 * Node decides whether a .js file is ESM or CommonJS from the nearest
 * package.json. This package has no "type": "module" (the API requires it with
 * require()), so without these markers Node would read dist/esm as CommonJS and
 * choke on its `export` statements.
 */
const markers = [
  ["dist/cjs/package.json", { type: "commonjs" }],
  ["dist/esm/package.json", { type: "module" }],
];

for (const [relativePath, contents] of markers) {
  const target = resolve(packageRoot, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(contents, null, 2)}\n`);
}
