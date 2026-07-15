import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: "esnext",
    outDir: "dist",
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "./coverage",
      // Same exclusions as sonar-project.properties' sonar.coverage.exclusions:
      // main.ts is demo/boilerplate DOM code with no business logic to gate on.
      // The threshold applies for real to any src file added beyond it.
      exclude: [
        "**/main.ts",
        "**/setup.ts",
        "**/*.test.ts",
        "**/*.config.*",
        "node_modules/**",
        "dist/**",
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
