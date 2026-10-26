import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.cburnett.css';
import 'chessground/assets/chessground.brown.css';
import './style.css';

import { App } from './ui/App.js';

const rootEl = document.querySelector<HTMLDivElement>('#app');
if (rootEl) {
  new App(rootEl);
}

// Registro de Service Worker para funcionalidade PWA offline (WASM + UI)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('Registro do Service Worker falhou:', err);
    });
  });
}
