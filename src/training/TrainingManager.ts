// Training module - manages the error training queue
// Positions from player's real errors, to practice

export interface TrainingPosition {
  id: string;
  fen: string;              // position where the error happened
  bestMove: string;         // correct move in UCI
  bestMoveSan: string;      // correct move in SAN
  playerMove: string;       // wrong move played (SAN)
  explanation: string;      // why best move is better
  errorType: string;        // 'imprecisao' | 'erro' | 'erro_grave'
  cpLoss: number;
  attempts: number;         // how many times attempted
  correct: number;          // how many times solved correctly
  mastered: boolean;        // true when solved correctly 2+ times in a row
  consecutiveCorrect: number;
  dateAdded: string;
  gameIndex: number;        // which game it came from
}

const TRAINING_KEY = 'xadrez-coach-training';

export function getTrainingQueue(): TrainingPosition[] {
  const data = localStorage.getItem(TRAINING_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data) as TrainingPosition[];
  } catch {
    return [];
  }
}

export function saveTrainingQueue(queue: TrainingPosition[]): void {
  localStorage.setItem(TRAINING_KEY, JSON.stringify(queue));
}

export function addTrainingPosition(pos: Omit<TrainingPosition, 'id' | 'attempts' | 'correct' | 'mastered' | 'consecutiveCorrect' | 'dateAdded'>): void {
  const queue = getTrainingQueue();

  // Don't add duplicates (same FEN)
  if (queue.some(p => p.fen === pos.fen)) return;

  const newPos: TrainingPosition = {
    ...pos,
    id: crypto.randomUUID(),
    attempts: 0,
    correct: 0,
    mastered: false,
    consecutiveCorrect: 0,
    dateAdded: new Date().toISOString(),
  };

  queue.push(newPos);
  saveTrainingQueue(queue);
}

export function recordTrainingAttempt(id: string, wasCorrect: boolean): TrainingPosition | null {
  const queue = getTrainingQueue();
  const pos = queue.find(p => p.id === id);
  if (!pos) return null;

  pos.attempts += 1;
  if (wasCorrect) {
    pos.correct += 1;
    pos.consecutiveCorrect += 1;
    // Mastered after 2 consecutive correct answers
    if (pos.consecutiveCorrect >= 2) {
      pos.mastered = true;
    }
  } else {
    pos.consecutiveCorrect = 0;
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
