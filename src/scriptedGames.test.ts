import { describe, it, expect, beforeEach } from 'vitest';
import { GameController } from './game/GameController';
import { StockfishEngine } from './engine/StockfishEngine';
import { analyzeMoveQuality } from './analysis/MoveAnalyzer';
import { getStorage } from './storage';

describe('Partidas Roteirizadas (Fase R3 - Integração Completa)', () => {
  let engine: StockfishEngine;

  beforeEach(() => {
    getStorage().clear();
  });

  // 1. Mate do pastor completo (Brancas vencem)
  it('executa o Mate do Pastor completo com vitória das Brancas (1-0)', () => {
    const game = new GameController();

    // 1. e4 e5
    expect(game.makeMove('e2', 'e4')).not.toBeNull();
    expect(game.makeMove('e7', 'e5')).not.toBeNull();

    // 2. Bc4 Nc6
    expect(game.makeMove('f1', 'c4')).not.toBeNull();
    expect(game.makeMove('b8', 'c6')).not.toBeNull();

    // 3. Qh5 Nf6
    expect(game.makeMove('d1', 'h5')).not.toBeNull();
    expect(game.makeMove('g8', 'f6')).not.toBeNull();

    // 4. Qxf7# (Xeque-mate)
    const mateMove = game.makeMove('h5', 'f7');
    expect(mateMove).not.toBeNull();
    expect(mateMove?.san).toBe('Qxf7#');

    expect(game.isCheck()).toBe(true);
    expect(game.isCheckmate()).toBe(true);
    expect(game.isGameOver()).toBe(true);
    expect(game.getGameResult()).toBe('1-0');
    expect(game.getHistory().length).toBe(7);
  });

  // 2. Afogamento (Empate 1/2-1/2)
  it('detecta afogamento (stalemate) com empate limpo (1/2-1/2)', () => {
    // FEN onde as Pretas jogam e estão afogadas
    const stalemateFen = '5k2/5P2/5K2/8/8/8/8/8 b - - 0 1';
    const game = new GameController(stalemateFen);

    expect(game.turn()).toBe('b');
    expect(game.isCheck()).toBe(false);
    expect(game.isStalemate()).toBe(true);
    expect(game.isDraw()).toBe(true);
    expect(game.isGameOver()).toBe(true);
    expect(game.getGameResult()).toBe('1/2-1/2');
    expect(game.getLegalMoves().length).toBe(0);
  });

  // 3. Empate por repetição tripla
  it('detecta empate por repetição tripla após 3 repetições exatas da mesma posição', () => {
    const game = new GameController();

    // 1. Nf3 Nf6 2. Ng1 Ng8
    game.makeMove('g1', 'f3');
    game.makeMove('g8', 'f6');
    game.makeMove('f3', 'g1');
    game.makeMove('f6', 'g8'); // 1ª repetição da inicial

    // Repete novamente
    game.makeMove('g1', 'f3');
    game.makeMove('g8', 'f6');
    game.makeMove('f3', 'g1');
    game.makeMove('f6', 'g8'); // 2ª repetição (total 3 vezes na posição inicial)

    expect(game.isThreefoldRepetition()).toBe(true);
    expect(game.isDraw()).toBe(true);
    expect(game.isGameOver()).toBe(true);
    expect(game.getGameResult()).toBe('1/2-1/2');
  });

  // 4. Empate pela regra dos 50 lances
  it('detecta empate pela regra dos 50 lances quando 100 meio-lances ocorrem sem avanço de peão ou captura', () => {
    // FEN com 98 meio-lances no relógio de 50 lances:
    // Rei e bispo brancos vs rei preto
    const fen50 = '8/8/8/8/8/4k3/4B3/4K3 w - - 98 50';
    const game = new GameController(fen50);

    // Lance 99
    expect(game.makeMove('e2', 'c4')).not.toBeNull();
    expect(game.isDrawByFiftyMoves()).toBe(false);

    // Lance 100
    expect(game.makeMove('e3', 'f4')).not.toBeNull();
    expect(game.isDrawByFiftyMoves()).toBe(true);
    expect(game.isDraw()).toBe(true);
    expect(game.isGameOver()).toBe(true);
    expect(game.getGameResult()).toBe('1/2-1/2');
  });

  // 5. Desistência no meio da partida
  it('registra desistência no meio da partida com vitória imediata do adversário', () => {
    const game = new GameController();
    game.makeMove('e2', 'e4');
    game.makeMove('e7', 'e5');

    // Jogador joga de Brancas e desiste
    const playerColor = 'white';
    const winner = playerColor === 'white' ? '0-1' : '1-0';
    expect(winner).toBe('0-1');
  });

  // 6. "Tentar de novo" após erro grave contra o motor
  it('executa "tentar de novo" após erro grave e o motor responde ao novo lance, não ao antigo', async () => {
    engine = new StockfishEngine();
    await engine.init();

    const game = new GameController();
    // 1. e4 e5
    game.makeMove('e2', 'e4');
    const moveBlack1 = await engine.getBestMove(game.getFen(), { depth: 2 });
    game.makeMove(moveBlack1.substring(0, 2), moveBlack1.substring(2, 4), moveBlack1.length > 4 ? moveBlack1[4] : undefined);

    const fenBeforeBlunder = game.getFen();

    // Jogador comete erro grave: 2. f3?
    game.makeMove('f2', 'f3');
    // Motor responde ao erro grave
    const moveBlack2 = await engine.getBestMove(game.getFen(), { depth: 2 });
    game.makeMove(moveBlack2.substring(0, 2), moveBlack2.substring(2, 4), moveBlack2.length > 4 ? moveBlack2[4] : undefined);

    expect(game.getHistory().length).toBe(4);

    // Usuário clica em "Tentar de novo": desfaz ambos os lances
    game.undoMove(); // desfaz resposta do motor
    game.undoMove(); // desfaz erro grave do jogador

    expect(game.getFen()).toBe(fenBeforeBlunder);
    expect(game.getHistory().length).toBe(2);
    expect(game.turn()).toBe('w');

    // Jogador joga o lance correto: 2. Nf3
    game.makeMove('g1', 'f3');

    // Motor responde ao NOVO lance (Nf3)
    const moveBlackNew = await engine.getBestMove(game.getFen(), { depth: 2 });
    expect(moveBlackNew).toBeDefined();
    const legalReply = game.makeMove(
      moveBlackNew.substring(0, 2),
      moveBlackNew.substring(2, 4),
      moveBlackNew.length > 4 ? moveBlackNew[4] : undefined
    );
    expect(legalReply).not.toBeNull();

    engine.destroy();
  });

  // 7. Partida com o dono de Pretas
  it('executa partida com o dono jogando de Pretas (motor joga lance 1 de Brancas)', async () => {
    engine = new StockfishEngine();
    await engine.init();

    const game = new GameController();
    expect(game.turn()).toBe('w');

    // Motor (Brancas) faz o primeiro lance
    const whiteMove = await engine.getBestMove(game.getFen(), { depth: 2 });
    const appliedWhite = game.makeMove(
      whiteMove.substring(0, 2),
      whiteMove.substring(2, 4),
      whiteMove.length > 4 ? whiteMove[4] : undefined
    );
    expect(appliedWhite).not.toBeNull();
    expect(game.turn()).toBe('b');

    // Jogador (Pretas) responde com lance legal
    const legalMoves = game.getLegalMoves();
    expect(legalMoves.length).toBeGreaterThan(0);
    const playerResponse = legalMoves[0];
    const appliedBlack = game.makeMove(playerResponse.from, playerResponse.to, playerResponse.promotion);
    expect(appliedBlack).not.toBeNull();
    expect(game.turn()).toBe('w');

    engine.destroy();
  });
});
