// Browser tests for Cellar. The app is served as-is from this folder; the
// Google Sheet and the Anthropic API are faked in tests/helpers.js.
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "tests",
  timeout: 20000,
  use: {
    baseURL: "http://localhost:8765",
    serviceWorkers: "block", // keep the offline cache out of the way
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  webServer: {
    command: "python3 -m http.server 8765",
    url: "http://localhost:8765",
    reuseExistingServer: !process.env.CI,
    stderr: "ignore", // http.server logs every request there
  },
});
