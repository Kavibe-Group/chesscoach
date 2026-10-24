import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { StockfishEngine, eloToEngineConfig } from './StockfishEngine';
import { createNodeStockfishWorker } from './nodeWorkerAdapter';
import { Chess } from 'chess.js';

describe('StockfishEngine (Fase 1 - Wrapper UCI e Motor)', () => {
  let engine: StockfishEngine;

  beforeAll(async () => {
    engine = new StockfishEngine(() => createNodeStockfishWorker());
    await engine.init();
  }, 15000);

  afterAll(() => {
    engine.destroy();
  });

  it('sobe, responde uci/isready e fica pronto', () => {
    expect(engine.isReady()).toBe(true);
  });

  it('mapeia Elo para configuração do motor de acordo com as faixas', () => {
    // < 900: Skill 0
    expect(eloToEngineConfig(750)).toEqual({ skillLevel: 0, limitStrength: false });
    // 1000: Skill 3 (target 1050)
    expect(eloToEngineConfig(1000)).toEqual({ skillLevel: 3, limitStrength: false });
    // 1200: Skill 5 (target 1250)
    expect(eloToEngineConfig(1200)).toEqual({ skillLevel: 5, limitStrength: false });
    // >= 1320: UCI_Elo direto (ex: 1500 -> 1550)
    const highElo = eloToEngineConfig(1500);
    expect(highElo.limitStrength).toBe(true);
    expect(highElo.uciElo).toBe(1550);
  });

  it('devolve bestmove legal na posição inicial', async () => {
    const moveUci = await engine.getBestMove('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', {
      depth: 3,
    });
    expect(typeof moveUci).toBe('string');
    expect(moveUci.length).toBeGreaterThanOrEqual(4);

    // Valida com chess.js que é lance legal
    const chess = new Chess();
    const from = moveUci.substring(0, 2);
    const to = moveUci.substring(2, 4);
    const legalMove = chess.move({ from, to });
    expect(legalMove).not.toBeNull();
  }, 10000);

  it('devolve bestmove legal em FEN de meio-jogo', async () => {
    // Posição de meio-jogo onde brancas podem capturar em d5 ou jogar outro lance legal
    const middlegameFen = 'r1bqkb1r/pp3ppp/2n5/1B1pp3/4n3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 7';
    const moveUci = await engine.getBestMove(middlegameFen, { depth: 4 });

    const chess = new Chess(middlegameFen);
    const from = moveUci.substring(0, 2);
    const to = moveUci.substring(2, 4);
    const promotion = moveUci.length > 4 ? moveUci[4] : undefined;
    const legalMove = chess.move({ from, to, promotion });
    expect(legalMove).not.toBeNull();
  }, 10000);

  it('avalia a posição no modo analista retornando pontuação e variante principal', async () => {
    // Posição onde brancas têm mate em 1 (h5xf7#)
    const mateIn1Fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
    const evalResult = await engine.evaluate(mateIn1Fen, 5);

    expect(evalResult.bestMove).toBe('h5f7');
    expect(evalResult.mate).toBe(1);
    expect(evalResult.pv[0]).toBe('h5f7');
  }, 10000);

  it('permite configurar força reduzida e força máxima sem travar', async () => {
    await engine.setStrength({ skillLevel: 0, limitStrength: false });
    const weakMove = await engine.getBestMove('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', {
      depth: 2,
    });
    expect(weakMove).toBeDefined();

    await engine.setStrength({ skillLevel: 20, limitStrength: false });
    const strongMove = await engine.getBestMove('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', {
      depth: 2,
    });
    expect(strongMove).toBeDefined();
  }, 10000);
});
