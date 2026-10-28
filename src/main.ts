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
    const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) ? import.meta.env.BASE_URL : './';
    const cleanBase = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
    const swUrl = cleanBase + 'sw.js';
    navigator.serviceWorker.register(swUrl).catch(err => {
      console.warn('Registro do Service Worker falhou:', err);
    });
  });
}
