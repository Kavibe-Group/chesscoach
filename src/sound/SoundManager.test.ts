import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SoundManager } from './SoundManager';

describe('SoundManager (Web Audio API Synthesizer)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('não lança erro quando executado em ambiente Node / sem AudioContext', () => {
    const sound = SoundManager.getInstance();
    expect(() => sound.playMove()).not.toThrow();
    expect(() => sound.playCapture()).not.toThrow();
    expect(() => sound.playCheck()).not.toThrow();
    expect(() => sound.playCastle()).not.toThrow();
    expect(() => sound.playSuccess()).not.toThrow();
    expect(() => sound.playMistake()).not.toThrow();
    expect(() => sound.playGameEnd()).not.toThrow();
  });

  it('dispara osciladores corretamente quando AudioContext é simulado', () => {
    const mockOscillator = {
      type: 'triangle',
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };

    const mockGain = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };

    const mockCtx = {
      currentTime: 10,
      state: 'running',
      createOscillator: vi.fn().mockReturnValue(mockOscillator),
      createGain: vi.fn().mockReturnValue(mockGain),
      destination: {},
    };

    // Injeta mock
    (SoundManager.getInstance() as any).audioCtx = mockCtx;

    SoundManager.getInstance().playMove();

    expect(mockCtx.createOscillator).toHaveBeenCalled();
    expect(mockCtx.createGain).toHaveBeenCalled();
    expect(mockOscillator.start).toHaveBeenCalled();
    expect(mockOscillator.stop).toHaveBeenCalled();
  });
});
