import { defineConfig, devices } from '@playwright/test'

/**
 * Smoke tests for the critical journeys. They run against an already-running app:
 *   SMOKE_BASE_URL=http://localhost:3000 npm run test:smoke
 *
 * Each group skips itself when its secrets are missing, so the public group always runs
 * (CI, deploy candidate, laptop) and the others run wherever their keys exist. See e2e/README.md.
 */
const baseURL = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    // No extraHTTPHeaders: they are sent to third-party origins too (Clerk), and a custom
    // header there fails CORS and stops the sign-in widget from loading.
  },
  projects: [
    { name: 'setup', testMatch: /global\.setup\.ts/ },
    {
      name: 'smoke',
      testMatch: /.*\.smoke\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
