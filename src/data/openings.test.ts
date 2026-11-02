import { describe, it, expect } from 'vitest';
import { detectOpening } from './openings';

describe('Opening Detector (detectOpening)', () => {
  it('retorna null para sequência vazia', () => {
    expect(detectOpening([])).toBeNull();
  });

  it('detecta Abertura Italiana (Giuoco Piano)', () => {
    const opening = detectOpening(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']);
    expect(opening).not.toBeNull();
    expect(opening?.name).toContain('Italiana');
    expect(opening?.eco).toBe('C50');
  });

  it('detecta Defesa Siciliana no lance 1', () => {
    const opening = detectOpening(['e4', 'c5']);
    expect(opening).not.toBeNull();
    expect(opening?.name).toBe('Defesa Siciliana');
    expect(opening?.eco).toBe('B20');
  });

  it('detecta Gambito da Dama e variante recusada', () => {
    const qg = detectOpening(['d4', 'd5', 'c4']);
    expect(qg?.name).toBe('Gambito da Dama');

    const qgd = detectOpening(['d4', 'd5', 'c4', 'e6']);
    expect(qgd?.name).toBe('Gambito da Dama Recusado');
  });

  it('ignora símbolos de xeque e anotações (+, #, !)', () => {
    const opening = detectOpening(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5+']);
    expect(opening?.name).toContain('Espanhola');
  });
});
