import { confirmAction } from '../confirmAction.js';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import { explainPosition, escapeHtml, type ProgressiveHint } from '../../analysis/Coach.js';
import { getActiveGame, saveActiveGame, clearActiveGame, finalizeGame, newGameId, type ActiveGame, type GamePhase } from '../../session/GameSession.js';
import { GameController } from '../../game/GameController.js';
import { ChessBoard, type MoveEvent } from '../ChessBoard.js';
import { FeedbackCard } from '../FeedbackCard.js';
import { MoveList } from '../MoveList.js';
import { ClockView } from '../ClockView.js';
import { StockfishEngine, eloToEngineConfig } from '../../engine/StockfishEngine.js';
import { analyzeMoveQuality, type MoveAnalysis, type PositionContext } from '../../analysis/MoveAnalyzer.js';
import { getProfile, getSettings } from '../../profile/index.js';
import { addTrainingPosition, removeTrainingPosition } from '../../training/index.js';
import { sound } from '../../sound/SoundManager.js';
import { detectOpening } from '../../data/openings.js';
import type { ReviewData } from './ReviewScreen.js';

export interface GameScreenEvents {
  onGameOver: (gameStats: ReviewData) => void;
  onExit: () => void;
}

export class GameScreen {
  private container: HTMLElement;
  private events: GameScreenEvents;
  private game: GameController;
  private board: ChessBoard | null = null;
  private feedbackCard: FeedbackCard | null = null;
  private moveList: MoveList | null = null;
  private clockView: ClockView | null = null;
  private opponentEngine: StockfishEngine;
  private analystEngine: StockfishEngine;
  private playerColor: 'white' | 'black';

  // Análise e estatísticas da partida
  private analyzedMoves: MoveAnalysis[] = [];
  private lastFenBeforePlayerMove = '';
  private lastEvalBeforeMove: { score: number; mate: number | null; bestMove: string; pv: string[] } | null = null;
  private isEngineThinking = false;
  private engineMoveAborted = false;
  private gameCompleted = false;
  private settings = getSettings();
  private mode = this.settings.gameMode ?? 'study';
  private targetElo = this.settings.engineStrengthMode === 'manual' ? this.settings.manualElo : (getProfile()?.estimatedElo ?? 1200) + 50;
  private id = newGameId();
  private phase: GamePhase = 'player';
  private paused = false;
  private destroyed = false;
  private ready = false;
  private analyzing = false;
  private epoch = 0;
  private hintLevel = 0;
  private hint: ProgressiveHint | null = null;
  private demo: Api | null = null;
  private demoIndex = 0;
  private autosave: ReturnType<typeof setInterval> | null = null;
  private visibility = () => { if (document.hidden) this.pauseGame(); };
  private pagehide = () => this.pauseGame();
  private restored: ActiveGame | null = null;

  constructor(container: HTMLElement, events: GameScreenEvents) {
    this.container = container;
    this.events = events;
    this.game = new GameController();

    this.restored = getActiveGame();
    if (this.restored) {
      this.settings = this.restored.settings;
      this.mode = this.restored.mode;
      this.targetElo = this.restored.targetElo;
      this.id = this.restored.id;
      this.game.loadPgn(this.restored.pgn);
      this.phase = this.restored.phase;
      this.analyzedMoves = this.restored.analyzedMoves;
      this.lastFenBeforePlayerMove = this.restored.lastFen;
      this.lastEvalBeforeMove = this.restored.cachedEval;
      this.paused = true;
    }
    this.playerColor = this.settings.playerColor;

    this.opponentEngine = new StockfishEngine();
    this.analystEngine = new StockfishEngine();
    this.init().catch(() => {
      if (this.destroyed) return;
      this.paused = true;
      this.renderActions();
      this.updateTurnIndicator('Motor indisponível. Saia e retome para tentar novamente.');
      this.persist();
    });
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.visibility);
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', this.pagehide);
      this.autosave = setInterval(() => this.persist(), 1000);
    }
  }

  private async init(): Promise<void> {
    this.renderLayout();
    await Promise.all([
      this.opponentEngine.init(),
      this.analystEngine.init(),
    ]);

    if (this.destroyed) return;
    await this.opponentEngine.setStrength(eloToEngineConfig(this.targetElo - 50));
    await this.analystEngine.setStrength({ skillLevel: 20, limitStrength: false });
    if (this.destroyed) return;
    this.ready = true;
    if (this.restored) {
      this.clockView?.restore(this.restored.clock);
      for (const m of this.game.getHistory()) this.moveList?.addMove(m);
      if (this.mode === 'study' && this.analyzedMoves.length) this.feedbackCard?.renderAnalysis(this.analyzedMoves.at(-1)!);
      this.board?.setInteractive(false);
      this.updateTurnIndicator('Partida pausada');
      this.renderActions();
      return;
    }
    this.persist();
    if (!await this.cachePositionEval()) return;
    if (this.destroyed || this.paused) return;
    this.clockView?.start(this.game.turn());
    if (this.gameCompleted || this.destroyed) return;
    this.board?.setInteractive(true);
    this.updateTurnIndicator('Sua vez');
    if (this.playerColor === 'black') await this.triggerEngineMove();
    this.renderActions();
  }

  private renderLayout(): void {
    const settings = this.settings;
    this.container.innerHTML = `
      <div class="game-screen compact-game">
        <header class="game-header">
          <button type="button" class="btn btn-ghost" id="btn-back-home">← Sair</button>
          <span class="game-mode-badge">${this.mode === 'study' ? 'Estudo' : 'Teste'} · ~${this.targetElo}</span>
          <button type="button" class="btn btn-ghost" id="btn-pause">Pausar</button>
        </header>
        <div class="game-status"><span id="turn-indicator-text" role="status">Preparando motor…</span><small id="save-status" role="status"></small></div>
        <div class="game-layout">
          <div class="board-pane">
            <div id="game-clock-container"></div>
            <div class="board-wrapper">
              ${settings.showEvalBar && this.mode === 'study' ? '<div class="live-eval-bar" id="live-eval-bar"><div class="live-eval-fill" id="live-eval-fill"></div><span class="live-eval-text" id="live-eval-text">0.0</span></div>' : ''}
              <div id="game-board-container" class="board-frame"></div>
            </div>
            <div class="game-controls" id="essential-controls">
              <button type="button" class="btn btn-secondary" id="btn-hint">Dica</button>
              <button type="button" class="btn btn-secondary" id="btn-understand" hidden>Entender</button>
              <button type="button" class="btn btn-secondary" id="btn-retry">Tentar de novo</button>
              <button type="button" class="btn btn-primary" id="btn-continue">Continuar</button>
            </div>
          </div>
          <section class="sidebar-pane coach-panel" aria-label="Painel da partida">
            <div class="panel-tabs" role="tablist">
              <button type="button" role="tab" aria-selected="true" data-game-tab="coach">Treinador</button>
              <button type="button" role="tab" aria-selected="false" data-game-tab="moves">Lances</button>
              <button type="button" role="tab" aria-selected="false" data-game-tab="details">Detalhes</button>
            </div>
            <div class="panel-scroll">
              <div data-panel="coach"><div id="hint-content" aria-live="polite"></div><div id="game-feedback-container"></div></div>
              <div data-panel="moves" hidden><div id="game-moves-container"></div></div>
              <div data-panel="details" hidden>
                <p>${this.mode === 'study' ? 'Dicas e novas tentativas não alteram seu Elo.' : 'Sem ajuda durante o jogo. O resultado ajusta seu Elo estimado.'}</p>
                <p id="opening-badge"></p>
                <button type="button" class="btn btn-secondary" id="btn-new-game">Nova partida</button>
                <button type="button" class="btn btn-danger" id="btn-resign">Desistir</button>
              </div>
            </div>
          </section>
        </div>
      </div>`;
    this.container.querySelectorAll<HTMLButtonElement>('[data-game-tab]').forEach(button => button.addEventListener('click', () => {
      this.container.querySelectorAll<HTMLElement>('[data-panel]').forEach(panel => panel.hidden = panel.dataset.panel !== button.dataset.gameTab);
      this.container.querySelectorAll('[data-game-tab]').forEach(tab => tab.setAttribute('aria-selected', String(tab === button)));
    }));
    this.container.querySelector('#btn-pause')?.addEventListener('click', () => this.pauseGame());
    this.container.querySelector('#btn-continue')?.addEventListener('click', () => { void this.continueGame(); });
    this.container.querySelector('#btn-understand')?.addEventListener('click', () => {
      const a = this.analyzedMoves.at(-1);
      if (!a?.fenBefore || this.mode === 'test') return;
      this.hint = explainPosition(a.fenBefore, a.bestMove, this.lastEvalBeforeMove?.pv);
      this.hintLevel = 3; this.showCoach(); this.renderHint();
    });
    this.container.querySelector('#btn-retry')?.addEventListener('click', () => this.handleRetryMove());
    // Instancia os subcomponentes
    const boardEl = this.container.querySelector<HTMLElement>('#game-board-container')!;
    this.board = new ChessBoard(boardEl, this.game, this.playerColor);

    const feedbackEl = this.container.querySelector<HTMLElement>('#game-feedback-container')!;
    this.feedbackCard = new FeedbackCard(feedbackEl);

    const movesEl = this.container.querySelector<HTMLElement>('#game-moves-container')!;
    this.moveList = new MoveList(movesEl);

    const clockEl = this.container.querySelector<HTMLElement>('#game-clock-container')!;
    this.clockView = new ClockView(clockEl, settings.clockMinutes);
    if (this.restored) this.clockView.restore(this.restored.clock);
    this.board.setInteractive(false);
    if (this.mode === 'test') this.feedbackCard.renderEmpty('Teste: a análise estará disponível após a partida.');
    this.renderActions();

    // Eventos do tabuleiro
    this.board.onMove(event => this.handlePlayerMove(event));

    // Eventos de feedback
    this.feedbackCard.onRetry(() => this.handleRetryMove());
    this.feedbackCard.onToggleArrow(shown => {
      if (shown) {
        const analysis = this.feedbackCard?.getCurrentAnalysis();
        if (analysis && this.mode === 'study') {
          this.board?.showAnalysisShapes(analysis);
        }
      } else {
        this.board?.clearShapes();
      }
    });

    // Eventos de controle
    this.container.querySelector('#btn-back-home')?.addEventListener('click', () => {
      this.pauseGame();
      this.events.onExit();
    });

    this.container.querySelector('#btn-hint')?.addEventListener('click', () => {
      this.handleAskHint();
    });

    this.container.querySelector('#btn-new-game')?.addEventListener('click', () => {
      this.handleNewGame();
    });

    this.container.querySelector('#btn-resign')?.addEventListener('click', () => {
      this.handleResign();
    });

    this.clockView.onTimeOut(color => {
      const winner = color === 'w' ? '0-1' : '1-0';
      this.finishGame(winner, 'Tempo esgotado');
    });
  }

  private updateEvalBar(score: number, mate: number | null): void {
    const fillEl = this.container.querySelector<HTMLElement>('#live-eval-fill');
    const textEl = this.container.querySelector<HTMLElement>('#live-eval-text');
    if (!fillEl || !textEl) return;

    if (mate !== null) {
      textEl.textContent = mate > 0 ? `+M${mate}` : `-M${Math.abs(mate)}`;
      if (fillEl.style) fillEl.style.height = mate > 0 ? '100%' : '0%';
    } else {
      const pawnScore = (score / 100).toFixed(1);
      textEl.textContent = score > 0 ? `+${pawnScore}` : pawnScore;
      const percent = Math.max(5, Math.min(95, 50 + 50 * (2 / (1 + Math.exp(-0.0035 * score)) - 1)));
      if (fillEl.style) fillEl.style.height = `${percent}%`;
    }
  }

  private updateOpeningBadge(): void {
    const moves = this.game.getHistory().map(m => m.san);
    const opening = detectOpening(moves);
    const badge = this.container.querySelector<HTMLElement>('#opening-badge');
    if (badge) {
      if (opening) {
        badge.textContent = `📖 ${opening.eco}: ${opening.name}`;
        badge.title = opening.description;
        if (badge.style) badge.style.display = 'inline-flex';
      } else {
        badge.textContent = '';
        if (badge.style) badge.style.display = 'none';
      }
    }
  }

  /**
   * Guarda em cache a avaliação analítica da posição atual antes do lance
   */
  private async cachePositionEval(): Promise<boolean> {
    const gameId = this.id;
    this.analyzing = true; this.lastEvalBeforeMove = null; this.renderActions();
    try {
      this.lastFenBeforePlayerMove = this.game.getFen();
      const fen = this.lastFenBeforePlayerMove;
      const evalResult = await this.analystEngine.evaluate(fen, 12);
      if (this.destroyed || this.id !== gameId || this.game.getFen() !== fen) return false;

      // Converte a pontuação para a perspectiva do jogador
      const isPlayerTurn = (this.game.turn() === 'w' && this.playerColor === 'white') ||
                           (this.game.turn() === 'b' && this.playerColor === 'black');

      const multiplier = isPlayerTurn ? 1 : -1;

      this.lastEvalBeforeMove = {
        score: evalResult.score * multiplier,
        mate: evalResult.mate !== null ? evalResult.mate * multiplier : null,
        bestMove: evalResult.bestMove,
        pv: evalResult.pv,
      };

      if (this.mode === 'study') this.updateEvalBar(this.lastEvalBeforeMove.score, this.lastEvalBeforeMove.mate);
      return true;
    } catch (err) {
      if (!this.destroyed) { this.pauseGame(); this.updateTurnIndicator('Análise indisponível. Toque em Continuar para tentar novamente.'); }
      return false;
    } finally { this.analyzing = false; if (!this.destroyed) this.renderActions(); }
  }

  /**
   * Processa o lance jogado pelo usuário
   */
  private async handlePlayerMove(event: MoveEvent): Promise<void> {
    if (this.gameCompleted || this.destroyed) return;
    const player = this.playerColor === 'white' ? 'w' : 'b';
    if (this.clockView?.expired?.(player)) {
      this.game.undoMove(); this.board?.sync();
      this.finishGame(player === 'w' ? '0-1' : '1-0', 'Tempo esgotado'); return;
    }
    const currentId = this.id;
    this.clearHint();
    this.phase = 'analysis';
    this.analyzing = true;
    this.persist();
    this.renderActions();

    hapticVibrate(15);
    this.board?.clearShapes();
    this.moveList?.addMove({
      san: event.san,
      from: event.from,
      to: event.to,
    });
    this.updateOpeningBadge();
    this.clockView?.stop();

    // Se o jogo acabou com o lance do jogador (ex: mate ou empate)
    if (this.game.isGameOver()) {
      await this.analyzePlayerMove(event);
      this.analyzing = false;
      if (this.destroyed) return;
      this.finishGame(this.game.getGameResult() || '1/2-1/2');
      return;
    }

    // Analisa o lance do jogador em paralelo com o motor pensando
    if (this.mode === 'study') this.feedbackCard?.renderAnalyzing();
    this.board?.setInteractive(false);
    this.updateTurnIndicator('Motor pensando...');

    // 1. Analisa lance do jogador
    const analysis = await this.analyzePlayerMove(event);
    this.analyzing = false;
    if (this.destroyed || this.gameCompleted || this.id !== currentId) return;
    if (analysis && this.mode === 'study') {
      if (analysis.quality === 'erro' || analysis.quality === 'erro_grave') {
        hapticVibrate([30, 40, 30]);
        sound.playMistake();
      } else if (analysis.quality === 'excelente') {
        sound.playSuccess();
      }
      this.moveList?.setLastMoveAnalysis(analysis);
      this.feedbackCard?.renderAnalysis(analysis);
      this.updateEvalBar(analysis.evalAfter, analysis.mateAfter);
    }

    this.phase = analysis?.isRetryable && this.mode === 'study' ? 'decision' : 'engine';
    this.persist();
    if (this.phase === 'decision') {
      this.clockView?.stop();
      this.showCoach();
      this.updateTurnIndicator('Reveja o erro ou continue');
      this.renderActions();
      return;
    }
    if (!this.paused) await this.triggerEngineMove();
  }

  /**
   * Executa a análise profunda do lance jogado
   */
  private async analyzePlayerMove(event: MoveEvent): Promise<MoveAnalysis | null> {
    const gameId = this.id;
    try {
      const fenAfter = this.game.getFen();
      const evalAfterEngine = await this.analystEngine.evaluate(fenAfter, 12);

      // Após o lance do jogador, é a vez do adversário (motor).
      // A avaliação do Stockfish vem da perspectiva do lado que move (adversário).
      // Invertemos para manter a perspectiva do jogador!
      const evalAfterPlayer = -evalAfterEngine.score;
      const mateAfterPlayer = evalAfterEngine.mate !== null ? -evalAfterEngine.mate : null;

      const evalBefore = this.lastEvalBeforeMove?.score ?? 0;
      const mateBefore = this.lastEvalBeforeMove?.mate ?? null;
      const bestMoveUci = this.lastEvalBeforeMove?.bestMove ?? event.from + event.to;

      // Converte bestMoveUci para SAN a partir de fenBefore
      let bestMoveSan = bestMoveUci;
      try {
        const testGame = new GameController(this.lastFenBeforePlayerMove);
        const bFrom = bestMoveUci.substring(0, 2);
        const bTo = bestMoveUci.substring(2, 4);
        const bPromo = bestMoveUci.length > 4 ? bestMoveUci[4] : undefined;
        const bMove = testGame.makeMove(bFrom, bTo, bPromo);
        if (bMove) bestMoveSan = bMove.san;
      } catch {
        // Fallback
      }

      const pColorCode = this.playerColor === 'white' ? 'w' : 'b';

      const ctx: PositionContext = {
        fen: fenAfter,
        moveNumber: this.game.moveNumber(),
        playerColor: pColorCode,
        evalBefore,
        mateBefore,
        bestMoveUci,
        bestMoveSan,
        pvBefore: this.lastEvalBeforeMove?.pv ?? [bestMoveUci],
        pvAfter: evalAfterEngine.pv,
        evalAfter: evalAfterPlayer,
        mateAfter: mateAfterPlayer,
        playerMoveSan: event.san,
        playerMoveUci: event.from + event.to + (event.promotion || ''),
        fenBefore: this.lastFenBeforePlayerMove,
        fenAfter,
      };

      if (this.destroyed || this.id !== gameId) return null;
      const analysis = {...analyzeMoveQuality(ctx), fenBefore: ctx.fenBefore, fenAfter: ctx.fenAfter};
      this.analyzedMoves.push(analysis);

      // Se for erro ou erro grave, adiciona à fila de treino de erros
      if (analysis.quality === 'erro' || analysis.quality === 'erro_grave') {
        addTrainingPosition({
          fen: this.lastFenBeforePlayerMove,
          bestMove: bestMoveUci,
          bestMoveSan,
          playerMove: event.san,
          explanation: analysis.explanation,
          errorType: analysis.quality,
          cpLoss: analysis.cpLoss,
          gameIndex: (getProfile()?.gamesPlayed ?? 0) + 1,
          category: analysis.category,
        });
      }

      return analysis;
    } catch (err) {
      console.warn('Erro ao analisar lance:', err);
      return null;
    }
  }

  /**
   * Resposta do motor oponente
   */
  private async triggerEngineMove(): Promise<void> {
    if (this.game.isGameOver() || this.gameCompleted || this.paused || this.destroyed) return;
    const token = ++this.epoch;
    this.phase = 'engine';
    this.persist();
    this.board?.setInteractive(false);

    this.isEngineThinking = true;
    this.engineMoveAborted = false;
    this.updateTurnIndicator('Motor pensando...');
    this.clockView?.start(this.game.turn());
    if (this.gameCompleted || this.destroyed) return;
    this.renderActions();

    try {
      const fen = this.game.getFen();
      const bestMove = await this.opponentEngine.getBestMove(fen, { moveTime: 800 });

      if (this.engineMoveAborted || this.destroyed || this.gameCompleted || this.paused || token !== this.epoch) {
        return;
      }

      if (this.clockView?.expired?.(this.game.turn())) { this.finishGame(this.game.turn() === 'w' ? '0-1' : '1-0', 'Tempo esgotado'); return; }
      const from = bestMove.substring(0, 2);
      const to = bestMove.substring(2, 4);
      const promotion = bestMove.length > 4 ? bestMove[4] : undefined;

      const move = this.game.makeMove(from, to, promotion);
      if (move) {
        hapticVibrate(12);
        if (this.game.isCheck()) {
          sound.playCheck();
        } else if (move.captured) {
          sound.playCapture();
        } else if (move.san === 'O-O' || move.san === 'O-O-O') {
          sound.playCastle();
        } else {
          sound.playMove();
        }
        this.board?.sync();
        this.moveList?.addMove({
          san: move.san,
          from,
          to,
        });
        this.updateOpeningBadge();
        this.phase = 'player';
        this.clockView?.stop();
        this.persist();
      }

      if (this.game.isGameOver()) { this.finishGame(this.game.getGameResult() || '1/2-1/2'); return; }
      // Analysis time is never charged to either player.
      if (!await this.cachePositionEval()) return;

      if (this.destroyed || this.paused || token !== this.epoch) return;
      // Verifica fim de jogo após o lance do motor
      if (this.game.isGameOver()) {
        this.finishGame(this.game.getGameResult() || '1/2-1/2');
        return;
      }

      this.isEngineThinking = false;
      this.clockView?.start(this.game.turn());
      if (this.gameCompleted || this.destroyed) return;
      this.board?.setInteractive(true);
      this.updateTurnIndicator('Sua vez');
      this.persist();
      this.renderActions();
    } catch (err) {
      if (this.engineMoveAborted || this.destroyed || token !== this.epoch) {
        return;
      }
      console.error('Erro na resposta do motor:', err);
      this.isEngineThinking = false;
      this.pauseGame();
      this.updateTurnIndicator('Falha no motor. Toque em Continuar para tentar novamente.');
    }
  }

  /**
   * Desfaz o lance para tentar de novo após Erro ou Erro Grave.
   * Cancela a busca do motor se em andamento ou desfaz ambos os lances
   * (resposta do motor + erro do jogador) caso o motor já tenha respondido.
   */
  public handleRetryMove(): void {
    if (this.mode === 'test' || this.destroyed || this.analyzing) return;
    this.epoch++;
    this.paused = false;
    this.clearHint();
    if (this.isEngineThinking) {
      this.engineMoveAborted = true;
      this.opponentEngine.stop();
      this.isEngineThinking = false;
    }

    const isPlayerTurn = (this.game.turn() === 'w' && this.playerColor === 'white') ||
                         (this.game.turn() === 'b' && this.playerColor === 'black');

    if (isPlayerTurn) {
      // O motor já havia respondido: desfaz lance do motor e o erro do jogador
      this.game.undoMove();
      this.moveList?.undoLastMove();
      this.game.undoMove();
      this.moveList?.undoLastMove();
    } else {
      // O motor ainda não respondeu (ex: busca cancelada): desfaz apenas o erro do jogador
      this.game.undoMove();
      this.moveList?.undoLastMove();
    }

    const undoneAnalysis = this.analyzedMoves.pop();
    this.lastFenBeforePlayerMove = this.game.getFen();
    if (undoneAnalysis) this.lastEvalBeforeMove = {score:undoneAnalysis.evalBefore,mate:undoneAnalysis.mateBefore,bestMove:undoneAnalysis.bestMove,pv:[undoneAnalysis.bestMove]};
    this.phase = 'player';
    this.gameCompleted = false;

    // Se o lance desfeito havia entrado na fila de treino de erros, remove-o
    if (this.lastFenBeforePlayerMove) {
      removeTrainingPosition(this.lastFenBeforePlayerMove);
    }

    this.board?.clearShapes();
    this.board?.sync();
    this.board?.setInteractive(true);
    this.feedbackCard?.renderEmpty('Tente encontrar um lance melhor desta vez!');
    this.updateTurnIndicator('Sua vez (segunda chance)');
    this.updateOpeningBadge();
    this.clockView?.switchTurn(this.game.turn());
    this.persist();
    this.renderActions();
    if (this.lastEvalBeforeMove) {
      this.updateEvalBar(this.lastEvalBeforeMove.score, this.lastEvalBeforeMove.mate);
    }
  }

  /**
   * Oferece dica do melhor lance
   */
  private async handleAskHint(): Promise<void> {
    if (this.mode === 'test' || this.destroyed || !this.ready || this.analyzing || this.isEngineThinking || this.phase !== 'player') return;
    if (!this.lastEvalBeforeMove?.bestMove) return;
    this.clockView?.stop();
    this.showCoach();
    try {
      this.hint ??= explainPosition(this.game.getFen(), this.lastEvalBeforeMove.bestMove, this.lastEvalBeforeMove.pv);
      this.hintLevel = Math.min(3, this.hintLevel + 1);
      this.renderHint();
    } catch { this.updateTurnIndicator('Não foi possível preparar a dica. Tente continuar.'); }
    this.renderActions();
  }

  private renderHint(): void {
    const el = this.container.querySelector<HTMLElement>('#hint-content');
    if (!el || !this.hint) return;
    const hint = this.hint;
    el.innerHTML = `<div class="hint-card"><small>Dica ${this.hintLevel}/3</small><p>${escapeHtml(this.hintLevel === 1 ? hint.observation : this.hintLevel === 2 ? hint.idea : hint.answer)}</p>
      ${this.hintLevel === 3 ? '<button type="button" class="btn btn-secondary" id="demo-open">Explorar continuação</button><div id="demo-region"></div>' : ''}</div>`;
    if (this.hintLevel === 3 && hint.frames[0].fen === this.game.getFen()) this.board?.showBestMove(hint.move.slice(0,2), hint.move.slice(2,4));
    el.querySelector('#demo-open')?.addEventListener('click', () => {
      const region = el.querySelector<HTMLElement>('#demo-region')!;
      region.innerHTML = '<p>Demonstração · não altera sua partida</p><div class="demo-board" id="demo-board"></div><div class="demo-nav"><button type="button" class="btn btn-secondary" id="demo-prev" aria-label="Lance anterior">←</button><span id="demo-label"></span><button type="button" class="btn btn-secondary" id="demo-next" aria-label="Próximo lance">→</button></div>';
      this.demo?.destroy(); this.demoIndex = 0;
      this.demo = Chessground(region.querySelector<HTMLElement>('#demo-board')!, {fen:hint.frames[0].fen,orientation:this.playerColor,viewOnly:true});
      const show = () => { this.demo?.set({fen:hint.frames[this.demoIndex].fen}); region.querySelector('#demo-label')!.textContent = hint.frames[this.demoIndex].san; };
      region.querySelector('#demo-prev')?.addEventListener('click', () => {this.demoIndex = Math.max(0,this.demoIndex-1);show();});
      region.querySelector('#demo-next')?.addEventListener('click', () => {this.demoIndex = Math.min(hint.frames.length-1,this.demoIndex+1);show();});
      show();
    });
  }

  private showCoach(): void {
    this.container.querySelectorAll<HTMLElement>('[data-panel]').forEach(panel => panel.hidden = panel.dataset.panel !== 'coach');
    this.container.querySelectorAll<HTMLElement>('[data-game-tab]').forEach(tab => tab.setAttribute('aria-selected',String(tab.dataset.gameTab === 'coach')));
    const scroll = this.container.querySelector<HTMLElement>('.panel-scroll'); if (scroll) scroll.scrollTop = 0;
  }

  private clearHint(): void {
    this.demo?.destroy(); this.demo = null; this.hint = null; this.hintLevel = 0;
    const el = this.container.querySelector<HTMLElement>('#hint-content'); if (el) el.innerHTML = '';
  }

  private renderActions(): void {
    const hint = this.container.querySelector<HTMLButtonElement>('#btn-hint');
    const retry = this.container.querySelector<HTMLButtonElement>('#btn-retry');
    const understand = this.container.querySelector<HTMLButtonElement>('#btn-understand');
    if (understand) { understand.hidden = this.mode === 'test' || this.phase !== 'decision'; understand.disabled = this.paused || this.analyzing; }
    const next = this.container.querySelector<HTMLButtonElement>('#btn-continue');
    if (hint) { hint.hidden = this.mode === 'test'; hint.disabled = !this.ready || this.paused || this.analyzing || this.isEngineThinking || this.phase !== 'player' || this.hintLevel >= 3; hint.textContent = this.hintLevel ? 'Mais uma dica' : 'Dica'; }
    if (retry) { retry.hidden = this.mode === 'test' || !this.analyzedMoves.at(-1)?.isRetryable; retry.disabled = this.paused || this.analyzing; }
    if (next) { next.hidden = !this.paused && this.phase !== 'decision' && !this.hintLevel; next.disabled = !this.ready || this.analyzing; next.textContent = this.paused ? 'Continuar partida' : 'Continuar'; }
  }

  private persist(): void {
    if (this.destroyed || this.gameCompleted) return;
    const durable = saveActiveGame({version:1,id:this.id,pgn:this.game.getPgn(),settings:this.settings,targetElo:this.targetElo,mode:this.mode,phase:this.phase,analyzedMoves:this.analyzedMoves,clock:this.clockView?.snapshot?.() ?? {white:this.settings.clockMinutes*60,black:this.settings.clockMinutes*60},lastFen:this.lastFenBeforePlayerMove,cachedEval:this.lastEvalBeforeMove});
    const label = this.container.querySelector('#save-status');
    if (label) label.textContent = durable ? 'Salvo no aparelho' : 'Não foi possível salvar no aparelho';
  }

  private pauseGame(): void {
    if (this.destroyed || this.gameCompleted) return;
    if (!this.analyzing && this.clockView?.expired?.(this.game.turn())) { this.finishGame(this.game.turn() === 'w' ? '0-1' : '1-0', 'Tempo esgotado'); return; }
    this.paused = true; this.epoch++; this.engineMoveAborted = true;
    this.opponentEngine.stop(); this.isEngineThinking = false;
    this.clockView?.stop(); this.board?.setInteractive(false);
    this.persist(); this.renderActions(); this.updateTurnIndicator('Partida pausada');
  }

  private async continueGame(): Promise<void> {
    if (!this.ready || this.destroyed || this.analyzing) return;
    this.paused = false; this.clearHint();
    if (this.game.isGameOver() && this.phase !== 'analysis') { this.finishGame(this.game.getGameResult() || '1/2-1/2'); return; }
    if (this.phase === 'analysis') {
      const last = this.game.getHistory().at(-1);
      if (last) { this.analyzing = true; const analysis = await this.analyzePlayerMove(last); this.analyzing = false;
        if (this.destroyed) return;
        if (this.game.isGameOver()) { this.finishGame(this.game.getGameResult() || '1/2-1/2'); return; }
        if (analysis && this.mode === 'study') this.feedbackCard?.renderAnalysis(analysis);
        this.phase = analysis?.isRetryable && this.mode === 'study' ? 'decision' : 'engine';
        this.persist(); if (this.phase === 'decision') { this.renderActions(); return; }
      }
    }
    if (this.paused || this.destroyed) return;
    if ((this.game.turn() === 'w') !== (this.playerColor === 'white')) {
      await this.triggerEngineMove();
    } else {
      this.phase = 'player'; this.board?.setInteractive(false);
      if (!await this.cachePositionEval()) return;
      if (this.paused || this.destroyed) return;
      this.clockView?.start(this.game.turn());
      if (this.gameCompleted || this.destroyed) return;
      this.board?.setInteractive(true); this.updateTurnIndicator('Sua vez');
    }
    this.persist(); this.renderActions();
  }

  public async handleNewGame(skipConfirm = false): Promise<void> {
    if (this.analyzing || !this.ready || this.destroyed) return;
    if (!skipConfirm && !await confirmAction('Substituir a partida em andamento?')) return;
    if (this.destroyed) return;
    const token = ++this.epoch;
    this.clockView?.stop(); this.board?.setInteractive(false); this.clearHint();
    this.engineMoveAborted = true; this.opponentEngine.stop(); this.isEngineThinking = true;
    this.renderActions();
    try {
      await Promise.all([this.opponentEngine.newGame(), this.analystEngine.newGame()]);
      if (this.destroyed || token !== this.epoch) return;
      this.id = newGameId(); this.phase = 'player'; this.paused = false;
      this.game.newGame(); this.analyzedMoves = []; this.gameCompleted = false;
      this.lastEvalBeforeMove = null; this.lastFenBeforePlayerMove = this.game.getFen();
      this.board?.clearShapes(); this.board?.sync(); this.moveList?.clear();
      this.feedbackCard?.renderEmpty(this.mode === 'test' ? 'Teste: a análise estará disponível após a partida.' : undefined);
      this.clockView?.reset?.(this.settings.clockMinutes);
      this.updateOpeningBadge(); this.persist();
      if (!await this.cachePositionEval() || this.destroyed || this.paused || token !== this.epoch) return;
      this.isEngineThinking = false;
      if (this.playerColor === 'black') await this.triggerEngineMove();
      else { this.clockView?.start('w'); if (this.gameCompleted || this.destroyed) return; this.board?.setInteractive(true); this.updateTurnIndicator('Sua vez'); }
      this.persist(); this.renderActions();
    } catch { if (!this.destroyed) this.pauseGame(); }
  }

  private async handleResign(): Promise<void> {
    if (this.analyzing || this.gameCompleted) return;
    this.pauseGame();
    if (await confirmAction('Desistir desta partida?')) {
      if (this.destroyed || this.gameCompleted) return;
      const winner = this.playerColor === 'white' ? '0-1' : '1-0';
      this.finishGame(winner, 'Você desistiu da partida');
    }
  }

  private updateTurnIndicator(text: string): void {
    const el = this.container.querySelector<HTMLElement>('#turn-indicator-text');
    if (el) el.textContent = text;
  }

  private finishGame(result: string, reason?: string): void {
    if (this.gameCompleted) return;
    this.gameCompleted = true;
    this.epoch++; this.opponentEngine.stop();

    hapticVibrate([40, 40, 80]);
    sound.playGameEnd();
    if (typeof this.clockView?.stop === 'function') {
      this.clockView.stop();
    }
    this.board?.setInteractive(false);

    // Compila estatísticas
    const totalMoves = this.analyzedMoves.length;
    const excellent = this.analyzedMoves.filter(m => m.quality === 'excelente').length;
    const good = this.analyzedMoves.filter(m => m.quality === 'bom').length;
    const inaccuracies = this.analyzedMoves.filter(m => m.quality === 'imprecisao').length;
    const mistakes = this.analyzedMoves.filter(m => m.quality === 'erro').length;
    const blunders = this.analyzedMoves.filter(m => m.quality === 'erro_grave').length;

    const totalCpLoss = this.analyzedMoves.reduce((acc, m) => acc + (m.cpLoss === 9999 ? 300 : m.cpLoss), 0);
    const acpl = totalMoves > 0 ? Math.round(totalCpLoss / totalMoves) : 0;
    const accuracy = totalMoves > 0 ? Math.round(((excellent + good) / totalMoves) * 100) : 0;

    const mistakesHistory = this.analyzedMoves
      .filter(m => m.quality === 'erro' || m.quality === 'erro_grave' || m.quality === 'imprecisao')
      .map(m => ({
        fen: m.fenBefore ?? this.game.getFen(),
        playerMove: m.playerMove,
        bestMove: m.bestMove,
        bestMoveSan: m.bestMoveSan,
        explanation: m.explanation,
        quality: m.quality,
        cpLoss: m.cpLoss,
      }));

    const completed = finalizeGame({
      id: this.id, mode: this.mode,
      accuracy,
      acpl,
      moveCount: totalMoves,
      excellentMoves: excellent,
      goodMoves: good,
      inaccuracies,
      mistakes,
      blunders,
      result,
      mistakesHistory,
      analyzedMoves: this.analyzedMoves,
      pgn: this.game.getPgn(),
      playerColor: this.playerColor,
    });
    this.events.onGameOver(completed);
  }

  destroy(): void {
    this.pauseGame();
    this.destroyed = true; this.epoch++;
    this.demo?.destroy();
    if (this.autosave) clearInterval(this.autosave);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.visibility);
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', this.pagehide);
    this.board?.destroy();
    this.clockView?.destroy();
    this.opponentEngine.destroy();
    this.analystEngine.destroy();
    this.container.innerHTML = '';
  }
}

function hapticVibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Silencioso em caso de erro ou browser sem suporte
  }
}
