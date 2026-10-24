import type { MoveAnalysis } from '../analysis/MoveAnalyzer.js';

export class FeedbackCard {
  private container: HTMLElement;
  private currentAnalysis: MoveAnalysis | null = null;
  private isArrowShown = false;
  private onRetryCallback: (() => void) | null = null;
  private onToggleArrowCallback: ((shown: boolean) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderEmpty();
  }

  renderEmpty(message = 'Faça seu lance no tabuleiro para receber feedback do treinador.'): void {
    this.currentAnalysis = null;
    this.isArrowShown = false;
    this.container.innerHTML = `
      <div class="feedback-card empty">
        <div class="feedback-icon">♟</div>
        <p class="feedback-prompt">${message}</p>
      </div>
    `;
  }

  renderAnalyzing(): void {
    this.container.innerHTML = `
      <div class="feedback-card analyzing">
        <div class="spinner"></div>
        <div class="analyzing-text">
          <strong>Treinador analisando...</strong>
          <span>Avaliando a qualidade e tática da posição</span>
        </div>
      </div>
    `;
  }

  renderAnalysis(analysis: MoveAnalysis): void {
    this.currentAnalysis = analysis;
    this.isArrowShown = false;

    const retryHtml = analysis.isRetryable
      ? `<button type="button" class="btn-retry" id="btn-feedback-retry">
          ↩ Tentar de novo
         </button>`
      : '';

    const bestMoveInfo = analysis.bestMoveSan
      ? `<div class="feedback-best-move">
           <span class="label">Recomendação do motor:</span>
           <span class="value">${analysis.bestMoveSan}</span>
           <button type="button" class="btn-toggle-arrow" id="btn-toggle-best-move">
             🎯 Ver no tabuleiro
           </button>
         </div>`
      : '';

    this.container.innerHTML = `
      <div class="feedback-card active" style="--badge-color: ${analysis.color}">
        <div class="feedback-header">
          <span class="quality-badge" style="background-color: ${analysis.color}">
            ${analysis.label}
          </span>
          <span class="player-move-tag">Seu lance: <strong>${analysis.playerMove}</strong></span>
        </div>

        <p class="feedback-explanation">
          ${analysis.explanation}
        </p>

        ${bestMoveInfo}

        ${retryHtml ? `<div class="feedback-actions">${retryHtml}</div>` : ''}
      </div>
    `;

    // Listeners
    const btnRetry = this.container.querySelector<HTMLButtonElement>('#btn-feedback-retry');
    if (btnRetry) {
      btnRetry.addEventListener('click', () => {
        if (this.onRetryCallback) {
          this.onRetryCallback();
        }
      });
    }

    const btnArrow = this.container.querySelector<HTMLButtonElement>('#btn-toggle-best-move');
    if (btnArrow) {
      btnArrow.addEventListener('click', () => {
        this.isArrowShown = !this.isArrowShown;
        btnArrow.textContent = this.isArrowShown ? 'Ocultar seta' : '🎯 Ver no tabuleiro';
        if (this.onToggleArrowCallback) {
          this.onToggleArrowCallback(this.isArrowShown);
        }
      });
    }
  }

  onRetry(callback: () => void): void {
    this.onRetryCallback = callback;
  }

  onToggleArrow(callback: (shown: boolean) => void): void {
    this.onToggleArrowCallback = callback;
  }

  getCurrentAnalysis(): MoveAnalysis | null {
    return this.currentAnalysis;
  }
}
