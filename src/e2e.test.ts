import { describe, it, expect, beforeEach } from 'vitest';
import { GameController } from './game/GameController';
import {
  getPuzzlesForAssessment,
  checkPuzzleSolution,
  completeAssessment,
} from './assessment/index';
import {
  getProfile,
  updateEloAfterGame,
  getDominantErrorCategory,
  type GameStats,
} from './profile/index';
import {
  addTrainingPosition,
  getActiveTrainingPositions,
  recordTrainingAttempt,
  getMasteredCount,
} from './training/index';
import { analyzeMoveQuality, type PositionContext } from './analysis/index';
import { getStorage } from './storage';

describe('Fluxo Completo de Ponta a Ponta (E2E Domain Flow)', () => {
  beforeEach(() => {
    getStorage().clear();
  });

  it('executa a jornada completa: primeira vez -> avaliação -> partida com feedback -> revisão -> treino de erro dominado', () => {
    // 1. PRIMEIRA VEZ: Usuário não tem perfil salvo ainda
    expect(getProfile()).toBeNull();

    // 2. AVALIAÇÃO DE NÍVEL: O usuário resolve a bateria de 12 posições
    const puzzles = getPuzzlesForAssessment();
    expect(puzzles.length).toBe(12);

    const puzzleResults = puzzles.map((p, index) => {
      // Simula um jogador intermediário acertando 8 de 12 exercícios
      const willSucceed = index < 8;
      const move = willSucceed ? p.solution : 'a2a3';
      const isCorrect = checkPuzzleSolution(p.id, move);
      return {
        puzzleId: p.id,
        correct: isCorrect,
        playerMove: move,
        timeMs: 2500,
      };
    });

    // Conclui avaliação com ACPL de calibração ~75 cp
    const assessmentResult = completeAssessment(puzzleResults, 75);
    expect(assessmentResult.estimatedElo).toBeGreaterThanOrEqual(1000);
    expect(assessmentResult.estimatedElo).toBeLessThanOrEqual(1400);

    // Perfil persistido
    const initialProfile = getProfile();
    expect(initialProfile).not.toBeNull();
    expect(initialProfile?.assessmentCompleted).toBe(true);
    const startElo = initialProfile!.estimatedElo;

    // 3. PARTIDA COM FEEDBACK PÓS-LANCE
    const game = new GameController();
    const playerMoveAnalyses = [];

    // Lance 1: 1. e4 (Excelente)
    const fenBefore1 = game.getFen();
    const m1 = game.makeMove('e2', 'e4');
    expect(m1).not.toBeNull();
    const fenAfter1 = game.getFen();

    const analysis1 = analyzeMoveQuality({
      fen: fenAfter1,
      moveNumber: 1,
      playerColor: 'w',
      evalBefore: 20,
      mateBefore: null,
      bestMoveUci: 'e2e4',
      bestMoveSan: 'e4',
      pvBefore: ['e2e4', 'e7e5'],
      evalAfter: 20,
      mateAfter: null,
      playerMoveSan: 'e4',
      playerMoveUci: 'e2e4',
      fenBefore: fenBefore1,
      fenAfter: fenAfter1,
    });
    expect(analysis1.quality).toBe('excelente');
    expect(analysis1.explanation).toContain('melhor lance');
    playerMoveAnalyses.push(analysis1);

    // Resposta do motor: 1... e5
    game.makeMove('e7', 'e5');

    // Lance 2: 2. Nf3 (Desenvolvimento na abertura)
    const fenBefore2 = game.getFen();
    game.makeMove('g1', 'f3');
    const fenAfter2 = game.getFen();

    const analysis2 = analyzeMoveQuality({
      fen: fenAfter2,
      moveNumber: 2,
      playerColor: 'w',
      evalBefore: 25,
      mateBefore: null,
      bestMoveUci: 'g1f3',
      bestMoveSan: 'Nf3',
      pvBefore: ['g1f3', 'b8c6'],
      evalAfter: 25,
      mateAfter: null,
      playerMoveSan: 'Nf3',
      playerMoveUci: 'g1f3',
      fenBefore: fenBefore2,
      fenAfter: fenAfter2,
    });
    expect(analysis2.quality).toBe('excelente');
    expect(analysis2.explanation).toContain('desenvolvimento');
    playerMoveAnalyses.push(analysis2);

    // Resposta do motor: 2... Nc6
    game.makeMove('b8', 'c6');

    // Lance 3: Jogador joga 3. Ng5 (lance legal de cavalo)
    const fenBefore3 = game.getFen();
    const m3 = game.makeMove('f3', 'g5');
    expect(m3).not.toBeNull();
    const fenAfter3 = game.getFen();

    const analysis3 = analyzeMoveQuality({
      fen: fenAfter3,
      moveNumber: 3,
      playerColor: 'w',
      evalBefore: 30,
      mateBefore: null,
      bestMoveUci: 'f1c4',
      bestMoveSan: 'Bc4',
      pvBefore: ['f1c4', 'g8f6'],
      evalAfter: -100, // Perdeu 130 cp (Erro)
      mateAfter: null,
      playerMoveSan: 'Ng5',
      playerMoveUci: 'f3g5',
      fenBefore: fenBefore3,
      fenAfter: fenAfter3,
    });
    expect(analysis3.quality).toBe('erro');
    expect(analysis3.isRetryable).toBe(true);
    playerMoveAnalyses.push(analysis3);

    // O erro entra na fila de treino automaticamente
    addTrainingPosition({
      fen: fenBefore3,
      bestMove: 'f1c4',
      bestMoveSan: 'Bc4',
      playerMove: 'Ng5',
      explanation: analysis3.explanation,
      errorType: analysis3.quality,
      cpLoss: analysis3.cpLoss,
      gameIndex: 1,
    });

    // 4. REVISÃO PÓS-PARTIDA E PROGRESSÃO
    const stats: GameStats = {
      accuracy: 67, // 2 excelentes de 3
      acpl: 45,
      moveCount: 3,
      excellentMoves: 2,
      goodMoves: 0,
      inaccuracies: 0,
      mistakes: 1,
      blunders: 0,
      result: '1-0', // vitória do jogador
      date: new Date().toISOString(),
    };

    updateEloAfterGame(initialProfile!, stats);
    const updatedProfile = getProfile();
    expect(updatedProfile?.gamesPlayed).toBe(1);
    expect(updatedProfile?.estimatedElo).toBeGreaterThan(startElo); // Elo subiu após vitória

    const dominantCategory = getDominantErrorCategory(updatedProfile!);
    expect(dominantCategory).toBe('erro');

    // 5. TREINAR MEUS ERROS: O erro real da partida está na fila
    const activePositions = getActiveTrainingPositions();
    expect(activePositions.length).toBe(1);
    const pos = activePositions[0];
    expect(pos.fen).toBe(fenBefore3);
    expect(pos.bestMove).toBe('f1c4');

    // O jogador resolve o exercício corretamente (1ª vez)
    recordTrainingAttempt(pos.id, true);
    expect(getActiveTrainingPositions().length).toBe(1); // ainda precisa do 2º acerto

    // O jogador resolve o exercício corretamente (2ª vez consecutiva)
    recordTrainingAttempt(pos.id, true);

    // Agora o exercício está DOMINADO e saiu da fila ativa!
    expect(getActiveTrainingPositions().length).toBe(0);
    expect(getMasteredCount()).toBe(1);
  });
});
