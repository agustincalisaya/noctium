import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./scripts/testing",
  testMatch: "historial-po.e2e.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  reporter: [["list"], ["json", { outputFile: "docs/testing/Modulo E/revision-po/playwright-resultados.json" }]],
  outputDir: "/tmp/noctium-po-playwright-results",
  use: { baseURL: process.env.HISTORIAL_PO_BASE_URL ?? "http://127.0.0.1:3100", viewport: { width: 1440, height: 1080 }, trace: "retain-on-failure" },
});
