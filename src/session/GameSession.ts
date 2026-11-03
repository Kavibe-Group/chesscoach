import { getStorage, isStorageDurable, storageWriteSucceeded } from '../storage.js';
import type { AppSettings } from '../profile/SettingsManager.js';
import { getProfile, updateEloAfterGame, getGameStatsHistory } from '../profile/ProfileManager.js';
import { GameController } from '../game/GameController.js';
import type { MoveAnalysis } from '../analysis/MoveAnalyzer.js';
import type { ReviewData } from '../ui/screens/ReviewScreen.js';

export type GameMode = 'study' | 'test';
export type GamePhase = 'player' | 'analysis' | 'engine' | 'decision';
export interface ClockState { white: number; black: number; }
export interface ActiveGame {
  version: 1; id: string; pgn: string; settings: AppSettings; targetElo: number;
  mode: GameMode; phase: GamePhase; analyzedMoves: MoveAnalysis[];
  clock: ClockState; lastFen: string; cachedEval: {score: number; mate: number | null; bestMove: string; pv: string[]} | null;
}
export interface CompletedGame extends ReviewData {
  id: string; date: string; mode: GameMode; eloBefore: number; eloAfter: number;
}
const ACTIVE = 'xadrez-coach-active-v1';
const HISTORY = 'xadrez-coach-history-v1';
export const newGameId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
export function saveActiveGame(game: ActiveGame): boolean {
  if (getGameStatsHistory().some(stats => stats.id === game.id)) return false;
  getStorage().setItem(ACTIVE, JSON.stringify(game));
  return isStorageDurable();
}
export function getActiveGame(): ActiveGame | null {
  try {
    const g = JSON.parse(getStorage().getItem(ACTIVE) || 'null') as ActiveGame | null;
    if (!g || g.version !== 1 || typeof g.id !== 'string' || !g.settings || !Array.isArray(g.analyzedMoves) || !g.clock || !Number.isFinite(g.clock.white) || !Number.isFinite(g.clock.black) || !['player','analysis','engine','decision'].includes(g.phase) || !['study','test'].includes(g.mode)) return null;
    if (!Number.isFinite(g.targetElo) || !Number.isFinite(g.settings.clockMinutes) || g.settings.clockMinutes < 0 || !['white','black'].includes(g.settings.playerColor)) return null;
    if (!new GameController().loadPgn(g.pgn)) return null;
    return g;
  } catch { return null; }
}
export function clearActiveGame(): void { getStorage().removeItem(ACTIVE); }
export function getCompletedGames(): CompletedGame[] {
  try { const rows = JSON.parse(getStorage().getItem(HISTORY) || '[]'); return Array.isArray(rows) ? rows.filter(r => r && typeof r.id === 'string' && typeof r.pgn === 'string') : []; } catch { return []; }
}
/** Commit the complete record, stats and resulting profile in one journal entry.
 * Reconciliation after an interrupted write re-applies exact values, never increments. */
export function finalizeGame(data: ReviewData & {id: string; mode: GameMode}): CompletedGame {
  if (!reconcileCompletion()) {
    let pending: CompletedGame | null = null;
    try { pending = JSON.parse(getStorage().getItem('xadrez-coach-completion-v1') || 'null')?.record; } catch { /* Keep corrupt journal. */ }
    const elo = getProfile()?.estimatedElo ?? 1200;
    return {...(pending?.id === data.id ? pending : {...data,date:new Date().toISOString(),eloBefore:elo,eloAfter:elo}), storageWarning:true};
  }
  const existing = getCompletedGames().find(g => g.id === data.id);
  if (existing) return existing;
  const profile = getProfile();
  const before = profile?.estimatedElo ?? 1200;
  const date = new Date().toISOString();
  const stats = {id:data.id, mode:data.mode, playerColor:data.playerColor, date,
    accuracy:data.accuracy, acpl:data.acpl, moveCount:data.moveCount,
    excellentMoves:data.excellentMoves, goodMoves:data.goodMoves, inaccuracies:data.inaccuracies,
    mistakes:data.mistakes, blunders:data.blunders, result:data.result};
  const updated = profile && data.moveCount > 0 ? updateEloAfterGame({...profile, eloHistory: [...profile.eloHistory], errorCategories: {...profile.errorCategories}}, stats, data.analyzedMoves, false) : profile;
  const record: CompletedGame = {...data, date, eloBefore: before, eloAfter: updated?.estimatedElo ?? before};
  const journal = {record, profile: updated, stats: [...getGameStatsHistory().filter(s => s.id !== data.id), stats].slice(-100)};
  getStorage().setItem('xadrez-coach-completion-v1', JSON.stringify(journal));
  if (!storageWriteSucceeded()) return {...record,storageWarning:true};
  return reconcileCompletion() ? record : {...record,storageWarning:true};
}
export function reconcileCompletion(): boolean {
  const raw = getStorage().getItem('xadrez-coach-completion-v1');
  if (!raw) return true;
  try {
    const j = JSON.parse(raw);
    if (!j.record?.id || !Array.isArray(j.stats)) return false;
    const history = [...getCompletedGames().filter(g => g.id !== j.record.id), j.record].slice(-100);
    getStorage().setItem(HISTORY, JSON.stringify(history));
    if (!storageWriteSucceeded()) return false;
    getStorage().setItem('xadrez-coach-stats', JSON.stringify(j.stats));
    if (!storageWriteSucceeded()) return false;
    if (j.profile) getStorage().setItem('xadrez-coach-profile', JSON.stringify(j.profile));
    if (!storageWriteSucceeded()) return false;
    if (getActiveGame()?.id === j.record.id) {
      clearActiveGame();
      if (getStorage().getItem(ACTIVE) !== null) return false;
    }
    getStorage().removeItem('xadrez-coach-completion-v1');
    return getStorage().getItem('xadrez-coach-completion-v1') === null;
  } catch { return false; /* Keep journal for a later recovery. */ }
}
