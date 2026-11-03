import type { ClockState } from './GameSession.js';
/** Elapsed-time clock; independent of timers and presentation. */
export class GameClock {
  private state: ClockState;
  private active: 'w' | 'b' | null = null;
  private since = 0;
  private now: () => number;
  constructor(minutes: number, now: () => number = () => performance.now()) { this.now=now; this.state = {white: minutes * 60, black: minutes * 60}; }
  snapshot(): ClockState {
    const copy = {...this.state};
    if (this.active) { const key = this.active === 'w' ? 'white' : 'black'; copy[key] = Math.max(0, copy[key] - (this.now() - this.since) / 1000); }
    return copy;
  }
  pause(): void { this.state = this.snapshot(); this.active = null; }
  start(color: 'w' | 'b'): void { this.pause(); this.active = color; this.since = this.now(); }
  restore(state: ClockState): void { this.active = null; this.state = {...state}; }
}
