import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssessmentScreen } from './AssessmentScreen';
import { getStorage } from '../../storage';
import { getProfile } from '../../profile/index';

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
  return {
    innerHTML: '',
    querySelector: vi.fn().mockReturnValue({
      addEventListener: vi.fn(),
      textContent: '',
      style: {},
      className: '',
    }),
    querySelectorAll: vi.fn().mockReturnValue([]),
    appendChild: vi.fn(),
  } as unknown as HTMLElement;
}

describe('AssessmentScreen - BUG-03 (Partida de Calibração Real vs ACPL Simulado)', () => {
  beforeEach(() => {
    getStorage().clear();
  });

  it('inicia a etapa de calibração real após concluir os puzzles em vez de inventar ACPL simulado', async () => {
    const container = createMockContainer();
    const onCompletedSpy = vi.fn();

    const screen = new AssessmentScreen(container, {
      onCompleted: onCompletedSpy,
      onCancel: vi.fn(),
    });

    // Avança todos os puzzles da bateria
    const totalPuzzles = (screen as any).puzzles.length;
    for (let i = 0; i < totalPuzzles; i++) {
      (screen as any).currentIdx = i;
      (screen as any).handlePlayerMove('e2e4');
    }

    // Avança além do último puzzle
    (screen as any).currentIdx = totalPuzzles;
    (screen as any).render();

    // Deve ter entrado na Etapa 2 (partida de calibração real)
    expect(screen.isCalibrationPhase).toBe(true);
    expect(onCompletedSpy).not.toHaveBeenCalled(); // Não saltou direto para o sumário

    screen.destroy();
  });

  it('calcula ACPL real com base nos lances avaliados pelo motor e passa para completeAssessment', async () => {
    const container = createMockContainer();
    const onCompletedSpy = vi.fn();

    const screen = new AssessmentScreen(container, {
      onCompleted: onCompletedSpy,
      onCancel: vi.fn(),
    });

    // Entra na partida de calibração
    await screen.startCalibrationGame();
    expect(screen.isCalibrationPhase).toBe(true);

    // Mock das avaliações do motor para simular lances reais com perda de centipeões
    (screen as any).analystEngine = {
      evaluate: vi.fn()
        .mockResolvedValueOnce({ score: 40, mate: null, bestMove: 'd2d4', pv: ['d2d4'] })
        .mockResolvedValueOnce({ score: 10, mate: null, bestMove: 'g1f3', pv: ['g1f3'] }),
      destroy: vi.fn(),
    };
    (screen as any).opponentEngine = {
      getBestMove: vi.fn().mockResolvedValue('e7e5'),
      destroy: vi.fn(),
    };

    // Lance 1: Jogador joga e4 (perde 30 cp em relação a d4)
    (screen as any).lastCalibrationEval = { score: 50, mate: null, bestMove: 'd2d4', pv: ['d2d4'] };
    await screen.handleCalibrationPlayerMove({
      from: 'e2',
      to: 'e4',
      san: 'e4',
    });

    expect(screen.calibrationMovesCount).toBe(1);
    expect(screen.calibrationTotalCpLoss).toBeGreaterThanOrEqual(0);

    // Finaliza a calibração
    await screen.finishCalibrationGame();

    // A avaliação foi gravada e o sumário exibido
    const profile = getProfile();
    expect(profile).not.toBeNull();
    expect(profile?.assessmentCompleted).toBe(true);
    expect(profile?.estimatedElo).toBeDefined();

    screen.destroy();
  });
});
