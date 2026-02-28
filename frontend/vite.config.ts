import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Capacitor requires relative asset paths for the native webview
    assetsDir: 'assets',
  },
  // Use './' base for Capacitor native builds, '/' for web deploys
  // Switch to base: '/' when deploying to S3/CloudFront
  base: process.env.CAPACITOR_BUILD ? './' : '/',
});
