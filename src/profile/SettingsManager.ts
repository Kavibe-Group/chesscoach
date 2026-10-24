import { getStorage } from '../storage.js';

export interface AppSettings {
  playerColor: 'white' | 'black';
  clockMinutes: number; // 0 = sem relógio (estudo), 10 = 10 min
  engineStrengthMode: 'auto' | 'manual';
  manualElo: number;
  boardTheme: 'brown' | 'green' | 'blue';
  showLegalMoves: boolean;
  showHighlights: boolean;
}

const SETTINGS_KEY = 'xadrez-coach-settings';

const DEFAULT_SETTINGS: AppSettings = {
  playerColor: 'white',
  clockMinutes: 0,
  engineStrengthMode: 'auto',
  manualElo: 1200,
  boardTheme: 'brown',
  showLegalMoves: true,
  showHighlights: true,
};

export function getSettings(): AppSettings {
  const data = getStorage().getItem(SETTINGS_KEY);
  if (!data) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  const updated = { ...current, ...settings };
  getStorage().setItem(SETTINGS_KEY, JSON.stringify(updated));
  return updated;
}
