/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/chesscoach/' : './',
  plugins: [{
    name: 'offline-shell',
    generateBundle(_options, bundle) {
      const assets = Object.keys(bundle).filter(path => /\.(js|css)$/.test(path));
      const version = createHash('sha256').update(assets.join('|')).digest('hex').slice(0,12);
      const source = readFileSync('public/sw.js','utf8').replace('__BUILD_VERSION__',version).replace('__BUILD_ASSETS__',JSON.stringify(assets));
      this.emitFile({type:'asset',fileName:'sw.js',source});
    },
  }],
  build: {
    target: 'esnext',
  },
  test: {
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
