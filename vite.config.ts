/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/chesscoach/' : './',
  build: {
    target: 'esnext',
  },
  test: {
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
