import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:13100";

export default defineConfig({
  testDir: "./tests",
  testMatch: ["explorer.spec.ts", "research.spec.ts"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  outputDir: "./test-results",
  use: {
    baseURL,
    headless: true,
    launchOptions: {
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
  ],
  webServer: {
    command: "./dev start",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      HOST: "127.0.0.1",
      PORT: "13100",
      APP_ORIGIN: baseURL,
      DATA_DIR: ".runtime/e2e",
    },
  },
});
