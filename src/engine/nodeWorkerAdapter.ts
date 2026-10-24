import type { IWorker } from './StockfishEngine.js';

// Declaração de tipo para module.createRequire sem depender de @types/node
declare function require(id: string): any;

export function createNodeStockfishWorker(): IWorker {
  // Em ambiente Node / Vitest
  let createRequireFn: any;
  try {
    const nodeModule = (globalThis as any).process?.getBuiltinModule?.('module');
    if (nodeModule?.createRequire) {
      createRequireFn = nodeModule.createRequire;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const req = typeof require !== 'undefined' ? require : (0, eval)('require');
      createRequireFn = req('module').createRequire;
    }
  } catch {
    throw new Error('createNodeStockfishWorker só deve ser chamado em ambiente de teste Node.');
  }

  if (!createRequireFn) {
    throw new Error('createNodeStockfishWorker só deve ser chamado em ambiente de teste Node.');
  }

  const req = createRequireFn(import.meta.url);
  const sf = req('stockfish');
  const enginePath = sf.findEngine('asm');
  if (req.cache && req.cache[enginePath]) {
    delete req.cache[enginePath];
  }

  let listener: ((line: string) => void) | null = null;
  const engine = sf('asm', (line: string) => {
    if (listener) {
      listener(line);
    }
  });

  const worker: IWorker = {
    postMessage(cmd: string) {
      engine.processCommand(cmd);
    },
    set onmessage(handler: ((event: { data: string }) => void) | null) {
      if (handler) {
        listener = (line: string) => handler({ data: line });
      } else {
        listener = null;
      }
    },
    get onmessage() {
      return null;
    },
    terminate() {
      if (typeof engine.terminate === 'function') {
        engine.terminate();
      }
    },
  };

  return worker;
}
