import { describe, it, expect, beforeEach } from 'vitest';
import {
  getTrainingQueue,
  addTrainingPosition,
  recordTrainingAttempt,
  getActiveTrainingPositions,
  getMasteredCount,
  getTotalTrainingCount,
  getDailyPuzzles,
} from './TrainingManager';
import {
  createProfile,
  getProfile,
  updateEloAfterGame,
  getDominantErrorCategory,
} from '../profile/ProfileManager';
import { getStorage } from '../storage';

describe('TrainingManager & Progressão (Fase 4 - Treino dos Próprios Erros)', () => {
  beforeEach(() => {
    getStorage().clear();
  });

  it('adiciona erros reais à fila de treino sem duplicatas', () => {
    const fen1 = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
    addTrainingPosition({
      fen: fen1,
      bestMove: 'h5f7',
      bestMoveSan: 'Qxf7#',
      playerMove: 'Qe2',
      explanation: 'Havia mate em 1 com Qxf7#.',
      errorType: 'erro_grave',
      cpLoss: 9999,
      gameIndex: 1,
    });

    expect(getTotalTrainingCount()).toBe(1);
    expect(getActiveTrainingPositions().length).toBe(1);

    // Tentativa de adicionar a mesma FEN não duplica
    addTrainingPosition({
      fen: fen1,
      bestMove: 'h5f7',
      bestMoveSan: 'Qxf7#',
      playerMove: 'Qe2',
      explanation: 'Havia mate em 1.',
      errorType: 'erro_grave',
      cpLoss: 9999,
      gameIndex: 2,
    });
    expect(getTotalTrainingCount()).toBe(1);
  });

  it('marca posição como dominada após 2 acertos consecutivos e remove dos ativos', () => {
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
    addTrainingPosition({
      fen,
      bestMove: 'f1c4',
      bestMoveSan: 'Bc4',
      playerMove: 'd1d7',
      explanation: 'Dama pendurada em d7.',
      errorType: 'erro_grave',
      cpLoss: 800,
      gameIndex: 1,
    });

    const queue = getTrainingQueue();
    const id = queue[0].id;

    // 1º acerto: não dominado ainda
    let pos = recordTrainingAttempt(id, true);
    expect(pos?.correct).toBe(1);
    expect(pos?.consecutiveCorrect).toBe(1);
    expect(pos?.mastered).toBe(false);
    expect(getActiveTrainingPositions().length).toBe(1);

    // 1 erro: reseta consecutivos
    pos = recordTrainingAttempt(id, false);
    expect(pos?.consecutiveCorrect).toBe(0);
    expect(pos?.mastered).toBe(false);

    // 2 acertos seguidos
    recordTrainingAttempt(id, true);
    pos = recordTrainingAttempt(id, true);
    expect(pos?.consecutiveCorrect).toBe(2);
    expect(pos?.mastered).toBe(true);

    // Agora saiu dos ativos
    expect(getActiveTrainingPositions().length).toBe(0);
    expect(getMasteredCount()).toBe(1);
  });

  it('adapta o Elo do jogador após a partida em passos controlados (15 a 30 pontos)', () => {
    const profile = createProfile(1200);

    // Vitória com bom ACPL (jogo consistente)
    const winStats = {
      accuracy: 85,
      acpl: 40,
      moveCount: 20,
      excellentMoves: 15,
      goodMoves: 3,
      inaccuracies: 1,
      mistakes: 1,
      blunders: 0,
      result: '1-0',
      date: new Date().toISOString(),
    };

    updateEloAfterGame(profile, winStats);
    const updated = getProfile();
    expect(updated?.estimatedElo).toBeGreaterThan(1200);
    expect(updated?.estimatedElo).toBeLessThanOrEqual(1230); // Subida suave de até 30 pontos
    expect(updated?.gamesPlayed).toBe(1);
  });

  it('determina a categoria dominante de erro para sugerir a minilição correta', () => {
    const profile = createProfile(1000);
    const gameStats = {
      accuracy: 60,
      acpl: 120,
      moveCount: 25,
      excellentMoves: 10,
      goodMoves: 5,
      inaccuracies: 2,
      mistakes: 1,
      blunders: 4, // blunders dominam
      result: '0-1',
      date: new Date().toISOString(),
    };

    updateEloAfterGame(profile, gameStats);
    const updated = getProfile();
    const dominant = getDominantErrorCategory(updated!);
    expect(dominant).toBe('erro_grave');
  });

  it('Fase 3: avança níveis de repetição espaçada (SRS) e reseta em caso de erro', () => {
    const fen = '8/8/8/8/8/8/4k3/4K2R w - - 0 1';
    addTrainingPosition({
      fen,
      bestMove: 'h1h2',
      bestMoveSan: 'Rh2',
      playerMove: 'h1g1',
      explanation: 'Torre na segunda fileira.',
      errorType: 'erro',
      cpLoss: 200,
      gameIndex: 1,
      category: 'posicional',
    });

    const queue = getTrainingQueue();
    const id = queue[0].id;

    // Inicialmente no nível 0
    expect(queue[0].srsLevel).toBe(0);

    // 1º acerto -> nível 1
    let pos = recordTrainingAttempt(id, true);
    expect(pos?.srsLevel).toBe(1);
    expect(pos?.nextReviewDate).toBeDefined();

    // 2º acerto -> nível 2 e masterizado
    pos = recordTrainingAttempt(id, true);
    expect(pos?.srsLevel).toBe(2);
    expect(pos?.mastered).toBe(true);

    // Erro subsequente -> reseta nível para 0
    pos = recordTrainingAttempt(id, false);
    expect(pos?.srsLevel).toBe(0);
    expect(pos?.consecutiveCorrect).toBe(0);
  });

  it('Fase 3: getDailyPuzzles completa a meta diária de 5 puzzles mesmo com poucos erros reais', () => {
    // Fila vazia
    const daily = getDailyPuzzles(5);
    expect(daily.length).toBe(5);
    // Como a fila estava vazia, completou com o acervo curado
    expect(daily.every(p => p.bestMove && p.fen)).toBe(true);
  });
});
