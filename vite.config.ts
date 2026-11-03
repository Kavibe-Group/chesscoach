/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/chesscoach/' : './',
  plugins: [{
    name: 'offline-shell',
    transformIndexHtml(html) {
      // Same iPhone workaround confirmed in Gemma: the icon is available in the
      // document itself, without a separate request during Add to Home Screen.
      const icon = readFileSync('public/apple-touch-icon.png').toString('base64');
      return html.replace('href="./apple-touch-icon.png"', `type="image/png" href="data:image/png;base64,${icon}"`);
    },
    generateBundle(_options, bundle) {
      const assets = Object.keys(bundle).filter(path => /\.(js|css)$/.test(path));
      const version = createHash('sha256')
        .update(assets.join('|'))
        .update(readFileSync('index.html'))
        .update(readFileSync('public/apple-touch-icon.png'))
        .update(readFileSync('public/manifest.webmanifest'))
        .digest('hex').slice(0,12);
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
