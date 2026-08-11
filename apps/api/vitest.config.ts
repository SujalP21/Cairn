import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // Sets the environment variables loadEnv() validates, before any module
    // that calls it is imported.
    setupFiles: ["./tests/setup.ts"],
    // Spinning up an in-memory mongod costs a few seconds on a cold run.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Each file gets its own database; running them in one process keeps the
    // mongod count (and memory) down.
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
