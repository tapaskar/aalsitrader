import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'integration',
    globals: true,
    environment: 'node',
    setupFiles: ['./integration/setup.ts'],
    include: ['./integration/**/*.test.ts'],
    testTimeout: 30000, // 30 seconds for integration tests
  },
});
