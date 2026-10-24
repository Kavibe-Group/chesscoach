import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.cburnett.css';
import 'chessground/assets/chessground.brown.css';
import './style.css';

import { App } from './ui/App.js';

const rootEl = document.querySelector<HTMLDivElement>('#app');
if (rootEl) {
  new App(rootEl);
}
