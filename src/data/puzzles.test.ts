import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ASSESSMENT_PUZZLES } from './puzzles';
import { StockfishEngine } from '../engine/StockfishEngine';
import { createNodeStockfishWorker } from '../engine/nodeWorkerAdapter';
import { Chess } from 'chess.js';

describe('Bateria de Avaliação - Validação Obrigatória com Stockfish (Seção 6)', () => {
  let engine: StockfishEngine;

  beforeAll(async () => {
    engine = new StockfishEngine(() => createNodeStockfishWorker());
    await engine.init();
  }, 15000);

  afterAll(() => {
    engine.destroy();
  });

  it('possui exatamente 12 posições: 4 mate em 1, 4 mate em 2, 4 decisivas', () => {
    expect(ASSESSMENT_PUZZLES.length).toBe(12);
    const mate1 = ASSESSMENT_PUZZLES.filter(p => p.type === 'mate1');
    const mate2 = ASSESSMENT_PUZZLES.filter(p => p.type === 'mate2');
    const adv = ASSESSMENT_PUZZLES.filter(p => p.type === 'advantage');

    expect(mate1.length).toBe(4);
    expect(mate2.length).toBe(4);
    expect(adv.length).toBe(4);
  });

  // Validação obrigatória de cada posição pelo Stockfish
  for (const puzzle of ASSESSMENT_PUZZLES) {
    it(`valida posição ${puzzle.id} (${puzzle.type}): solução ${puzzle.solution} (${puzzle.solutionSan}) é lance legal e melhor lance do Stockfish`, async () => {
      // 1. Verifica legalidade no chess.js
      const chess = new Chess(puzzle.fen);
      const from = puzzle.solution.substring(0, 2);
      const to = puzzle.solution.substring(2, 4);
      const promo = puzzle.solution.length > 4 ? puzzle.solution[4] : undefined;
      const move = chess.move({ from, to, promotion: promo });
      expect(move, `Lance ${puzzle.solution} deve ser legal na posição ${puzzle.id}`).not.toBeNull();

      // 2. Avalia com Stockfish
      const depth = puzzle.type === 'mate1' ? 4 : puzzle.type === 'mate2' ? 6 : 8;
      const evaluation = await engine.evaluate(puzzle.fen, depth);

      // O melhor lance do motor precisa coincidir com a solução registrada
      expect(
        evaluation.bestMove,
        `Solução do puzzle ${puzzle.id} deve coincidir com o bestmove do Stockfish`,
      ).toBe(puzzle.solution);
    }, 15000);
  }
});
