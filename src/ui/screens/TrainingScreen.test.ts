import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TrainingScreen } from './TrainingScreen';
import { addTrainingPosition } from '../../training/TrainingManager';
import { getStorage } from '../../storage';

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

function createMockContainer(): HTMLElement {
  const listeners: Record<string, Function> = {};
  return {
    innerHTML: '',
    querySelector: vi.fn().mockImplementation((selector: string) => ({
      addEventListener: vi.fn((event: string, cb: Function) => {
        listeners[`${selector}:${event}`] = cb;
      }),
      click: () => {
        if (listeners[`${selector}:click`]) {
          listeners[`${selector}:click`]();
        }
      },
      textContent: '',
      style: {},
      className: '',
    })),
    querySelectorAll: vi.fn().mockReturnValue([]),
    appendChild: vi.fn(),
  } as unknown as HTMLElement;
}

describe('TrainingScreen - BUG-06 (Avançar índice de exercício ao clicar próximo)', () => {
  beforeEach(() => {
    getStorage().clear();
  });

  it('incrementa currentIdx ao clicar em próximo exercício quando o exercício não foi dominado', () => {
    // Adiciona dois erros distintos à fila de treino
    addTrainingPosition({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      bestMove: 'e2e4',
      bestMoveSan: 'e4',
      playerMove: 'a2a3',
      explanation: 'Erro 1',
      errorType: 'erro',
      cpLoss: 100,
      gameIndex: 1,
    });

    addTrainingPosition({
      fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
      bestMove: 'f1c4',
      bestMoveSan: 'Bc4',
      playerMove: 'd2d3',
      explanation: 'Erro 2',
      errorType: 'erro',
      cpLoss: 120,
      gameIndex: 1,
    });

    const container = createMockContainer();
    const screen = new TrainingScreen(container, {
      onBack: vi.fn(),
    });

    expect((screen as any).queue.length).toBe(2);
    expect((screen as any).currentIdx).toBe(0);

    // Jogador erra o exercício 1
    (screen as any).handlePlayerMove('h2h3');
    // Exercício 1 ainda está na fila (precisa de 2 acertos, teve 0)
    expect((screen as any).queue.length).toBe(2);

    // Clica em "Próximo exercício"
    const btnNext = container.querySelector('#btn-next-training') as any;
    btnNext.click();

    // Deve ter avançado para o índice 1 (Erro 2)
    expect((screen as any).currentIdx).toBe(1);

    // Clica em "Próximo exercício" novamente
    btnNext.click();

    // Deve voltar ao índice 0 em rotação circular
    expect((screen as any).currentIdx).toBe(0);

    screen.destroy();
  });
});
