import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    name: 'unit',
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./unit/setup.ts'],
    include: ['./unit/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules/', '**/types/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../frontend/src'),
    },
  },
});
