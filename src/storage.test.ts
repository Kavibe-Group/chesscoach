import { describe, it, expect, beforeEach } from 'vitest';
import { getStorage } from './storage';
import { getProfile, getGameStatsHistory, saveGameStats } from './profile/ProfileManager';
import { getTrainingQueue } from './training/TrainingManager';
import { getSettings } from './profile/SettingsManager';

describe('Storage & Data Robustness - BUG-08', () => {
  beforeEach(() => {
    getStorage().clear();
  });

  it('trata perfil corrompido ou vazio ({}) no storage sem lançar TypeError', () => {
    // Grava objeto vazio e corrompido no storage
    getStorage().setItem('xadrez-coach-profile', '{}');

    // Não deve lançar erro e deve retornar null com segurança
    const profile = getProfile();
    expect(profile).toBeNull();

    // Grava perfil com dados parciais (ex: sem eloHistory ou sem errorCategories)
    getStorage().setItem('xadrez-coach-profile', JSON.stringify({ estimatedElo: 1200 }));
    const partialProfile = getProfile();
    expect(partialProfile).not.toBeNull();
    expect(Array.isArray(partialProfile?.eloHistory)).toBe(true);
    expect(partialProfile?.eloHistory.slice(0, 5)).toEqual([]);
    expect(typeof partialProfile?.errorCategories).toBe('object');
  });

  it('trata fila de treino corrompida ({}) no storage sem quebrar filter ou map', () => {
    getStorage().setItem('xadrez-coach-training', '{"chave": "invalida"}');

    // Deve retornar array vazio seguro
    const queue = getTrainingQueue();
    expect(Array.isArray(queue)).toBe(true);
    expect(queue.length).toBe(0);
    expect(() => queue.filter(p => p.mastered)).not.toThrow();
  });

  it('trata histórico de estatísticas corrompido ({}) sem quebrar saveGameStats', () => {
    getStorage().setItem('xadrez-coach-stats', '{"erro": true}');

    const history = getGameStatsHistory();
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBe(0);

    // Salvar novas estatísticas não deve quebrar
    expect(() => {
      saveGameStats({
        accuracy: 80,
        acpl: 50,
        moveCount: 10,
        excellentMoves: 5,
        goodMoves: 3,
        inaccuracies: 1,
        mistakes: 1,
        blunders: 0,
        result: '1-0',
        date: new Date().toISOString(),
      });
    }).not.toThrow();

    expect(getGameStatsHistory().length).toBe(1);
  });

  it('trata configurações corrompidas no storage retornando padrões seguros', () => {
    getStorage().setItem('xadrez-coach-settings', '"texto_invalido"');

    const settings = getSettings();
    expect(settings).toBeDefined();
    expect(settings.playerColor).toBe('white');
    expect(settings.boardTheme).toBe('brown');
  });
});
