import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GameController } from './game/GameController';
import { StockfishEngine } from './engine/StockfishEngine';

describe('Fuzz / Soak Test (Fase R3 - 100 Partidas Automáticas contra o Stockfish)', () => {
  let engine: StockfishEngine;

  beforeAll(async () => {
    engine = new StockfishEngine();
    await engine.init();
  }, 30000);

  afterAll(() => {
    engine.destroy();
  });

  it('executa 100 partidas automáticas consecutivas sem crash, sem lances ilegais e com motor sempre respondendo', async () => {
    const TOTAL_GAMES = 100;
    const MAX_PLIES_PER_GAME = 20; // 10 lances de cada lado por partida

    let totalMovesPlayed = 0;
    let completedGames = 0;

    for (let gameIdx = 0; gameIdx < TOTAL_GAMES; gameIdx++) {
      const game = new GameController();
      await engine.newGame();

      // Varia a profundidade/tempo do motor entre partidas para fuzzing robusto
      const depth = (gameIdx % 3) + 1; // profundidade 1 a 3

      let plies = 0;
      while (!game.isGameOver() && plies < MAX_PLIES_PER_GAME) {
        // Vez do jogador: escolhe um lance legal aleatório
        const legalMoves = game.getLegalMoves();
        expect(legalMoves.length).toBeGreaterThan(0);

        const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
        const playerApplied = game.makeMove(randomMove.from, randomMove.to, randomMove.promotion);
        expect(playerApplied).not.toBeNull();
        totalMovesPlayed++;
        plies++;

        if (game.isGameOver()) break;

        // Vez do Stockfish
        const currentFen = game.getFen();
        const bestMoveUci = await engine.getBestMove(currentFen, { depth });
        expect(bestMoveUci).toBeDefined();
        expect(typeof bestMoveUci).toBe('string');
        expect(bestMoveUci.length).toBeGreaterThanOrEqual(4);

        const bFrom = bestMoveUci.substring(0, 2);
        const bTo = bestMoveUci.substring(2, 4);
        const bPromo = bestMoveUci.length > 4 ? bestMoveUci[4] : undefined;

        const engineApplied = game.makeMove(bFrom, bTo, bPromo);
        expect(engineApplied).not.toBeNull();
        totalMovesPlayed++;
        plies++;
      }

      completedGames++;
    }

    expect(completedGames).toBe(TOTAL_GAMES);
    expect(totalMovesPlayed).toBeGreaterThan(1000);
  }, 120000);
});
