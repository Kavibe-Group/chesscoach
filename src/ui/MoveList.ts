import type { MoveAnalysis } from '../analysis/MoveAnalyzer.js';

export interface MoveRecord {
  san: string;
  from: string;
  to: string;
  analysis?: MoveAnalysis;
}

export class MoveList {
  private container: HTMLElement;
  private moves: MoveRecord[] = [];

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
  }

  addMove(move: MoveRecord): void {
    this.moves.push(move);
    this.render();
    this.scrollToBottom();
  }

  undoLastMove(): MoveRecord | undefined {
    const popped = this.moves.pop();
    this.render();
    return popped;
  }

  setLastMoveAnalysis(analysis: MoveAnalysis): void {
    if (this.moves.length > 0) {
      this.moves[this.moves.length - 1].analysis = analysis;
      this.render();
    }
  }

  clear(): void {
    this.moves = [];
    this.render();
  }

  private render(): void {
    if (this.moves.length === 0) {
      this.container.innerHTML = `
        <div class="move-list-empty">Nenhum lance realizado ainda.</div>
      `;
      return;
    }

    let html = '<div class="move-table">';
    for (let i = 0; i < this.moves.length; i += 2) {
      const moveNumber = Math.floor(i / 2) + 1;
      const whiteMove = this.moves[i];
      const blackMove = this.moves[i + 1];

      const whiteBadge = whiteMove.analysis
        ? `<span class="move-badge-dot" style="background-color: ${whiteMove.analysis.color}" title="${whiteMove.analysis.label}"></span>`
        : '';

      const blackBadge = blackMove?.analysis
        ? `<span class="move-badge-dot" style="background-color: ${blackMove.analysis.color}" title="${blackMove.analysis.label}"></span>`
        : '';

      html += `
        <div class="move-row">
          <span class="move-num">${moveNumber}.</span>
          <span class="move-cell white">${whiteMove.san} ${whiteBadge}</span>
          <span class="move-cell black">${blackMove ? `${blackMove.san} ${blackBadge}` : ''}</span>
        </div>
      `;
    }
    html += '</div>';

    this.container.innerHTML = html;
  }

  private scrollToBottom(): void {
    this.container.scrollTop = this.container.scrollHeight;
  }
}
