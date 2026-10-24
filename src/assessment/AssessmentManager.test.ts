import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculatePuzzleScore,
  estimateElo,
  getEloBandLabel,
  completeAssessment,
  checkPuzzleSolution,
  getPuzzlesForAssessment,
} from './AssessmentManager';
import { getProfile } from '../profile/ProfileManager';
import { eloToEngineConfig } from '../engine/StockfishEngine';
import { getStorage } from '../storage';
import type { PuzzleResult } from './AssessmentManager';

describe('AssessmentManager (Fase 3 - Avaliação de Nível)', () => {
  beforeEach(() => {
    getStorage().clear();
  });

  it('calcula pontuação ponderada das posições', () => {
    const puzzles = getPuzzlesForAssessment();
    const allCorrect: PuzzleResult[] = puzzles.map(p => ({
      puzzleId: p.id,
      correct: true,
      playerMove: p.solution,
      timeMs: 2000,
    }));
    expect(calculatePuzzleScore(allCorrect)).toBe(1);

    const noneCorrect: PuzzleResult[] = puzzles.map(p => ({
      puzzleId: p.id,
      correct: false,
      playerMove: 'e2e4',
      timeMs: 2000,
    }));
    expect(calculatePuzzleScore(noneCorrect)).toBe(0);
  });

  it('verifica soluções corretas e incorretas nos puzzles', () => {
    expect(checkPuzzleSolution('mate1-1', 'b2b8')).toBe(true);
    expect(checkPuzzleSolution('mate1-1', 'a1b1')).toBe(false);
  });

  it('respostas perfeitas produzem faixa de Elo muito maior que respostas erradas (sanidade do escore)', () => {
    const perfectScore = 1.0;
    const perfectAcpl = 25; // ACPL muito baixo (ótimo jogo)
    const highElo = estimateElo(perfectScore, perfectAcpl);

    const zeroScore = 0.0;
    const poorAcpl = 250; // ACPL muito alto (jogo fraco)
    const lowElo = estimateElo(zeroScore, poorAcpl);

    expect(highElo).toBeGreaterThan(lowElo);
    expect(highElo).toBeGreaterThanOrEqual(1600);
    expect(lowElo).toBeLessThan(800);

    const highBand = getEloBandLabel(highElo);
    const lowBand = getEloBandLabel(lowElo);
    expect(highBand).toContain('Avançado');
    expect(lowBand).toContain('Iniciante (< 800)');
  });

  it('completar a avaliação cria perfil persistido no localStorage e define força coerente do motor', () => {
    const puzzles = getPuzzlesForAssessment();
    const results: PuzzleResult[] = puzzles.map((p, idx) => ({
      puzzleId: p.id,
      correct: idx % 2 === 0, // 50% de acerto
      playerMove: p.solution,
      timeMs: 3000,
    }));

    const assessment = completeAssessment(results, 85);
    expect(assessment.estimatedElo).toBeGreaterThan(800);
    expect(assessment.eloBand).toBeDefined();

    // Perfil salvo no localStorage
    const savedProfile = getProfile();
    expect(savedProfile).not.toBeNull();
    expect(savedProfile?.estimatedElo).toBe(assessment.estimatedElo);
    expect(savedProfile?.assessmentCompleted).toBe(true);

    // Força inicial do motor coerente (+50 do Elo estimado)
    const engineConfig = eloToEngineConfig(savedProfile!.estimatedElo);
    if (savedProfile!.estimatedElo + 50 >= 1320) {
      expect(engineConfig.limitStrength).toBe(true);
      expect(engineConfig.uciElo).toBe(savedProfile!.estimatedElo + 50);
    } else {
      expect(engineConfig.skillLevel).toBeDefined();
    }
  });

  it('refazer a avaliação atualiza o perfil existente', () => {
    // 1ª avaliação fraca
    const weakResults: PuzzleResult[] = getPuzzlesForAssessment().map(p => ({
      puzzleId: p.id,
      correct: false,
      playerMove: 'e2e4',
      timeMs: 1000,
    }));
    completeAssessment(weakResults, 200);
    const profile1 = getProfile();
    expect(profile1?.estimatedElo).toBeLessThan(1000);

    // 2ª avaliação forte (reavaliação)
    const strongResults: PuzzleResult[] = getPuzzlesForAssessment().map(p => ({
      puzzleId: p.id,
      correct: true,
      playerMove: p.solution,
      timeMs: 1000,
    }));
    completeAssessment(strongResults, 30);
    const profile2 = getProfile();
    expect(profile2?.estimatedElo).toBeGreaterThan(1500);
  });
});
