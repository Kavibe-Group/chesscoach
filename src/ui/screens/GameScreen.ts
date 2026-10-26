import { GameController } from '../../game/GameController.js';
import { ChessBoard, type MoveEvent } from '../ChessBoard.js';
import { FeedbackCard } from '../FeedbackCard.js';
import { MoveList } from '../MoveList.js';
import { ClockView } from '../ClockView.js';
import { StockfishEngine, eloToEngineConfig } from '../../engine/StockfishEngine.js';
import { analyzeMoveQuality, type MoveAnalysis, type PositionContext } from '../../analysis/MoveAnalyzer.js';
import { getProfile, getSettings } from '../../profile/index.js';
import { addTrainingPosition, removeTrainingPosition } from '../../training/index.js';

export interface GameScreenEvents {
  onGameOver: (gameStats: {
    accuracy: number;
    acpl: number;
    moveCount: number;
    excellentMoves: number;
    goodMoves: number;
    inaccuracies: number;
    mistakes: number;
    blunders: number;
    result: string;
    mistakesHistory: {
      fen: string;
      playerMove: string;
      bestMove: string;
      bestMoveSan: string;
      explanation: string;
      quality: string;
      cpLoss: number;
    }[];
  }) => void;
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

  constructor(container: HTMLElement, events: GameScreenEvents) {
    this.container = container;
    this.events = events;
    this.game = new GameController();

    const settings = getSettings();
    this.playerColor = settings.playerColor;

    this.opponentEngine = new StockfishEngine();
    this.analystEngine = new StockfishEngine();
    this.init();
  }

  private async init(): Promise<void> {
    this.renderLayout();
    await Promise.all([
      this.opponentEngine.init(),
      this.analystEngine.init(),
    ]);

    // Configura força do motor oponente
    const profile = getProfile();
    const settings = getSettings();
    const targetElo = settings.engineStrengthMode === 'manual'
      ? settings.manualElo
      : (profile?.estimatedElo ?? 1000);

    const config = eloToEngineConfig(targetElo);
    await this.opponentEngine.setStrength(config);

    // Motor analista fica configurado para análise máxima
    await this.analystEngine.setStrength({ skillLevel: 20, limitStrength: false });

    // Avalia posição inicial para o primeiro lance do jogador
    await this.cachePositionEval();

    // Se o jogador escolheu Pretas, o motor joga primeiro (Brancas)
    if (this.playerColor === 'black') {
      await this.triggerEngineMove();
    }
  }

  private renderLayout(): void {
    const profile = getProfile();
    const settings = getSettings();
    const engineElo = settings.engineStrengthMode === 'manual'
      ? settings.manualElo
      : ((profile?.estimatedElo ?? 1000) + 50);

    this.container.innerHTML = `
      <div class="game-screen">
        <!-- Top bar -->
        <header class="game-header">
          <div class="header-left">
            <button type="button" class="btn btn-ghost" id="btn-back-home">← Início</button>
            <span class="game-mode-badge">Partida com Treinador</span>
          </div>

          <div class="engine-info-tag">
            <span class="engine-icon">🤖</span>
            <span>Motor Stockfish 19 (Elo ~${engineElo})</span>
          </div>
        </header>

        <div class="game-layout">
          <!-- Coluna do Tabuleiro -->
          <div class="board-pane">
            <div id="game-board-container" class="board-frame"></div>
          </div>

          <!-- Coluna Lateral: Feedback, Lances e Controles -->
          <div class="sidebar-pane">
            <!-- Relógio -->
            <div id="game-clock-container"></div>

            <!-- Card de Feedback pós-lance (O Coração do Produto) -->
            <div id="game-feedback-container"></div>

            <!-- Lista de lances -->
            <div class="card moves-panel">
              <div class="moves-header">
                <h3>Lances da Partida</h3>
                <span id="turn-indicator-text" class="turn-text">Sua vez</span>
              </div>
              <div id="game-moves-container" class="moves-scroll"></div>
            </div>

            <!-- Controles de partida -->
            <div class="game-controls card">
              <button type="button" class="btn btn-secondary" id="btn-hint" title="Receber dica do melhor lance">
                💡 Pedir Dica
              </button>
              <button type="button" class="btn btn-secondary" id="btn-new-game" title="Reiniciar partida">
                🔄 Nova Partida
              </button>
              <button type="button" class="btn btn-danger" id="btn-resign" title="Desistir da partida">
                🏳 Desistir
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Instancia os subcomponentes
    const boardEl = this.container.querySelector<HTMLElement>('#game-board-container')!;
    this.board = new ChessBoard(boardEl, this.game, this.playerColor);

    const feedbackEl = this.container.querySelector<HTMLElement>('#game-feedback-container')!;
    this.feedbackCard = new FeedbackCard(feedbackEl);

    const movesEl = this.container.querySelector<HTMLElement>('#game-moves-container')!;
    this.moveList = new MoveList(movesEl);

    const clockEl = this.container.querySelector<HTMLElement>('#game-clock-container')!;
    this.clockView = new ClockView(clockEl, settings.clockMinutes);

    // Eventos do tabuleiro
    this.board.onMove(event => this.handlePlayerMove(event));

    // Eventos de feedback
    this.feedbackCard.onRetry(() => this.handleRetryMove());
    this.feedbackCard.onToggleArrow(shown => {
      if (shown) {
        const analysis = this.feedbackCard?.getCurrentAnalysis();
        if (analysis) {
          this.board?.showAnalysisShapes(analysis);
        }
      } else {
        this.board?.clearShapes();
      }
    });

    // Eventos de controle
    this.container.querySelector('#btn-back-home')?.addEventListener('click', () => {
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

  /**
   * Guarda em cache a avaliação analítica da posição atual antes do lance
   */
  private async cachePositionEval(): Promise<void> {
    try {
      this.lastFenBeforePlayerMove = this.game.getFen();
      const evalResult = await this.analystEngine.evaluate(this.lastFenBeforePlayerMove, 12);

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
    } catch (err) {
      console.warn('Erro ao avaliar posição pré-lance:', err);
    }
  }

  /**
   * Processa o lance jogado pelo usuário
   */
  private async handlePlayerMove(event: MoveEvent): Promise<void> {
    if (this.gameCompleted) return;

    this.board?.clearShapes();
    this.moveList?.addMove({
      san: event.san,
      from: event.from,
      to: event.to,
    });

    // Se o jogo acabou com o lance do jogador (ex: mate ou empate)
    if (this.game.isGameOver()) {
      await this.analyzePlayerMove(event);
      this.finishGame(this.game.getGameResult() || '1/2-1/2');
      return;
    }

    // Analisa o lance do jogador em paralelo com o motor pensando
    this.feedbackCard?.renderAnalyzing();
    this.board?.setInteractive(false);
    this.updateTurnIndicator('Motor pensando...');

    // 1. Analisa lance do jogador
    const analysis = await this.analyzePlayerMove(event);
    if (analysis) {
      this.moveList?.setLastMoveAnalysis(analysis);
      this.feedbackCard?.renderAnalysis(analysis);
    }

    // 2. O motor oponente joga
    await this.triggerEngineMove();
  }

  /**
   * Executa a análise profunda do lance jogado
   */
  private async analyzePlayerMove(event: MoveEvent): Promise<MoveAnalysis | null> {
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

      const analysis = analyzeMoveQuality(ctx);
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
    if (this.game.isGameOver() || this.gameCompleted) return;

    this.isEngineThinking = true;
    this.engineMoveAborted = false;
    this.updateTurnIndicator('Motor pensando...');

    try {
      const fen = this.game.getFen();
      const bestMove = await this.opponentEngine.getBestMove(fen, { moveTime: 800 });

      if (this.engineMoveAborted) {
        return;
      }

      const from = bestMove.substring(0, 2);
      const to = bestMove.substring(2, 4);
      const promotion = bestMove.length > 4 ? bestMove[4] : undefined;

      const move = this.game.makeMove(from, to, promotion);
      if (move) {
        this.board?.sync();
        this.moveList?.addMove({
          san: move.san,
          from,
          to,
        });
      }

      // Prepara cache de avaliação para o próximo lance do jogador
      await this.cachePositionEval();

      // Verifica fim de jogo após o lance do motor
      if (this.game.isGameOver()) {
        this.finishGame(this.game.getGameResult() || '1/2-1/2');
        return;
      }

      this.isEngineThinking = false;
      this.board?.setInteractive(true);
      this.updateTurnIndicator('Sua vez');
    } catch (err) {
      if (this.engineMoveAborted) {
        return;
      }
      console.error('Erro na resposta do motor:', err);
      this.isEngineThinking = false;
      this.board?.setInteractive(true);
      this.updateTurnIndicator('Sua vez');
    }
  }

  /**
   * Desfaz o lance para tentar de novo após Erro ou Erro Grave.
   * Cancela a busca do motor se em andamento ou desfaz ambos os lances
   * (resposta do motor + erro do jogador) caso o motor já tenha respondido.
   */
  public handleRetryMove(): void {
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

    this.analyzedMoves.pop();
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
  }

  /**
   * Oferece dica do melhor lance
   */
  private async handleAskHint(): Promise<void> {
    if (this.isEngineThinking || this.game.isGameOver()) return;

    if (this.lastEvalBeforeMove?.bestMove) {
      const from = this.lastEvalBeforeMove.bestMove.substring(0, 2);
      const to = this.lastEvalBeforeMove.bestMove.substring(2, 4);
      this.board?.showBestMove(from, to);
    }
  }

  public async handleNewGame(skipConfirm = false): Promise<void> {
    if (skipConfirm || confirm('Deseja iniciar uma nova partida?')) {
      this.engineMoveAborted = true;
      this.opponentEngine.stop();
      this.isEngineThinking = false;

      await Promise.all([
        this.opponentEngine.newGame(),
        this.analystEngine.newGame(),
      ]);

      this.game.newGame();
      this.analyzedMoves = [];
      this.gameCompleted = false;
      this.board?.clearShapes();
      this.board?.sync();
      this.board?.setInteractive(true);
      this.moveList?.clear();
      this.feedbackCard?.renderEmpty();
      this.updateTurnIndicator(this.playerColor === 'white' ? 'Sua vez' : 'Motor pensando...');
      await this.cachePositionEval();

      if (this.playerColor === 'black') {
        await this.triggerEngineMove();
      }
    }
  }

  private handleResign(): void {
    if (confirm('Tem certeza que deseja desistir da partida?')) {
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

    this.clockView?.stop();
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
    const accuracy = totalMoves > 0 ? Math.round(((excellent + good) / totalMoves) * 100) : 100;

    const mistakesHistory = this.analyzedMoves
      .filter(m => m.quality === 'erro' || m.quality === 'erro_grave' || m.quality === 'imprecisao')
      .map(m => ({
        fen: this.game.getFen(),
        playerMove: m.playerMove,
        bestMove: m.bestMove,
        bestMoveSan: m.bestMoveSan,
        explanation: m.explanation,
        quality: m.quality,
        cpLoss: m.cpLoss,
      }));

    this.events.onGameOver({
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
    });
  }

  destroy(): void {
    this.board?.destroy();
    this.clockView?.destroy();
    this.opponentEngine.destroy();
    this.analystEngine.destroy();
    this.container.innerHTML = '';
  }
}
