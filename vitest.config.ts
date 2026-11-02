import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` refuses to load outside a Next.js server build; tests run in plain Node.
      "server-only": fileURLToPath(new URL("./tests/unit/support/empty-module.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    // Public settings only (from .env.local); integration tests need local Supabase running.
    env: loadEnv("test", process.cwd(), ["NEXT_PUBLIC_", "MAILPIT_"]),
    testTimeout: 30_000,
  },
});
