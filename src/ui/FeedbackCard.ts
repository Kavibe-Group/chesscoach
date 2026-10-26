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

    const hasRedThreat = analysis.shapes && analysis.shapes.some(s => s.brush === 'red');
    const legendHtml = `
      <div class="feedback-legend" id="feedback-legend" style="display: none;">
        <span class="legend-item"><span class="legend-dot green"></span> Melhor lance (${analysis.bestMoveSan})</span>
        ${hasRedThreat ? `<span class="legend-item"><span class="legend-dot red"></span> Ameaça / Punição</span>` : ''}
      </div>
    `;

    const refutationHtml = (analysis.refutationPv && analysis.refutationPv.length > 0 && analysis.quality !== 'excelente' && analysis.quality !== 'bom')
      ? `<div class="feedback-refutation">
           <span class="refutation-title">Linha de refutação do adversário:</span>
           <div class="refutation-line">
             ${analysis.refutationPv.map((m, idx) => `<span class="refutation-step"><strong>${idx + 1}.</strong> ${m.san}</span>`).join(' ')}
           </div>
         </div>`
      : '';

    const categoryTag = analysis.categoryLabel
      ? `<span class="category-badge category-${analysis.category}">${analysis.categoryLabel}</span>`
      : '';

    this.container.innerHTML = `
      <div class="feedback-card active" style="--badge-color: ${analysis.color}">
        <div class="feedback-header">
          <div class="badges-row">
            <span class="quality-badge" style="background-color: ${analysis.color}">
              ${analysis.label}
            </span>
            ${categoryTag}
          </div>
          <span class="player-move-tag">Seu lance: <strong>${analysis.playerMove}</strong></span>
        </div>

        <p class="feedback-explanation">
          ${analysis.explanation}
        </p>

        ${bestMoveInfo}
        ${legendHtml}
        ${refutationHtml}

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
    const legendEl = this.container.querySelector<HTMLElement>('#feedback-legend');

    if (btnArrow) {
      btnArrow.addEventListener('click', () => {
        this.isArrowShown = !this.isArrowShown;
        btnArrow.textContent = this.isArrowShown ? 'Ocultar setas' : '🎯 Ver no tabuleiro';
        if (legendEl) {
          legendEl.style.display = this.isArrowShown ? 'flex' : 'none';
        }
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
