// Profile module - manages player profile, stats, and Elo estimation
// Persisted in localStorage

import { getStorage } from '../storage.js';

export interface PlayerProfile {
  estimatedElo: number;
  eloHistory: { date: string; elo: number }[];
  gamesPlayed: number;
  totalAccuracy: number; // running average
  assessmentCompleted: boolean;
  errorCategories: Record<string, number>; // category -> count
  createdAt: string;
  updatedAt: string;
  streakDays?: number;
  lastActiveDate?: string;
}

export interface GameStats {
  accuracy: number;      // percentage of good+ moves
  acpl: number;          // average centipawn loss
  moveCount: number;
  excellentMoves: number;
  goodMoves: number;
  inaccuracies: number;
  mistakes: number;
  blunders: number;
  result: string;        // '1-0', '0-1', '1/2-1/2'
  date: string;
}

const PROFILE_KEY = 'xadrez-coach-profile';
const STATS_KEY = 'xadrez-coach-stats';

export function getProfile(): PlayerProfile | null {
  const data = getStorage().getItem(PROFILE_KEY);
  if (!data) return null;
  try {
    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.estimatedElo !== 'number') {
      return null;
    }
    return {
      estimatedElo: parsed.estimatedElo,
      eloHistory: Array.isArray(parsed.eloHistory) ? parsed.eloHistory : [],
      gamesPlayed: typeof parsed.gamesPlayed === 'number' ? parsed.gamesPlayed : 0,
      totalAccuracy: typeof parsed.totalAccuracy === 'number' ? parsed.totalAccuracy : 0,
      assessmentCompleted: Boolean(parsed.assessmentCompleted),
      errorCategories: (parsed.errorCategories && typeof parsed.errorCategories === 'object') ? parsed.errorCategories : {},
      createdAt: parsed.createdAt || new Date().toISOString(),
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function recordDailyActivity(profile: PlayerProfile): PlayerProfile {
  const today = new Date().toISOString().slice(0, 10);
  const lastDate = profile.lastActiveDate ? profile.lastActiveDate.slice(0, 10) : null;

  if (!lastDate) {
    profile.streakDays = 1;
    profile.lastActiveDate = today;
  } else if (lastDate === today) {
    // Mantém o streak atual
    if (!profile.streakDays) profile.streakDays = 1;
  } else {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    if (lastDate === yesterdayStr) {
      profile.streakDays = (profile.streakDays || 1) + 1;
    } else {
      profile.streakDays = 1;
    }
    profile.lastActiveDate = today;
  }

  saveProfile(profile);
  return profile;
}

export function saveProfile(profile: PlayerProfile): void {
  profile.updatedAt = new Date().toISOString();
  getStorage().setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function createProfile(estimatedElo: number): PlayerProfile {
  const profile: PlayerProfile = {
    estimatedElo,
    eloHistory: [{ date: new Date().toISOString(), elo: estimatedElo }],
    gamesPlayed: 0,
    totalAccuracy: 0,
    assessmentCompleted: true,
    errorCategories: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveProfile(profile);
  return profile;
}

export function updateEloAfterGame(profile: PlayerProfile, gameStats: GameStats): PlayerProfile {
  recordDailyActivity(profile);

  // Adapt Elo based on result + ACPL
  // Rise/fall slowly: 15-30 points per game
  const acplTarget = getAcplTarget(profile.estimatedElo);
  let eloChange = 0;

  // Result-based adjustment
  if (gameStats.result === '1-0') {
    eloChange += 15; // Player won
  } else if (gameStats.result === '0-1') {
    eloChange -= 15; // Player lost
  }
  // else draw: no change from result

  // ACPL-based adjustment
  if (gameStats.acpl < acplTarget * 0.7) {
    eloChange += 15; // Playing significantly above level
  } else if (gameStats.acpl > acplTarget * 1.5) {
    eloChange -= 10; // Playing below level
  }

  // Clamp change to [-30, 30]
  eloChange = Math.max(-30, Math.min(30, eloChange));

  profile.estimatedElo = Math.max(400, profile.estimatedElo + eloChange);
  profile.gamesPlayed += 1;

  // Update running accuracy
  if (profile.gamesPlayed === 1) {
    profile.totalAccuracy = gameStats.accuracy;
  } else {
    profile.totalAccuracy =
      (profile.totalAccuracy * (profile.gamesPlayed - 1) + gameStats.accuracy) /
      profile.gamesPlayed;
  }

  profile.eloHistory.push({
    date: new Date().toISOString(),
    elo: profile.estimatedElo,
  });

  // Update error categories
  if (gameStats.inaccuracies > 0) {
    profile.errorCategories['imprecisao'] =
      (profile.errorCategories['imprecisao'] || 0) + gameStats.inaccuracies;
  }
  if (gameStats.mistakes > 0) {
    profile.errorCategories['erro'] =
      (profile.errorCategories['erro'] || 0) + gameStats.mistakes;
  }
  if (gameStats.blunders > 0) {
    profile.errorCategories['erro_grave'] =
      (profile.errorCategories['erro_grave'] || 0) + gameStats.blunders;
  }

  saveProfile(profile);
  return profile;
}

// Target ACPL for a given Elo (approximate)
function getAcplTarget(elo: number): number {
  if (elo < 800) return 200;
  if (elo < 1000) return 150;
  if (elo < 1200) return 100;
  if (elo < 1400) return 70;
  if (elo < 1600) return 50;
  return 35;
}

export function getEloBand(elo: number): string {
  if (elo < 800) return 'Iniciante (< 800)';
  if (elo < 1000) return 'Iniciante (800–1000)';
  if (elo < 1200) return 'Intermediário (1000–1200)';
  if (elo < 1400) return 'Intermediário (1200–1400)';
  if (elo < 1600) return 'Avançado (1400–1600)';
  return 'Avançado (1600+)';
}

// Game stats history
export function getGameStatsHistory(): GameStats[] {
  const data = getStorage().getItem(STATS_KEY);
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveGameStats(stats: GameStats): void {
  const history = getGameStatsHistory();
  history.push(stats);
  // Keep last 100 games
  if (history.length > 100) history.shift();
  getStorage().setItem(STATS_KEY, JSON.stringify(history));
}

export function getDominantErrorCategory(profile: PlayerProfile): string | null {
  const cats = profile.errorCategories;
  let maxCat: string | null = null;
  let maxCount = 0;
  for (const [cat, count] of Object.entries(cats)) {
    if (count > maxCount) {
      maxCount = count;
      maxCat = cat;
    }
  }
  return maxCat;
}
