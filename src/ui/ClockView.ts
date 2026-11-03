import { GameClock } from '../session/Clock.js';
import type { ClockState } from '../session/GameSession.js';
export class ClockView {
  private clock: GameClock;
  private element: HTMLElement;
  private whiteTimeSeconds: number;
  private blackTimeSeconds: number;
  private initialMinutes: number;
  private activeColor: 'w' | 'b' | null = null;
  private intervalId: number | null = null;
  private onTimeOutCallback: ((color: 'w' | 'b') => void) | null = null;
  private enabled: boolean;

  constructor(element: HTMLElement, initialMinutes = 0) {
    this.clock = new GameClock(initialMinutes);
    this.element = element;
    this.initialMinutes = initialMinutes;
    this.enabled = initialMinutes > 0;
    this.whiteTimeSeconds = initialMinutes * 60;
    this.blackTimeSeconds = initialMinutes * 60;
    this.render();
  }

  reset(newMinutes?: number): void {
    this.stop();
    if (typeof newMinutes === 'number') {
      this.initialMinutes = newMinutes;
      this.enabled = newMinutes > 0;
    }
    this.clock = new GameClock(this.initialMinutes);
    this.activeColor = null;
    this.whiteTimeSeconds = this.initialMinutes * 60;
    this.blackTimeSeconds = this.initialMinutes * 60;
    this.render();
  }

  start(color: 'w' | 'b'): void {
    if (!this.enabled) return;
    this.stop();
    this.activeColor = color;
    if (this.expired(color)) { this.onTimeOutCallback?.(color); return; }
    this.clock.start(color);

    if (typeof window !== 'undefined') {
      this.intervalId = window.setInterval(() => {
        const state = this.clock.snapshot();
        this.whiteTimeSeconds = state.white;
        this.blackTimeSeconds = state.black;
        if ((this.activeColor === 'w' ? state.white : state.black) <= 0) {
          const timedOut = this.activeColor;
          this.stop();
          if (timedOut) this.onTimeOutCallback?.(timedOut);
        }
        this.render();
      }, 1000);
    }
    this.render();
  }

  expired(color: 'w' | 'b'): boolean {
    const state = this.clock.snapshot();
    return this.enabled && (color === 'w' ? state.white : state.black) <= 0;
  }

  snapshot(): ClockState { return this.clock.snapshot(); }

  restore(state: ClockState): void {
    this.stop(); this.clock.restore(state);
    this.whiteTimeSeconds = state.white; this.blackTimeSeconds = state.black; this.render();
  }

  stop(): void {
    this.clock.pause();
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  switchTurn(turn: 'w' | 'b'): void {
    if (!this.enabled) return;
    this.start(turn);
  }

  onTimeOut(callback: (color: 'w' | 'b') => void): void {
    this.onTimeOutCallback = callback;
  }

  private formatTime(totalSeconds: number): string {
    totalSeconds = Math.ceil(totalSeconds);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  private render(): void {
    if (!this.enabled) {
      this.element.innerHTML = `
        <div class="clock-display study-mode">
          <span class="study-label">Sem limite de tempo</span>
        </div>
      `;
      return;
    }

    const whiteActive = this.activeColor === 'w' ? 'active' : '';
    const blackActive = this.activeColor === 'b' ? 'active' : '';
    const whiteLow = this.whiteTimeSeconds > 0 && this.whiteTimeSeconds <= 30 ? 'low-time' : '';
    const blackLow = this.blackTimeSeconds > 0 && this.blackTimeSeconds <= 30 ? 'low-time' : '';

    this.element.innerHTML = `
      <div class="clock-display timed">
        <div class="clock-box black ${blackActive} ${blackLow}">
          <span class="clock-name">Pretas</span>
          <span class="clock-time">${this.formatTime(this.blackTimeSeconds)}</span>
        </div>
        <div class="clock-box white ${whiteActive} ${whiteLow}">
          <span class="clock-name">Brancas</span>
          <span class="clock-time">${this.formatTime(this.whiteTimeSeconds)}</span>
        </div>
      </div>
    `;
  }

  destroy(): void {
    this.stop();
  }
}
