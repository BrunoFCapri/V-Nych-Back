import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

// El front vive en un repo hermano; se puede apuntar a otro lado con FRONTEND_DIR.
const frontendDir = process.env.FRONTEND_DIR
  ?? path.resolve(import.meta.dirname, '../../../../V-Nych-Fronted');
const port = 5174;

export default defineConfig({
  testDir: '.',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    cwd: frontendDir,
    url: `http://localhost:${port}/login`,
    reuseExistingServer: !process.env.CI,
  },
});
