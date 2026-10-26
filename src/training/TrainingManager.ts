// Training module - manages the error training queue and Spaced Repetition System (SRS)
// Positions from player's real errors, supplemented by curated daily puzzles

import { getStorage } from '../storage.js';
import { ASSESSMENT_PUZZLES } from '../data/puzzles.js';
import type { TacticalCategory } from '../analysis/MoveAnalyzer.js';

export interface TrainingPosition {
  id: string;
  fen: string;              // position where the error happened
  bestMove: string;         // correct move in UCI
  bestMoveSan: string;      // correct move in SAN
  playerMove: string;       // wrong move played (SAN)
  explanation: string;      // why best move is better
  errorType: string;        // 'imprecisao' | 'erro' | 'erro_grave' | 'puzzle_diario'
  cpLoss: number;
  attempts: number;         // how many times attempted
  correct: number;          // how many times solved correctly
  mastered: boolean;        // true when solved correctly 2+ times in a row
  consecutiveCorrect: number;
  dateAdded: string;
  gameIndex: number;        // which game it came from
  category?: TacticalCategory;
  srsLevel?: number;        // 0 to 4 (Spaced Repetition interval level)
  nextReviewDate?: string;  // ISO string for next review
  lastReviewedDate?: string;
  isCuratedPuzzle?: boolean;
}

const TRAINING_KEY = 'xadrez-coach-training';

// Intervalos de revisão do SRS em dias por nível [0, 1, 2, 3, 4]
const SRS_INTERVALS_DAYS = [0, 1, 3, 7, 14];

export function getTrainingQueue(): TrainingPosition[] {
  const data = getStorage().getItem(TRAINING_KEY);
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(p => p && typeof p === 'object' && typeof p.fen === 'string');
  } catch {
    return [];
  }
}

export function saveTrainingQueue(queue: TrainingPosition[]): void {
  getStorage().setItem(TRAINING_KEY, JSON.stringify(queue));
}

export function addTrainingPosition(pos: Omit<TrainingPosition, 'id' | 'attempts' | 'correct' | 'mastered' | 'consecutiveCorrect' | 'dateAdded'>): void {
  const queue = getTrainingQueue();

  // Não adiciona duplicatas (mesma FEN)
  if (queue.some(p => p.fen === pos.fen)) return;

  const now = new Date();
  const newPos: TrainingPosition = {
    ...pos,
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `train-${Date.now()}-${Math.random()}`,
    attempts: 0,
    correct: 0,
    mastered: false,
    consecutiveCorrect: 0,
    dateAdded: now.toISOString(),
    srsLevel: 0,
    nextReviewDate: now.toISOString(),
  };

  queue.push(newPos);
  saveTrainingQueue(queue);
}

export function removeTrainingPosition(fen: string): void {
  const queue = getTrainingQueue();
  const filtered = queue.filter(p => p.fen !== fen);
  if (filtered.length !== queue.length) {
    saveTrainingQueue(filtered);
  }
}

export function recordTrainingAttempt(id: string, wasCorrect: boolean): TrainingPosition | null {
  const queue = getTrainingQueue();
  const pos = queue.find(p => p.id === id);
  if (!pos) return null;

  const now = new Date();
  pos.attempts += 1;
  pos.lastReviewedDate = now.toISOString();

  if (wasCorrect) {
    pos.correct += 1;
    pos.consecutiveCorrect += 1;
    pos.srsLevel = Math.min(4, (pos.srsLevel ?? 0) + 1);

    // Dominado após 2 acertos consecutivos
    if (pos.consecutiveCorrect >= 2) {
      pos.mastered = true;
    }

    // Calcula próxima data de repetição espaçada
    const intervalDays = SRS_INTERVALS_DAYS[pos.srsLevel] ?? 1;
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + intervalDays);
    pos.nextReviewDate = nextDate.toISOString();
  } else {
    pos.consecutiveCorrect = 0;
    pos.srsLevel = 0;
    pos.nextReviewDate = now.toISOString(); // Revisão imediata
  }

  saveTrainingQueue(queue);
  return pos;
}

export function getActiveTrainingPositions(): TrainingPosition[] {
  return getTrainingQueue().filter(p => !p.mastered);
}

export function getMasteredCount(): number {
  return getTrainingQueue().filter(p => p.mastered).length;
}

export function getTotalTrainingCount(): number {
  return getTrainingQueue().length;
}

/**
 * Retorna posições agendadas para revisão pelo SRS (data <= agora)
 */
export function getDueTrainingPositions(): TrainingPosition[] {
  const nowIso = new Date().toISOString();
  return getTrainingQueue().filter(p => !p.mastered || (p.nextReviewDate && p.nextReviewDate <= nowIso));
}

/**
 * Retorna a sessão de Puzzles Diários (puzzles devidos do SRS + acervo curado para completar a meta)
 */
export function getDailyPuzzles(limit = 5): TrainingPosition[] {
  const queue = getTrainingQueue();
  const nowIso = new Date().toISOString();

  // 1. Posições de erros reais que estão prontas para revisão hoje
  const due = queue.filter(p => !p.nextReviewDate || p.nextReviewDate <= nowIso);

  // 2. Outras posições ativas da fila
  const otherActive = queue.filter(p => !p.mastered && !due.includes(p));

  const result: TrainingPosition[] = [...due, ...otherActive];

  // 3. Se ainda não atingiu o limite, completa com puzzles curados do acervo
  if (result.length < limit) {
    for (const puzzle of ASSESSMENT_PUZZLES) {
      if (result.length >= limit) break;
      if (result.some(r => r.fen === puzzle.fen)) continue;

      result.push({
        id: `curated-${puzzle.id}`,
        fen: puzzle.fen,
        bestMove: puzzle.solution,
        bestMoveSan: puzzle.solutionSan,
        playerMove: '—',
        explanation: puzzle.description,
        errorType: 'puzzle_diario',
        cpLoss: 500,
        attempts: 0,
        correct: 0,
        mastered: false,
        consecutiveCorrect: 0,
        dateAdded: nowIso,
        gameIndex: 0,
        category: 'posicional',
        srsLevel: 0,
        nextReviewDate: nowIso,
        isCuratedPuzzle: true,
      });
    }
  }

  return result.slice(0, limit);
}
