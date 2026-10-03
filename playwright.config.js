import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://127.0.0.1:9001',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 9001 --strictPort --no-open',
    url: 'http://127.0.0.1:9001',
    reuseExistingServer: false
  }
});
