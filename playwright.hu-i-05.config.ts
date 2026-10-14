import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";

// HU-I-05: E2E, capturas e impresión con el Chrome del sistema (sin descargar
// navegadores). Lo ejecuta scripts/testing/run-hu-i-05.mjs con una base descartable.
export default defineConfig({
  testDir: "./scripts/testing",
  testMatch: "hu-i-05.e2e.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 120000,
  expect: { timeout: 20000 },
  reporter: [["list"], ["json", { outputFile: "docs/testing/Modulo I/hu-i-05/playwright-resultados.json" }]],
  outputDir: join(tmpdir(), "noctium-hu-i-05-playwright"),
  use: {
    baseURL: process.env.HU_I05_BASE_URL ?? "http://127.0.0.1:3105",
    channel: "chrome",
    headless: true,
    viewport: { width: 1440, height: 900 },
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
    trace: "retain-on-failure",
  },
});
