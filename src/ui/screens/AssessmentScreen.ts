import { GameController } from '../../game/GameController.js';
import { ChessBoard } from '../ChessBoard.js';
import {
  getPuzzlesForAssessment,
  checkPuzzleSolution,
  completeAssessment,
} from '../../assessment/index.js';
import type { PuzzleResult, AssessmentResult } from '../../assessment/index.js';
import type { AssessmentPuzzle } from '../../data/puzzles.js';

export interface AssessmentScreenEvents {
  onCompleted: (result: AssessmentResult) => void;
  onCancel: () => void;
}

export class AssessmentScreen {
  private container: HTMLElement;
  private events: AssessmentScreenEvents;
  private puzzles: AssessmentPuzzle[] = [];
  private currentIdx = 0;
  private results: PuzzleResult[] = [];
  private game: GameController;
  private board: ChessBoard | null = null;
  private startTime = 0;
  private puzzleAnswered = false;

  constructor(container: HTMLElement, events: AssessmentScreenEvents) {
    this.container = container;
    this.events = events;
    this.puzzles = getPuzzlesForAssessment();
    this.game = new GameController();
    this.render();
  }

  private render(): void {
    if (this.currentIdx >= this.puzzles.length) {
      this.renderSummary();
      return;
    }

    const puzzle = this.puzzles[this.currentIdx];
    this.puzzleAnswered = false;
    this.game.loadFen(puzzle.fen);
    this.startTime = Date.now();

    const turn = this.game.turn() === 'w' ? 'Brancas' : 'Pretas';
    const orientation = this.game.turn() === 'w' ? 'white' : 'black';

    this.container.innerHTML = `
      <div class="assessment-screen">
        <header class="screen-header">
          <button type="button" class="btn btn-ghost" id="btn-cancel-assessment">← Voltar</button>
          <div class="progress-container">
            <span class="progress-label">Posição ${this.currentIdx + 1} de ${this.puzzles.length}</span>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${((this.currentIdx) / this.puzzles.length) * 100}%"></div>
            </div>
          </div>
        </header>

        <div class="assessment-main">
          <!-- Tabuleiro -->
          <div class="board-column">
            <div id="assessment-board-container" class="board-frame"></div>
          </div>

          <!-- Instruções e Feedback -->
          <div class="side-column card">
            <div class="assessment-info">
              <span class="turn-indicator">Sua vez (${turn})</span>
              <h2 class="puzzle-title">${puzzle.description}</h2>
              <p class="puzzle-instruction">Encontre o melhor lance no tabuleiro.</p>
            </div>

            <div id="assessment-feedback" class="assessment-feedback empty">
              <span>Faça seu lance no tabuleiro</span>
            </div>

            <div class="assessment-actions">
              <button type="button" class="btn btn-primary btn-lg" id="btn-next-puzzle" style="display: none;">
                Próxima posição →
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Monta o tabuleiro Chessground
    const boardEl = this.container.querySelector<HTMLElement>('#assessment-board-container')!;
    this.board = new ChessBoard(boardEl, this.game, orientation);

    this.board.onMove(event => {
      this.handlePlayerMove(event.from + event.to + (event.promotion || ''));
    });

    this.container.querySelector('#btn-cancel-assessment')?.addEventListener('click', () => {
      this.events.onCancel();
    });

    this.container.querySelector('#btn-next-puzzle')?.addEventListener('click', () => {
      this.currentIdx++;
      this.render();
    });
  }

  private handlePlayerMove(moveUci: string): void {
    if (this.puzzleAnswered) return;
    this.puzzleAnswered = true;

    const puzzle = this.puzzles[this.currentIdx];
    const timeMs = Date.now() - this.startTime;
    const isCorrect = checkPuzzleSolution(puzzle.id, moveUci);

    this.results.push({
      puzzleId: puzzle.id,
      correct: isCorrect,
      playerMove: moveUci,
      timeMs,
    });

    // Desativa tabuleiro temporariamente
    this.board?.setInteractive(false);

    const feedbackEl = this.container.querySelector<HTMLElement>('#assessment-feedback')!;
    const btnNext = this.container.querySelector<HTMLButtonElement>('#btn-next-puzzle')!;

    if (isCorrect) {
      feedbackEl.className = 'assessment-feedback success';
      feedbackEl.innerHTML = `
        <div class="feedback-badge success">✓ Excelente! Você acertou!</div>
        <p>Solução: <strong>${puzzle.solutionSan}</strong></p>
      `;
    } else {
      feedbackEl.className = 'assessment-feedback mistake';
      feedbackEl.innerHTML = `
        <div class="feedback-badge mistake">✕ Não foi esse lance</div>
        <p>A melhor jogada era <strong>${puzzle.solutionSan}</strong>.</p>
      `;
      // Mostra seta da solução
      const from = puzzle.solution.substring(0, 2);
      const to = puzzle.solution.substring(2, 4);
      this.board?.showBestMove(from, to);
    }

    btnNext.style.display = 'block';
  }

  private renderSummary(): void {
    // Estimativa com calibração baseada nas respostas
    const correctCount = this.results.filter(r => r.correct).length;
    // ACPL estimado com base na taxa de acertos dos puzzles
    const estimatedAcpl = Math.max(30, 220 - correctCount * 15);
    const assessment = completeAssessment(this.results, estimatedAcpl);

    this.container.innerHTML = `
      <div class="assessment-screen summary">
        <div class="card summary-card">
          <div class="trophy-badge">🏆</div>
          <h1>Avaliação Concluída!</h1>
          <p class="summary-subtitle">Seu perfil foi criado e calibrado com sucesso.</p>

          <div class="elo-result-box">
            <span class="elo-result-label">Faixa de Elo estimada:</span>
            <span class="elo-result-number">${assessment.estimatedElo}</span>
            <span class="elo-result-band">${assessment.eloBand}</span>
          </div>

          <div class="summary-stats-grid">
            <div class="summary-stat">
              <span class="val">${correctCount} / ${this.puzzles.length}</span>
              <span class="lbl">Exercícios Corretos</span>
            </div>
            <div class="summary-stat">
              <span class="val">~${assessment.estimatedElo + 50}</span>
              <span class="lbl">Força do Motor (Desafio Leve)</span>
            </div>
          </div>

          <p class="summary-note">
            A cada partida que você jogar, o motor adaptará a força e aprenderá onde você mais erra para criar treinos exclusivos.
          </p>

          <button type="button" class="btn btn-primary btn-xl" id="btn-finish-assessment">
            ⚔️ Jogar minha primeira partida
          </button>
        </div>
      </div>
    `;

    this.container.querySelector('#btn-finish-assessment')?.addEventListener('click', () => {
      this.events.onCompleted(assessment);
    });
  }

  destroy(): void {
    this.board?.destroy();
    this.container.innerHTML = '';
  }
}
