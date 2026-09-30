import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.js"],
    globalSetup: "./tests/globalSetup.js",
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // All test files share one Postgres container (started once in
    // globalSetup) and the same live tables -- run files sequentially so
    // two files can't race on shared rows (e.g. both creating a user with
    // the same phone number) purely from running in parallel.
    fileParallelism: false
  }
});
