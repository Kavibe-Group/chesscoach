export class ClockView {
  private element: HTMLElement;
  private whiteTimeSeconds: number;
  private blackTimeSeconds: number;
  private activeColor: 'w' | 'b' | null = null;
  private intervalId: number | null = null;
  private onTimeOutCallback: ((color: 'w' | 'b') => void) | null = null;
  private enabled: boolean;

  constructor(element: HTMLElement, initialMinutes = 0) {
    this.element = element;
    this.enabled = initialMinutes > 0;
    this.whiteTimeSeconds = initialMinutes * 60;
    this.blackTimeSeconds = initialMinutes * 60;
    this.render();
  }

  start(color: 'w' | 'b'): void {
    if (!this.enabled) return;
    this.activeColor = color;
    this.stop();

    this.intervalId = window.setInterval(() => {
      if (this.activeColor === 'w') {
        this.whiteTimeSeconds = Math.max(0, this.whiteTimeSeconds - 1);
        if (this.whiteTimeSeconds === 0) {
          this.stop();
          if (this.onTimeOutCallback) this.onTimeOutCallback('w');
        }
      } else if (this.activeColor === 'b') {
        this.blackTimeSeconds = Math.max(0, this.blackTimeSeconds - 1);
        if (this.blackTimeSeconds === 0) {
          this.stop();
          if (this.onTimeOutCallback) this.onTimeOutCallback('b');
        }
      }
      this.render();
    }, 1000);
  }

  stop(): void {
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
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  private render(): void {
    if (!this.enabled) {
      this.element.innerHTML = `
        <div class="clock-display study-mode">
          <span class="study-label">Modo Estudo (sem limite de tempo)</span>
        </div>
      `;
      return;
    }

    const whiteActive = this.activeColor === 'w' ? 'active' : '';
    const blackActive = this.activeColor === 'b' ? 'active' : '';

    this.element.innerHTML = `
      <div class="clock-display timed">
        <div class="clock-box black ${blackActive}">
          <span class="clock-name">Pretas</span>
          <span class="clock-time">${this.formatTime(this.blackTimeSeconds)}</span>
        </div>
        <div class="clock-box white ${whiteActive}">
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
