import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameScreen } from './GameScreen';
import { getStorage } from '../../storage';

// Mock das visualizações DOM pesadas do Chessground
vi.mock('../ChessBoard', () => {
  return {
    ChessBoard: class {
      sync = vi.fn();
      clearShapes = vi.fn();
      setInteractive = vi.fn();
      showBestMove = vi.fn();
      destroy = vi.fn();
      onMove = vi.fn();
    },
  };
});

vi.mock('../ClockView', () => {
  return {
    ClockView: class {
      start = vi.fn();
      pause = vi.fn();
      switchTurn = vi.fn();
      destroy = vi.fn();
      onTimeOut = vi.fn();
    },
  };
});

function createMockContainer(): HTMLElement {
  return {
    innerHTML: '',
    querySelector: vi.fn().mockReturnValue({
      addEventListener: vi.fn(),
      textContent: '',
    }),
    querySelectorAll: vi.fn().mockReturnValue([]),
    appendChild: vi.fn(),
  } as unknown as HTMLElement;
}

describe('GameScreen - BUG-01 (Fluxo de Tentar de Novo e Cancelamento)', () => {
  beforeEach(() => {
    getStorage().clear();
  });

  it('desfaz ambos os lances (resposta do motor + erro do jogador) quando o motor já respondeu', async () => {
    const container = createMockContainer();
    const screen = new GameScreen(container, {
      onGameOver: vi.fn(),
      onExit: vi.fn(),
    });

    const game = (screen as any).game;
    const initialFen = game.getFen();

    // 1. Jogador joga 1. e4
    game.makeMove('e2', 'e4');
    (screen as any).lastFenBeforePlayerMove = initialFen;

    // 2. Motor responde 1... e5
    game.makeMove('e7', 'e5');
    const fenBeforeBlunder = game.getFen();
    (screen as any).lastFenBeforePlayerMove = fenBeforeBlunder;

    // 3. Jogador comete erro 2. f3
    game.makeMove('f2', 'f3');
    (screen as any).analyzedMoves.push({
      quality: 'erro',
      playerMove: 'f3',
      cpLoss: 150,
    });

    // 4. Motor responde ao erro: 2... Qh4+
    game.makeMove('d8', 'h4');

    expect(game.getHistory().length).toBe(4);
    expect(game.turn()).toBe('w'); // É a vez do jogador agora

    // O jogador clica em "Tentar de novo"
    screen.handleRetryMove();

    // Deve ter desfeito TANTO o lance do motor quanto o erro do jogador!
    expect(game.getHistory().length).toBe(2);
    expect(game.getHistory().map((m: any) => m.san)).toEqual(['e4', 'e5']);
    expect(game.getFen()).toBe(fenBeforeBlunder);
    expect(game.turn()).toBe('w'); // Continua sendo a vez do jogador
    expect((screen as any).analyzedMoves.length).toBe(0);

    screen.destroy();
  });

  it('aborta busca do motor se o jogador clicar em tentar de novo enquanto o motor pensa', async () => {
    const container = createMockContainer();
    const screen = new GameScreen(container, {
      onGameOver: vi.fn(),
      onExit: vi.fn(),
    });

    const game = (screen as any).game;
    const initialFen = game.getFen();

    // 1. Jogador joga 1. e4
    game.makeMove('e2', 'e4');
    (screen as any).analyzedMoves.push({
      quality: 'erro',
      playerMove: 'e4',
      cpLoss: 100,
    });

    // Simula estado em que o motor está pensando
    (screen as any).isEngineThinking = true;
    const stopSpy = vi.spyOn((screen as any).opponentEngine, 'stop').mockImplementation(() => {});

    // O jogador clica em "Tentar de novo" imediatamente
    screen.handleRetryMove();

    expect(stopSpy).toHaveBeenCalled();
    expect((screen as any).isEngineThinking).toBe(false);
    expect((screen as any).engineMoveAborted).toBe(true);

    // O erro do jogador foi desfeito
    expect(game.getHistory().length).toBe(0);
    expect(game.getFen()).toBe(initialFen);
    expect(game.turn()).toBe('w');

    screen.destroy();
  });
});
