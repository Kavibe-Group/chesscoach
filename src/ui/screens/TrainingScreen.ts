import { GameController } from '../../game/GameController.js';
import { ChessBoard } from '../ChessBoard.js';
import {
  getActiveTrainingPositions,
  recordTrainingAttempt,
  getMasteredCount,
  getDailyPuzzles,
  type TrainingPosition,
} from '../../training/index.js';
import { CATEGORY_LABELS } from '../../analysis/MoveAnalyzer.js';

export interface TrainingScreenEvents {
  onBack: () => void;
}

export class TrainingScreen {
  private container: HTMLElement;
  private events: TrainingScreenEvents;
  private queue: TrainingPosition[] = [];
  private currentIdx = 0;
  private game: GameController;
  private board: ChessBoard | null = null;
  private isAnswered = false;

  constructor(container: HTMLElement, events: TrainingScreenEvents) {
    this.container = container;
    this.events = events;
    this.game = new GameController();
    const active = getActiveTrainingPositions();
    this.queue = active.length > 0 ? active : getDailyPuzzles(5);
    this.render();
  }

  render(): void {
    const masteredCount = getMasteredCount();

    if (this.queue.length === 0) {
      this.container.innerHTML = `
        <div class="training-screen empty">
          <header class="screen-header">
            <button type="button" class="btn btn-ghost" id="btn-back-training">← Voltar</button>
            <h1>Treino de Puzzles & Erros</h1>
          </header>
          <div class="empty-training card">
            <div class="empty-icon">🎉</div>
            <h2>Fila de Treino em Dia!</h2>
            <p>Você não tem erros pendentes para revisar no momento.</p>
            <p class="subtext">Jogue mais partidas contra o motor ou volte amanhã para novos puzzles diários!</p>
            <div class="training-stats">
              <span>🏆 ${masteredCount} posições dominadas no total</span>
            </div>
            <button type="button" class="btn btn-primary" id="btn-back-home-empty">Voltar ao Menu</button>
          </div>
        </div>
      `;

      this.container.querySelector('#btn-back-training')?.addEventListener('click', () => {
        this.events.onBack();
      });
      this.container.querySelector('#btn-back-home-empty')?.addEventListener('click', () => {
        this.events.onBack();
      });
      return;
    }

    if (this.currentIdx >= this.queue.length) {
      this.currentIdx = 0;
    }

    const pos = this.queue[this.currentIdx];
    this.isAnswered = false;
    this.game.loadFen(pos.fen);

    const turn = this.game.turn() === 'w' ? 'Brancas' : 'Pretas';
    const orientation = this.game.turn() === 'w' ? 'white' : 'black';
    const categoryName = pos.category ? (CATEGORY_LABELS[pos.category] || pos.category) : '';

    this.container.innerHTML = `
      <div class="training-screen active">
        <header class="screen-header">
          <button type="button" class="btn btn-ghost" id="btn-back-training">← Voltar</button>
          <div class="progress-container">
            <span class="progress-label">Exercício ${this.currentIdx + 1} de ${this.queue.length} · Dominadas: ${masteredCount}</span>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${((this.currentIdx + 1) / this.queue.length) * 100}%"></div>
            </div>
          </div>
        </header>

        <div class="training-layout">
          <!-- Tabuleiro -->
          <div class="board-column">
            <div id="training-board-container" class="board-frame"></div>
          </div>

          <!-- Informações e Feedback do Exercício -->
          <div class="side-column card">
            <div class="training-info">
              <div class="training-tags-row">
                <span class="turn-indicator">Sua vez (${turn})</span>
                ${categoryName ? `<span class="category-badge category-${pos.category}">${categoryName}</span>` : ''}
                ${pos.isCuratedPuzzle ? `<span class="category-badge category-posicional">🎯 Puzzle Diário</span>` : ''}
              </div>

              <h2>Encontre o melhor lance</h2>

              ${pos.playerMove && pos.playerMove !== '—' ? `
                <div class="mistake-reminder">
                  <span>Na sua partida você jogou: <strong>${pos.playerMove}</strong></span>
                </div>
              ` : ''}

              <div class="mastery-tracker">
                <span class="mastery-label">Repetição Espaçada (SRS):</span>
                <span class="mastery-stars">
                  ${'⭐'.repeat(Math.min(2, pos.consecutiveCorrect))}${'☆'.repeat(Math.max(0, 2 - pos.consecutiveCorrect))}
                  (Nível ${pos.srsLevel ?? 0}/4 · ${pos.mastered ? '🏆 Dominado' : '2 acertos para dominar'})
                </span>
              </div>
            </div>

            <div id="training-feedback" class="assessment-feedback empty">
              <span>Faça o melhor lance no tabuleiro</span>
            </div>

            <div class="training-actions">
              <button type="button" class="btn btn-primary btn-lg" id="btn-next-training" style="display: none;">
                Próximo exercício →
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Monta o tabuleiro
    const boardEl = this.container.querySelector<HTMLElement>('#training-board-container')!;
    this.board = new ChessBoard(boardEl, this.game, orientation);

    this.board.onMove(event => {
      this.handlePlayerMove(event.from + event.to + (event.promotion || ''));
    });

    this.container.querySelector('#btn-back-training')?.addEventListener('click', () => {
      this.events.onBack();
    });

    this.container.querySelector('#btn-next-training')?.addEventListener('click', () => {
      // Atualiza fila de ativos e avança para o próximo exercício
      const active = getActiveTrainingPositions();
      this.queue = active.length > 0 ? active : getDailyPuzzles(5);
      this.currentIdx++;
      if (this.currentIdx >= this.queue.length) {
        this.currentIdx = 0;
      }
      this.render();
    });
  }

  private handlePlayerMove(moveUci: string): void {
    if (this.isAnswered) return;
    this.isAnswered = true;

    const pos = this.queue[this.currentIdx];
    const isCorrect = moveUci === pos.bestMove;

    const updated = recordTrainingAttempt(pos.id, isCorrect);
    this.board?.setInteractive(false);

    const feedbackEl = this.container.querySelector<HTMLElement>('#training-feedback')!;
    const btnNext = this.container.querySelector<HTMLButtonElement>('#btn-next-training')!;

    if (isCorrect) {
      const isMastered = updated?.mastered ?? false;
      feedbackEl.className = 'assessment-feedback success';
      feedbackEl.innerHTML = `
        <div class="feedback-badge success">
          ${isMastered ? '🏆 Dominado! Posição consolidada com sucesso!' : '✓ Excelente! Você acertou!'}
        </div>
        <p>Lance correto: <strong>${pos.bestMoveSan}</strong></p>
        <p class="explanation-subtext">${pos.explanation}</p>
      `;

      // Seta verde no lance correto
      const from = pos.bestMove.substring(0, 2);
      const to = pos.bestMove.substring(2, 4);
      this.board?.showBestMove(from, to);
    } else {
      feedbackEl.className = 'assessment-feedback mistake';
      feedbackEl.innerHTML = `
        <div class="feedback-badge mistake">✕ Não foi esse o melhor lance</div>
        <p>A melhor jogada era <strong>${pos.bestMoveSan}</strong>.</p>
        <p class="explanation-subtext">${pos.explanation}</p>
      `;

      // Desenha a seta da solução
      const from = pos.bestMove.substring(0, 2);
      const to = pos.bestMove.substring(2, 4);
      this.board?.showBestMove(from, to);
    }

    btnNext.style.display = 'block';
  }

  destroy(): void {
    this.board?.destroy();
    this.container.innerHTML = '';
  }
}
