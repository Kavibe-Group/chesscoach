// Assessment module - evaluates the player's level
// Uses puzzle battery + calibration game to estimate Elo

import type { AssessmentPuzzle } from '../data/puzzles.js';
import { ASSESSMENT_PUZZLES } from '../data/puzzles.js';
import { createProfile } from '../profile/ProfileManager.js';
import type { PlayerProfile } from '../profile/ProfileManager.js';

export interface PuzzleResult {
  puzzleId: string;
  correct: boolean;
  playerMove: string; // UCI format
  timeMs: number;
}

export interface AssessmentResult {
  puzzleResults: PuzzleResult[];
  puzzleScore: number;        // weighted score 0-1
  calibrationAcpl: number;    // ACPL from calibration game
  estimatedElo: number;
  eloBand: string;
}

// Scoring: weight correct answers by difficulty
export function calculatePuzzleScore(results: PuzzleResult[]): number {
  let totalWeight = 0;
  let earnedWeight = 0;

  for (const r of results) {
    const puzzle = ASSESSMENT_PUZZLES.find(p => p.id === r.puzzleId);
    if (!puzzle) continue;
    totalWeight += puzzle.difficulty;
    if (r.correct) {
      earnedWeight += puzzle.difficulty;
    }
  }

  return totalWeight > 0 ? earnedWeight / totalWeight : 0;
}

// Estimate Elo from puzzle score + calibration ACPL
export function estimateElo(puzzleScore: number, calibrationAcpl: number): number {
  // Puzzle score component (0-1 → 400-1600 range)
  const puzzleElo = 400 + puzzleScore * 1200;

  // ACPL component (lower ACPL → higher Elo)
  let acplElo: number;
  if (calibrationAcpl > 200) acplElo = 500;
  else if (calibrationAcpl > 150) acplElo = 700;
  else if (calibrationAcpl > 100) acplElo = 900;
  else if (calibrationAcpl > 70) acplElo = 1100;
  else if (calibrationAcpl > 50) acplElo = 1300;
  else if (calibrationAcpl > 35) acplElo = 1500;
  else acplElo = 1700;

  // Weighted average: 40% puzzles, 60% calibration game
  const elo = Math.round(puzzleElo * 0.4 + acplElo * 0.6);

  // Clamp to reasonable range
  return Math.max(400, Math.min(2000, elo));
}

export function getEloBandLabel(elo: number): string {
  if (elo < 800) return 'Iniciante (< 800)';
  if (elo < 1000) return 'Iniciante (800–1000)';
  if (elo < 1200) return 'Intermediário (1000–1200)';
  if (elo < 1400) return 'Intermediário (1200–1400)';
  if (elo < 1600) return 'Avançado (1400–1600)';
  return 'Avançado (1600+)';
}

export function completeAssessment(
  puzzleResults: PuzzleResult[],
  calibrationAcpl: number,
): AssessmentResult {
  const puzzleScore = calculatePuzzleScore(puzzleResults);
  const estimatedElo = estimateElo(puzzleScore, calibrationAcpl);
  const eloBand = getEloBandLabel(estimatedElo);

  // Create and persist the profile
  createProfile(estimatedElo);

  return {
    puzzleResults,
    puzzleScore,
    calibrationAcpl,
    estimatedElo,
    eloBand,
  };
}

export function getPuzzlesForAssessment(): AssessmentPuzzle[] {
  return [...ASSESSMENT_PUZZLES];
}

export function checkPuzzleSolution(puzzleId: string, playerMove: string): boolean {
  const puzzle = ASSESSMENT_PUZZLES.find(p => p.id === puzzleId);
  if (!puzzle) return false;
  return playerMove === puzzle.solution;
}
