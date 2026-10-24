import { GameController } from '../../game/GameController.js';
import { ChessBoard, type MoveEvent } from '../ChessBoard.js';
import { StockfishEngine } from '../../engine/StockfishEngine.js';
import { analyzeMoveQuality, type PositionContext } from '../../analysis/MoveAnalyzer.js';
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

  // Fase de calibração contra o motor
  public isCalibrationPhase = false;
  public calibrationMovesCount = 0;
  public calibrationTotalCpLoss = 0;
  private opponentEngine: StockfishEngine | null = null;
  private analystEngine: StockfishEngine | null = null;
  private lastCalibrationEval: { score: number; mate: number | null; bestMove: string; pv: string[] } | null = null;
  private lastFenBeforeCalibrationMove = '';
  private isEngineThinking = false;

  constructor(container: HTMLElement, events: AssessmentScreenEvents) {
    this.container = container;
    this.events = events;
    this.puzzles = getPuzzlesForAssessment();
    this.game = new GameController();
    this.render();
  }

  private render(): void {
    if (this.currentIdx >= this.puzzles.length) {
      this.startCalibrationGame();
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

  // ---------------------------------------------------------------------------
  // Etapa 2: Partida de Calibração real contra o motor
  // ---------------------------------------------------------------------------

  public async startCalibrationGame(): Promise<void> {
    this.isCalibrationPhase = true;
    this.calibrationMovesCount = 0;
    this.calibrationTotalCpLoss = 0;
    this.game = new GameController();

    if (!this.opponentEngine) {
      this.opponentEngine = new StockfishEngine();
      this.analystEngine = new StockfishEngine();
      await Promise.all([this.opponentEngine.init(), this.analystEngine.init()]);
      await this.opponentEngine.setStrength({ skillLevel: 3, limitStrength: false });
      await this.analystEngine.setStrength({ skillLevel: 20, limitStrength: false });
    }

    this.renderCalibrationLayout();
    await this.cacheCalibrationPositionEval();
  }

  private renderCalibrationLayout(): void {
    this.container.innerHTML = `
      <div class="assessment-screen calibration">
        <header class="screen-header">
          <button type="button" class="btn btn-ghost" id="btn-cancel-calibration">← Cancelar</button>
          <div class="progress-container">
            <span class="progress-label">Etapa 2: Partida de Calibração (${this.calibrationMovesCount}/10 lances)</span>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${(this.calibrationMovesCount / 10) * 100}%"></div>
            </div>
          </div>
        </header>

        <div class="assessment-main">
          <!-- Tabuleiro -->
          <div class="board-column">
            <div id="calibration-board-container" class="board-frame"></div>
          </div>

          <!-- Instruções de Calibração -->
          <div class="side-column card">
            <div class="assessment-info">
              <span class="turn-indicator">Sua vez (Brancas)</span>
              <h2 class="puzzle-title">Partida de Calibração</h2>
              <p class="puzzle-instruction">
                Jogue normalmente contra o motor. O Stockfish medirá sua perda média de centipeões (ACPL) real.
              </p>
            </div>

            <div class="calibration-stats-box" style="margin: 1.5rem 0; padding: 1rem; background: var(--surface-2, #262421); border-radius: 8px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                <span>Lances avaliados:</span>
                <strong id="calib-move-count">${this.calibrationMovesCount} / 10</strong>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span>Perda média atual (ACPL):</span>
                <strong id="calib-acpl-val">${this.calibrationMovesCount > 0 ? Math.round(this.calibrationTotalCpLoss / this.calibrationMovesCount) : 0} cp</strong>
              </div>
            </div>

            <div class="assessment-actions">
              <button type="button" class="btn btn-secondary btn-lg" id="btn-finish-calibration" style="${this.calibrationMovesCount >= 5 ? '' : 'display: none;'}">
                Finalizar Calibração Agora →
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const boardEl = this.container.querySelector<HTMLElement>('#calibration-board-container')!;
    this.board = new ChessBoard(boardEl, this.game, 'white');

    this.board.onMove(event => {
      this.handleCalibrationPlayerMove(event);
    });

    this.container.querySelector('#btn-cancel-calibration')?.addEventListener('click', () => {
      this.events.onCancel();
    });

    this.container.querySelector('#btn-finish-calibration')?.addEventListener('click', () => {
      this.finishCalibrationGame();
    });
  }

  private async cacheCalibrationPositionEval(): Promise<void> {
    try {
      this.lastFenBeforeCalibrationMove = this.game.getFen();
      if (!this.analystEngine) return;
      const evalResult = await this.analystEngine.evaluate(this.lastFenBeforeCalibrationMove, 10);
      this.lastCalibrationEval = {
        score: evalResult.score,
        mate: evalResult.mate,
        bestMove: evalResult.bestMove,
        pv: evalResult.pv,
      };
    } catch (e) {
      console.warn('Erro ao avaliar posição de calibração:', e);
    }
  }

  public async handleCalibrationPlayerMove(event: MoveEvent): Promise<void> {
    if (this.isEngineThinking) return;

    this.board?.setInteractive(false);

    try {
      const fenAfter = this.game.getFen();
      let cpLoss = 0;

      if (this.analystEngine) {
        const evalAfterEngine = await this.analystEngine.evaluate(fenAfter, 10);
        const evalAfterPlayer = -evalAfterEngine.score;
        const mateAfterPlayer = evalAfterEngine.mate !== null ? -evalAfterEngine.mate : null;

        const bestMoveUci = this.lastCalibrationEval?.bestMove ?? (event.from + event.to);

        const ctx: PositionContext = {
          fen: fenAfter,
          moveNumber: this.game.moveNumber(),
          playerColor: 'w',
          evalBefore: this.lastCalibrationEval?.score ?? 0,
          mateBefore: this.lastCalibrationEval?.mate ?? null,
          bestMoveUci,
          bestMoveSan: bestMoveUci,
          pvBefore: this.lastCalibrationEval?.pv ?? [bestMoveUci],
          evalAfter: evalAfterPlayer,
          mateAfter: mateAfterPlayer,
          playerMoveSan: event.san,
          playerMoveUci: event.from + event.to + (event.promotion || ''),
          fenBefore: this.lastFenBeforeCalibrationMove,
          fenAfter,
        };

        const analysis = analyzeMoveQuality(ctx);
        cpLoss = analysis.cpLoss;
      }

      this.calibrationTotalCpLoss += cpLoss;
      this.calibrationMovesCount++;

      // Atualiza interface com stats
      const countEl = this.container.querySelector('#calib-move-count');
      if (countEl) countEl.textContent = `${this.calibrationMovesCount} / 10`;

      const acplEl = this.container.querySelector('#calib-acpl-val');
      if (acplEl) {
        acplEl.textContent = `${Math.round(this.calibrationTotalCpLoss / this.calibrationMovesCount)} cp`;
      }

      const btnFinish = this.container.querySelector<HTMLButtonElement>('#btn-finish-calibration');
      if (btnFinish && this.calibrationMovesCount >= 5) {
        btnFinish.style.display = 'block';
      }

      // Se completou 10 lances ou fim de jogo
      if (this.calibrationMovesCount >= 10 || this.game.isGameOver()) {
        await this.finishCalibrationGame();
        return;
      }

      // Oponente responde
      this.isEngineThinking = true;
      if (this.opponentEngine) {
        const bestMove = await this.opponentEngine.getBestMove(this.game.getFen(), { moveTime: 500 });
        const from = bestMove.substring(0, 2);
        const to = bestMove.substring(2, 4);
        const promotion = bestMove.length > 4 ? bestMove[4] : undefined;
        this.game.makeMove(from, to, promotion);
        this.board?.sync();
      }

      this.isEngineThinking = false;

      if (this.game.isGameOver()) {
        await this.finishCalibrationGame();
        return;
      }

      await this.cacheCalibrationPositionEval();
      this.board?.setInteractive(true);
    } catch (e) {
      console.warn('Erro durante lance de calibração:', e);
      this.isEngineThinking = false;
      this.board?.setInteractive(true);
    }
  }

  public async finishCalibrationGame(): Promise<void> {
    const realAcpl = this.calibrationMovesCount > 0
      ? Math.round(this.calibrationTotalCpLoss / this.calibrationMovesCount)
      : 80;

    const assessment = completeAssessment(this.results, realAcpl);
    this.renderSummary(assessment);
  }

  private renderSummary(assessment: AssessmentResult): void {
    const correctCount = this.results.filter(r => r.correct).length;

    this.container.innerHTML = `
      <div class="assessment-screen summary">
        <div class="card summary-card">
          <div class="trophy-badge">🏆</div>
          <h1>Avaliação Concluída!</h1>
          <p class="summary-subtitle">Seu perfil foi criado e calibrado pelo Stockfish com sucesso.</p>

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
              <span class="val">${assessment.calibrationAcpl} cp</span>
              <span class="lbl">ACPL Real de Calibração</span>
            </div>
            <div class="summary-stat">
              <span class="val">~${assessment.estimatedElo + 50}</span>
              <span class="lbl">Força Inicial do Motor</span>
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
    this.opponentEngine?.destroy();
    this.analystEngine?.destroy();
    this.container.innerHTML = '';
  }
}
