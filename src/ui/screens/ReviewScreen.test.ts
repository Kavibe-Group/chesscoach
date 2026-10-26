import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReviewScreen } from './ReviewScreen';
import type { ReviewData } from './ReviewScreen';
import { getStorage } from '../../storage';
import { createProfile, getProfile } from '../../profile/index';

vi.mock('chessground', () => {
  return {
    Chessground: vi.fn(() => ({
      set: vi.fn(),
      setAutoShapes: vi.fn(),
      state: {},
      getFen: vi.fn(),
      destroy: vi.fn(),
    })),
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
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
      },
    })),
    querySelectorAll: vi.fn().mockReturnValue([]),
    appendChild: vi.fn(),
  } as unknown as HTMLElement;
}

describe('ReviewScreen - Fase 2 & 4 (Análise Pós-Partida Completa & Elo Dinâmico)', () => {
  beforeEach(() => {
    getStorage().clear();
    createProfile(1200);
  });

  it('calcula o Elo delta dinâmico e atualiza o perfil pós-jogo', () => {
    const container = createMockContainer();
    const mockData: ReviewData = {
      accuracy: 85,
      acpl: 45, // Muito abaixo do alvo (~100), jogador jogou muito bem
      moveCount: 20,
      excellentMoves: 15,
      goodMoves: 3,
      inaccuracies: 2,
      mistakes: 0,
      blunders: 0,
      result: '1-0', // Vitória
      mistakesHistory: [],
    };

    const screen = new ReviewScreen(container, mockData, {
      onPlayAgain: vi.fn(),
      onGoTraining: vi.fn(),
      onGoHome: vi.fn(),
    });

    const profile = getProfile();
    expect(profile).toBeDefined();
    // Vitória (+15) + ACPL excelente (+15) = +30 Elo
    expect(profile!.estimatedElo).toBe(1230);
    expect((screen as any).eloDelta).toBe(30);

    screen.destroy();
  });

  it('reconstrói a linha do tempo lance a lance e permite pular para o próximo erro', () => {
    const container = createMockContainer();
    const mockData: ReviewData = {
      accuracy: 60,
      acpl: 120,
      moveCount: 4,
      excellentMoves: 1,
      goodMoves: 0,
      inaccuracies: 0,
      mistakes: 0,
      blunders: 1,
      result: '0-1',
      mistakesHistory: [{
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
        playerMove: 'd7',
        bestMove: 'f1c4',
        bestMoveSan: 'Bc4',
        explanation: 'Erro grave! Perdeu a dama.',
        quality: 'erro_grave',
        cpLoss: 850,
      }],
      pgn: '1. e4 e5 2. Nf3 Nc6 3. Qd7',
      playerColor: 'white',
      analyzedMoves: [
        {
          quality: 'excelente',
          label: 'Excelente',
          color: '#15781b',
          cpLoss: 0,
          evalBefore: 20,
          evalAfter: 20,
          mateBefore: null,
          mateAfter: null,
          bestMove: 'e2e4',
          bestMoveSan: 'e4',
          explanation: 'Excelente! Este era o melhor lance.',
          playerMove: 'e4',
          playerMoveUci: 'e2e4',
          isRetryable: false,
          category: 'posicional',
          categoryLabel: 'Posicional',
          shapes: [],
          refutationPv: [],
        },
        {
          quality: 'erro_grave',
          label: 'Erro Grave',
          color: '#ca3431',
          cpLoss: 850,
          evalBefore: 30,
          evalAfter: -820,
          mateBefore: null,
          mateAfter: null,
          bestMove: 'f1c4',
          bestMoveSan: 'Bc4',
          explanation: 'Erro grave! Perdeu a dama.',
          playerMove: 'Qd7',
          playerMoveUci: 'd1d7',
          isRetryable: true,
          category: 'troca_desfavoravel',
          categoryLabel: 'Troca Desfavorável',
          shapes: [{ orig: 'c8', dest: 'd7', brush: 'red' }],
          refutationPv: [{ uci: 'c8d7', san: 'Bxd7' }],
        },
      ],
    };

    const screen = new ReviewScreen(container, mockData, {
      onPlayAgain: vi.fn(),
      onGoTraining: vi.fn(),
      onGoHome: vi.fn(),
    });

    const replayMoves = (screen as any).replayMoves;
    expect(replayMoves.length).toBeGreaterThan(1);

    // Navega para ply 0 e depois salta para o próximo erro
    (screen as any).goToPly(0);
    expect((screen as any).currentReplayIndex).toBe(0);

    (screen as any).jumpToNextMistake();
    expect((screen as any).currentReplayIndex).toBeGreaterThan(0);

    const activeMove = replayMoves[(screen as any).currentReplayIndex];
    expect(activeMove.analysis?.quality).toBe('erro_grave');

    screen.destroy();
  });
});
