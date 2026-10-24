import { describe, it, expect, beforeEach } from 'vitest';
import { GameController } from './GameController';

describe('GameController (Fase 0 - Andaime e núcleo de regras)', () => {
  let controller: GameController;

  beforeEach(() => {
    controller = new GameController();
  });

  it('inicia na posição padrão', () => {
    expect(controller.getFen()).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    expect(controller.turn()).toBe('w');
    expect(controller.isGameOver()).toBe(false);
    expect(controller.moveNumber()).toBe(1);
  });

  it('aceita lances legais e rejeita lances ilegais', () => {
    const move = controller.makeMove('e2', 'e4');
    expect(move).not.toBeNull();
    expect(move?.san).toBe('e4');
    expect(controller.turn()).toBe('b');

    // Lance ilegal para pretas (peão não move lateralmente assim)
    const illegalMove = controller.makeMove('e7', 'd5');
    expect(illegalMove).toBeNull();

    // Lance legal para pretas
    const legalBlackMove = controller.makeMove('e7', 'e5');
    expect(legalBlackMove).not.toBeNull();
    expect(legalBlackMove?.san).toBe('e5');
  });

  it('desfaz lances corretamente (undo)', () => {
    controller.makeMove('e2', 'e4');
    expect(controller.turn()).toBe('b');
    const undone = controller.undoMove();
    expect(undone).not.toBeNull();
    expect(undone?.san).toBe('e4');
    expect(controller.turn()).toBe('w');
    expect(controller.getFen()).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  });

  it('detecta xeque-mate com o Mate do Pastor', () => {
    // 1. e4 e5
    controller.makeMove('e2', 'e4');
    controller.makeMove('e7', 'e5');
    // 2. Bc4 Nc6
    controller.makeMove('f1', 'c4');
    controller.makeMove('b8', 'c6');
    // 3. Qh5 Nf6
    controller.makeMove('d1', 'h5');
    controller.makeMove('g8', 'f6');
    // 4. Qxf7#
    const mateMove = controller.makeMove('h5', 'f7');
    expect(mateMove).not.toBeNull();
    expect(mateMove?.san).toBe('Qxf7#');

    expect(controller.isCheck()).toBe(true);
    expect(controller.isCheckmate()).toBe(true);
    expect(controller.isGameOver()).toBe(true);
    expect(controller.getGameResult()).toBe('1-0');
  });

  it('detecta empate por afogamento (stalemate)', () => {
    // Posição clássica de afogamento: Rei preto em a8, Dama branca em c7, Rei branco em a6
    // FEN: 7k/8/8/8/8/8/2Q5/K7 w - - 0 1 -> não afogado ainda, mas vamos carregar uma posição de afogamento direta:
    // Rei preto em h8, Rei branco em f7, Peão preto em h7...
    // 5k2/5P2/5K2/8/8/8/8/8 b - - 0 1 (Pretas jogam e não têm lance legal, mas não estão em xeque)
    const stalemateFen = '5k2/5P2/5K2/8/8/8/8/8 b - - 0 1';
    controller.loadFen(stalemateFen);

    expect(controller.turn()).toBe('b');
    expect(controller.isCheck()).toBe(false);
    expect(controller.isStalemate()).toBe(true);
    expect(controller.isDraw()).toBe(true);
    expect(controller.isGameOver()).toBe(true);
    expect(controller.getGameResult()).toBe('1/2-1/2');
  });

  it('suporta ida e volta de FEN', () => {
    const customFen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
    controller.loadFen(customFen);
    expect(controller.getFen()).toBe(customFen);
    expect(controller.turn()).toBe('w');

    controller.makeMove('f1', 'c4');
    const newFen = controller.getFen();
    expect(newFen).not.toBe(customFen);

    controller.loadFen(customFen);
    expect(controller.getFen()).toBe(customFen);
  });

  it('detecta empate por repetição tripla', () => {
    // Repetir Nf3 Nf6 Ng1 Ng8 três vezes
    controller.makeMove('g1', 'f3');
    controller.makeMove('g8', 'f6');
    controller.makeMove('f3', 'g1');
    controller.makeMove('f6', 'g8'); // 1ª repetição

    controller.makeMove('g1', 'f3');
    controller.makeMove('g8', 'f6');
    controller.makeMove('f3', 'g1');
    controller.makeMove('f6', 'g8'); // 2ª repetição (3 ocorrências da posição)

    expect(controller.isThreefoldRepetition()).toBe(true);
    expect(controller.isDraw()).toBe(true);
  });

  it('detecta empate por insuficiência de material', () => {
    // Rei contra Rei
    controller.loadFen('8/8/8/4k3/8/8/4K3/8 w - - 0 1');
    expect(controller.isInsufficientMaterial()).toBe(true);
    expect(controller.isDraw()).toBe(true);
    expect(controller.isGameOver()).toBe(true);
  });

  it('lista lances legais com getLegalMoves e getLegalMovesForSquare', () => {
    const allMoves = controller.getLegalMoves();
    expect(allMoves.length).toBe(20); // 16 de peão + 4 de cavalo

    const e2Moves = controller.getLegalMovesForSquare('e2');
    expect(e2Moves.length).toBe(2); // e3 e e4
    expect(e2Moves.map(m => m.to).sort()).toEqual(['e3', 'e4']);
  });

  it('BUG-09: trata FEN inválida sem lançar exceção não tratada', () => {
    // loadFen deve retornar false e não explodir
    const result = controller.loadFen('fen_totalmente_invalida_123');
    expect(result).toBe(false);

    // Construtor com FEN inválida deve usar posição inicial segura sem explodir
    expect(() => new GameController('invalida')).not.toThrow();
    const safeController = new GameController('invalida');
    expect(safeController.getFen()).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');

    // newGame com FEN inválida
    expect(() => controller.newGame('invalida')).not.toThrow();
    expect(controller.getFen()).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  });
});
