import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: '/Coordinator-please/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
