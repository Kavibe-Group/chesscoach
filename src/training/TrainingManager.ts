// Training module - manages the error training queue and Spaced Repetition System (SRS)
// Positions from player's real errors, supplemented by curated daily puzzles

import { getStorage } from '../storage.js';
import { TRAINING_PUZZLES } from '../data/trainingPuzzles.js';
import type { TacticalCategory } from '../analysis/MoveAnalyzer.js';

export interface TrainingPosition {
  solution?: readonly string[];
  source?: string;
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

export function recordTrainingAttempt(id: string, wasCorrect: boolean, assisted = false): TrainingPosition | null {
  const queue = getTrainingQueue();
  const pos = queue.find(p => p.id === id);
  if (!pos) return null;

  if (assisted) wasCorrect = false;
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
    pos.mastered = false;
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
  return getTrainingQueue().filter(p => !p.nextReviewDate || p.nextReviewDate <= nowIso);
}

/**
 * Retorna a sessão de Puzzles Diários (puzzles devidos do SRS + acervo curado para completar a meta)
 */
export function getDailyPuzzles(limit = 5): TrainingPosition[] {
  return selectTrainingSession('daily', limit);
}
export type TrainingSource = 'daily' | 'errors' | 'theme';
export const TRAINING_THEMES: TacticalCategory[] = ['mate_perdido','garfo','cravada','ataque_descoberto','peca_pendurada','defesa'];
function curatedPosition(p: typeof TRAINING_PUZZLES[number]): TrainingPosition {
  return {...p, solution:[...p.solution], playerMove:'—',errorType:'puzzle_diario',cpLoss:0,attempts:0,correct:0,mastered:false,consecutiveCorrect:0,dateAdded:new Date().toISOString(),gameIndex:0,srsLevel:0,isCuratedPuzzle:true};
}
/** Freeze this result at session start. Daily never pulls scheduled items early. */
export function selectTrainingSession(source: TrainingSource, limit: number, category?: TacticalCategory): TrainingPosition[] {
  const queue = getTrainingQueue();
  const due = (p:TrainingPosition) => !p.nextReviewDate || p.nextReviewDate <= new Date().toISOString();
  const matches = (p:TrainingPosition) => !category || p.category === category;
  const personal = queue.filter(p=>!p.isCuratedPuzzle && matches(p) && due(p));
  const existing = queue.filter(p=>p.isCuratedPuzzle && matches(p) && due(p));
  const fresh = TRAINING_PUZZLES.filter(p=>(!category || p.category === category) && !queue.some(q=>q.id === p.id)).map(curatedPosition);
  const choices = source === 'errors' && !category ? personal : [...personal, ...existing, ...fresh];
  const result = choices.slice(0,limit);
  for (const pos of result) if (!queue.some(q=>q.id===pos.id)) queue.push(pos);
  saveTrainingQueue(queue);
  return result;
}
