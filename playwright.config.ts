import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 45_000,
  use: { baseURL: 'http://localhost:5198', trace: 'retain-on-failure' },
  webServer: { command: 'npx vite --port 5198 --strictPort', url: 'http://localhost:5198', reuseExistingServer: true },
  projects: [
    { name: 'phone', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    { name: 'desktop', use: { viewport: { width: 1280, height: 860 } } },
  ],
})
