import { Chess } from 'chess.js';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Key } from 'chessground/types';
import type { DrawShape } from 'chessground/draw';
import { updateEloAfterGame, getProfile, getEloBand, saveGameStats } from '../../profile/index.js';
import type { GameStats, PlayerProfile } from '../../profile/index.js';
import type { MoveAnalysis, TacticalShape } from '../../analysis/MoveAnalyzer.js';

export interface ReviewScreenEvents {
  onPlayAgain: () => void;
  onGoTraining: () => void;
  onGoHome: () => void;
}

export interface ReviewMistake {
  fen: string;
  playerMove: string;
  bestMove: string;
  bestMoveSan: string;
  explanation: string;
  quality: string;
  cpLoss: number;
}

export interface ReviewData {
  accuracy: number;
  acpl: number;
  moveCount: number;
  excellentMoves: number;
  goodMoves: number;
  inaccuracies: number;
  mistakes: number;
  blunders: number;
  result: string;
  mistakesHistory: ReviewMistake[];
  analyzedMoves?: MoveAnalysis[];
  pgn?: string;
  playerColor?: 'white' | 'black';
}

export interface ReplayMove {
  ply: number;
  moveNumber: number;
  color: 'w' | 'b';
  san: string;
  uci: string;
  from: string;
  to: string;
  fenBefore: string;
  fenAfter: string;
  isCheck: boolean;
  analysis?: MoveAnalysis;
}

export class ReviewScreen {
  private container: HTMLElement;
  private events: ReviewScreenEvents;
  private data: ReviewData;
  private playerColor: 'white' | 'black';
  private eloDelta = 0;
  private updatedProfile: PlayerProfile | null = null;

  // Estado do replay lance-a-lance
  private replayMoves: ReplayMove[] = [];
  private currentReplayIndex = 0;
  private activeTab: 'summary' | 'replay' = 'summary';
  private reviewBoard: Api | null = null;
  private boardContainer: HTMLElement | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(container: HTMLElement, data: ReviewData, events: ReviewScreenEvents) {
    this.container = container;
    this.events = events;
    this.data = data;
    this.playerColor = data.playerColor || 'white';

    this.processStatsAndUpdateProfile();
    this.buildReplayTimeline();
    this.render();
  }

  private processStatsAndUpdateProfile(): void {
    const profile = getProfile();
    if (!profile) return;

    const eloBefore = profile.estimatedElo;
    const gameStats: GameStats = {
      accuracy: this.data.accuracy,
      acpl: this.data.acpl,
      moveCount: this.data.moveCount,
      excellentMoves: this.data.excellentMoves,
      goodMoves: this.data.goodMoves,
      inaccuracies: this.data.inaccuracies,
      mistakes: this.data.mistakes,
      blunders: this.data.blunders,
      result: this.data.result,
      date: new Date().toISOString(),
    };

    saveGameStats(gameStats);
    this.updatedProfile = updateEloAfterGame(profile, gameStats);
    this.eloDelta = this.updatedProfile.estimatedElo - eloBefore;
  }

  /**
   * Reconstrói a linha do tempo completa lance a lance a partir do PGN e análises
   */
  private buildReplayTimeline(): void {
    const pgn = this.data.pgn;
    const analyzedMoves = this.data.analyzedMoves || [];
    const pColorCode = this.playerColor === 'white' ? 'w' : 'b';

    const chess = new Chess();
    if (pgn) {
      try {
        chess.loadPgn(pgn);
      } catch {
        // Fallback se o PGN tiver erro
      }
    }

    const historyMoves = chess.history({ verbose: true });
    const replayRebuilder = new Chess();

    let analysisIdx = 0;
    this.replayMoves = [];

    // Adiciona posição inicial (ply 0)
    this.replayMoves.push({
      ply: 0,
      moveNumber: 0,
      color: 'w',
      san: 'Posição Inicial',
      uci: '',
      from: '',
      to: '',
      fenBefore: replayRebuilder.fen(),
      fenAfter: replayRebuilder.fen(),
      isCheck: false,
    });

    for (let i = 0; i < historyMoves.length; i++) {
      const m = historyMoves[i];
      const fenBefore = replayRebuilder.fen();
      replayRebuilder.move(m);
      const fenAfter = replayRebuilder.fen();
      const isCheck = replayRebuilder.isCheck();

      let moveAnalysis: MoveAnalysis | undefined = undefined;
      if (m.color === pColorCode && analysisIdx < analyzedMoves.length) {
        moveAnalysis = analyzedMoves[analysisIdx];
        analysisIdx++;
      }

      this.replayMoves.push({
        ply: i + 1,
        moveNumber: Math.floor(i / 2) + 1,
        color: m.color,
        san: m.san,
        uci: m.from + m.to + (m.promotion || ''),
        from: m.from,
        to: m.to,
        fenBefore,
        fenAfter,
        isCheck,
        analysis: moveAnalysis,
      });
    }

    // Se houver lances, inicia a navegação no primeiro erro ou no último lance
    const firstMistakeIdx = this.replayMoves.findIndex(m =>
      m.analysis && (m.analysis.quality === 'erro' || m.analysis.quality === 'erro_grave' || m.analysis.quality === 'imprecisao')
    );
    this.currentReplayIndex = firstMistakeIdx > 0 ? firstMistakeIdx : Math.max(0, this.replayMoves.length - 1);
  }

  private getMiniLesson(): { title: string; text: string; icon: string } {
    if (this.data.blunders > 0) {
      return {
        icon: '🛡️',
        title: 'Minilição: Verificação de Segurança em 3 Passos',
        text: 'A maioria dos erros graves acontece quando deixamos peças desprotegidas ou não percebemos a resposta imediata do adversário. Antes de soltar a peça no tabuleiro, pergunte-se: 1. A casa de destino é segura? 2. Alguma peça minha ficou desprotegida? 3. O adversário ganha algum xeque ou garfo perigoso?',
      };
    }

    if (this.data.mistakes > 0) {
      return {
        icon: '⚖️',
        title: 'Minilição: Cálculo de Trocas e Táticas',
        text: 'Em disputas táticas, conte sempre o número de atacantes versus defensores. Se o adversário tiver mais peças atacando uma casa do que você tem defendendo, iniciar a troca naquela casa quase sempre perde material.',
      };
    }

    if (this.data.inaccuracies > 0) {
      return {
        icon: '♟️',
        title: 'Minilição: Atividade de Peças e Controle Central',
        text: 'Pequenas imprecisões acumulam-se com lances passivos. Procure sempre posicionar seus cavalos e bispos em casas onde eles controlem mais espaço e pressionem o centro.',
      };
    }

    return {
      icon: '⭐',
      title: 'Minilição: Partida de Alto Nível!',
      text: 'Excelente precisão tática! Você manteve a posição equilibrada e aproveitou os lances com consistência. Continue mantendo esse foco nas próximas partidas.',
    };
  }

  private render(): void {
    const profile = this.updatedProfile || getProfile();
    const eloBand = profile ? getEloBand(profile.estimatedElo) : '';
    const lesson = this.getMiniLesson();

    const eloChangeClass = this.eloDelta >= 0 ? 'elo-up' : 'elo-down';
    const eloChangeText = this.eloDelta >= 0 ? `+${this.eloDelta}` : `${this.eloDelta}`;

    const top3Mistakes = [...this.data.mistakesHistory]
      .sort((a, b) => (b.cpLoss === 9999 ? 10000 : b.cpLoss) - (a.cpLoss === 9999 ? 10000 : a.cpLoss))
      .slice(0, 3);

    const resultLabel = this.data.result === '1-0'
      ? (this.playerColor === 'white' ? '🎉 Vitória!' : 'Derrota')
      : this.data.result === '0-1'
      ? (this.playerColor === 'black' ? '🎉 Vitória!' : 'Derrota')
      : 'Empate (1/2-1/2)';

    this.container.innerHTML = `
      <div class="review-screen">
        <header class="review-header">
          <div class="review-title-row">
            <span class="review-badge">Revisão Pós-Partida</span>
            <div class="review-tabs">
              <button type="button" class="tab-btn ${this.activeTab === 'summary' ? 'active' : ''}" id="tab-summary">
                📊 Resumo & Estatísticas
              </button>
              <button type="button" class="tab-btn ${this.activeTab === 'replay' ? 'active' : ''}" id="tab-replay">
                🔍 Análise Lance a Lance
              </button>
            </div>
          </div>
          <h1 class="review-result-title">${resultLabel}</h1>
        </header>

        <!-- ABA 1: RESUMO DA PARTIDA -->
        <div id="view-summary" class="review-tab-content ${this.activeTab === 'summary' ? 'active' : ''}">
          <!-- Cartão de Elo e Adaptação do Motor -->
          <div class="card elo-adaptation-card">
            <div class="elo-adaptation-header">
              <span class="coach-badge">🤖 Treinador Dinâmico</span>
              <span class="elo-delta-tag ${eloChangeClass}">Elo ${eloChangeText}</span>
            </div>
            <div class="elo-adaptation-body">
              <div class="elo-big-number">
                <span class="val">${profile?.estimatedElo ?? '—'}</span>
                <span class="band">${eloBand}</span>
              </div>
              <p class="elo-adaptation-desc">
                ${this.eloDelta >= 0
                  ? `Excelente jogo! O motor oponente elevou o nível para <strong>Elo ~${(profile?.estimatedElo ?? 1000) + 50}</strong> para calibrar seu próximo desafio.`
                  : `Partida difícil! O motor ajustou o nível para <strong>Elo ~${(profile?.estimatedElo ?? 1000) + 50}</strong> para consolidar seus fundamentos.`}
              </p>
            </div>
          </div>

          <!-- Estatísticas principais -->
          <div class="card stats-overview-card">
            <div class="stats-overview-grid">
              <div class="overview-item">
                <span class="overview-value">${this.data.accuracy}%</span>
                <span class="overview-label">Precisão</span>
              </div>
              <div class="overview-item">
                <span class="overview-value">${this.data.acpl}</span>
                <span class="overview-label">ACPL (Perda média)</span>
              </div>
              <div class="overview-item">
                <span class="overview-value">${this.data.moveCount}</span>
                <span class="overview-label">Lances jogados</span>
              </div>
            </div>

            <!-- Distribuição de qualidade -->
            <div class="quality-distribution-bar">
              <span class="qd-item exc" title="Excelente">${this.data.excellentMoves} Exc.</span>
              <span class="qd-item bom" title="Bom">${this.data.goodMoves} Bons</span>
              <span class="qd-item imp" title="Imprecisão">${this.data.inaccuracies} Imp.</span>
              <span class="qd-item err" title="Erro">${this.data.mistakes} Erros</span>
              <span class="qd-item grav" title="Erro Grave">${this.data.blunders} Graves</span>
            </div>
          </div>

          <!-- Os 3 Momentos Mais Caros -->
          <div class="card top-mistakes-card">
            <div class="card-header-flex">
              <h2>🎯 Momentos Críticos da Partida</h2>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-jump-to-first-mistake">
                Examinar no Tabuleiro →
              </button>
            </div>

            ${top3Mistakes.length === 0 ? `
              <p class="no-mistakes-msg">Nenhum erro grave detectado nesta partida! Parabéns pelo jogo sólido.</p>
            ` : `
              <div class="mistakes-list">
                ${top3Mistakes.map((m, idx) => `
                  <div class="mistake-item">
                    <div class="mistake-header">
                      <span class="mistake-num">#${idx + 1}</span>
                      <span class="mistake-tag ${m.quality}">${m.quality === 'erro_grave' ? 'Erro Grave' : m.quality === 'erro' ? 'Erro' : 'Imprecisão'}</span>
                      <span class="mistake-loss">-${m.cpLoss === 9999 ? 'Mate' : `${m.cpLoss} cp`}</span>
                    </div>
                    <div class="mistake-moves">
                      <span class="player-move">Seu lance: <strong>${m.playerMove}</strong></span>
                      <span class="best-move">Melhor lance: <strong>${m.bestMoveSan}</strong></span>
                    </div>
                    <p class="mistake-explanation">${m.explanation}</p>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <!-- Minilição personalizada -->
          <div class="card mini-lesson-card">
            <div class="mini-lesson-header">
              <span class="mini-lesson-icon">${lesson.icon}</span>
              <h3>${lesson.title}</h3>
            </div>
            <p class="mini-lesson-text">${lesson.text}</p>
          </div>

          <!-- Ações principais -->
          <div class="review-actions">
            <div class="actions-row">
              <button type="button" class="btn btn-primary btn-xl" id="btn-review-play-again">
                ⚔️ Jogar Novamente
              </button>
              <button type="button" class="btn btn-secondary btn-xl" id="btn-review-go-training">
                🧩 Treinar meus erros
              </button>
            </div>
            <div class="secondary-row">
              <button type="button" class="btn btn-ghost" id="btn-copy-pgn">
                📋 Copiar PGN da partida
              </button>
              <button type="button" class="btn btn-ghost" id="btn-review-go-home">
                ← Menu Principal
              </button>
            </div>
          </div>
        </div>

        <!-- ABA 2: ANÁLISE LANCE A LANCE (ESTILO LICHESS) -->
        <div id="view-replay" class="review-tab-content ${this.activeTab === 'replay' ? 'active' : ''}">
          <div class="replay-layout">
            <!-- Coluna do Tabuleiro com Barra de Avaliação -->
            <div class="replay-board-pane">
              <div class="eval-bar-wrapper" id="replay-eval-bar">
                <div class="eval-bar-fill" id="eval-bar-fill" style="height: 50%;"></div>
                <span class="eval-score-text" id="eval-score-text">0.0</span>
              </div>
              <div id="replay-board-container" class="board-frame"></div>
            </div>

            <!-- Coluna de Navegação e Análise -->
            <div class="replay-details-pane">
              <!-- Barra de Controles de Navegação -->
              <div class="card replay-controls">
                <div class="nav-buttons-group">
                  <button type="button" class="btn btn-secondary btn-sm" id="btn-replay-start" title="Primeiro lance">|◀</button>
                  <button type="button" class="btn btn-secondary btn-sm" id="btn-replay-prev" title="Lance anterior (Seta esquerda)">◀</button>
                  <button type="button" class="btn btn-secondary btn-sm" id="btn-replay-next" title="Próximo lance (Seta direita)">▶</button>
                  <button type="button" class="btn btn-secondary btn-sm" id="btn-replay-end" title="Último lance">▶|</button>
                </div>
                <button type="button" class="btn btn-danger btn-sm" id="btn-replay-next-mistake" title="Pular para o próximo erro">
                  ⚡ Próximo Erro
                </button>
              </div>

              <!-- Card de Feedback do Lance Selecionado -->
              <div class="card replay-move-analysis" id="replay-analysis-card">
                <!-- Preenchido dinamicamente por updateReplayUI -->
              </div>

              <!-- Lista de lances com navegação clicável -->
              <div class="card replay-moves-scroll">
                <div class="moves-header">
                  <h3>Lances da Partida</h3>
                  <span class="keyboard-tip">💡 Use as setas ← e → do teclado</span>
                </div>
                <div class="moves-grid" id="replay-moves-list">
                  <!-- Gerado dinamicamente -->
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    if (this.activeTab === 'replay') {
      this.initReplayBoard();
    }
  }

  private bindEvents(): void {
    // Alternância de abas
    this.container.querySelector('#tab-summary')?.addEventListener('click', () => {
      this.activeTab = 'summary';
      this.container.querySelector('#tab-summary')?.classList.add('active');
      this.container.querySelector('#tab-replay')?.classList.remove('active');
      this.container.querySelector('#view-summary')?.classList.add('active');
      this.container.querySelector('#view-replay')?.classList.remove('active');
    });

    this.container.querySelector('#tab-replay')?.addEventListener('click', () => {
      this.activeTab = 'replay';
      this.container.querySelector('#tab-replay')?.classList.add('active');
      this.container.querySelector('#tab-summary')?.classList.remove('active');
      this.container.querySelector('#view-replay')?.classList.add('active');
      this.container.querySelector('#view-summary')?.classList.remove('active');
      this.initReplayBoard();
    });

    this.container.querySelector('#btn-jump-to-first-mistake')?.addEventListener('click', () => {
      const firstMistake = this.replayMoves.findIndex(m =>
        m.analysis && (m.analysis.quality === 'erro' || m.analysis.quality === 'erro_grave' || m.analysis.quality === 'imprecisao')
      );
      if (firstMistake > 0) {
        this.currentReplayIndex = firstMistake;
      }
      (this.container.querySelector('#tab-replay') as HTMLButtonElement)?.click();
    });

    // Ações de navegação do app
    this.container.querySelector('#btn-review-play-again')?.addEventListener('click', () => {
      this.events.onPlayAgain();
    });
    this.container.querySelector('#btn-review-go-training')?.addEventListener('click', () => {
      this.events.onGoTraining();
    });
    this.container.querySelector('#btn-review-go-home')?.addEventListener('click', () => {
      this.events.onGoHome();
    });

    // Copiar PGN
    this.container.querySelector('#btn-copy-pgn')?.addEventListener('click', (e) => {
      const pgn = this.data.pgn || '';
      navigator.clipboard.writeText(pgn).then(() => {
        const btn = e.target as HTMLButtonElement;
        const originalText = btn.textContent;
        btn.textContent = '✅ PGN Copiado!';
        setTimeout(() => {
          btn.textContent = originalText;
        }, 2000);
      });
    });

    // Controles de Replay
    this.container.querySelector('#btn-replay-start')?.addEventListener('click', () => {
      this.goToPly(0);
    });
    this.container.querySelector('#btn-replay-prev')?.addEventListener('click', () => {
      this.goToPly(this.currentReplayIndex - 1);
    });
    this.container.querySelector('#btn-replay-next')?.addEventListener('click', () => {
      this.goToPly(this.currentReplayIndex + 1);
    });
    this.container.querySelector('#btn-replay-end')?.addEventListener('click', () => {
      this.goToPly(this.replayMoves.length - 1);
    });
    this.container.querySelector('#btn-replay-next-mistake')?.addEventListener('click', () => {
      this.jumpToNextMistake();
    });

    // Teclado (ArrowLeft / ArrowRight)
    if (typeof window !== 'undefined') {
      if (this.keydownHandler) {
        window.removeEventListener('keydown', this.keydownHandler);
      }
      this.keydownHandler = (e: KeyboardEvent) => {
        if (this.activeTab !== 'replay') return;
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          this.goToPly(this.currentReplayIndex - 1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          this.goToPly(this.currentReplayIndex + 1);
        }
      };
      window.addEventListener('keydown', this.keydownHandler);
    }
  }

  private initReplayBoard(): void {
    if (this.reviewBoard) return;

    this.boardContainer = this.container.querySelector<HTMLElement>('#replay-board-container');
    if (!this.boardContainer) return;

    const currentMove = this.replayMoves[this.currentReplayIndex];
    const initialFen = currentMove ? currentMove.fenAfter : 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    this.reviewBoard = Chessground(this.boardContainer, {
      fen: initialFen,
      orientation: this.playerColor,
      viewOnly: true,
      animation: { enabled: true, duration: 180 },
      drawable: { enabled: true, visible: true },
    });

    this.renderMovesList();
    this.updateReplayPosition();
  }

  private goToPly(index: number): void {
    if (index < 0 || index >= this.replayMoves.length) return;
    this.currentReplayIndex = index;
    this.updateReplayPosition();
  }

  private jumpToNextMistake(): void {
    for (let i = this.currentReplayIndex + 1; i < this.replayMoves.length; i++) {
      const m = this.replayMoves[i];
      if (m.analysis && (m.analysis.quality === 'erro' || m.analysis.quality === 'erro_grave' || m.analysis.quality === 'imprecisao')) {
        this.goToPly(i);
        return;
      }
    }
    // Se não encontrou para frente, busca do início
    for (let i = 0; i <= this.currentReplayIndex; i++) {
      const m = this.replayMoves[i];
      if (m.analysis && (m.analysis.quality === 'erro' || m.analysis.quality === 'erro_grave' || m.analysis.quality === 'imprecisao')) {
        this.goToPly(i);
        return;
      }
    }
  }

  private updateReplayPosition(): void {
    const move = this.replayMoves[this.currentReplayIndex];
    if (!move) return;

    // Atualiza tabuleiro visual
    if (this.reviewBoard) {
      const lastMove: [Key, Key] | undefined = (move.from && move.to)
        ? [move.from as Key, move.to as Key]
        : undefined;

      this.reviewBoard.set({
        fen: move.fenAfter,
        check: move.isCheck,
        lastMove,
      });

      // Renderiza setas táticas
      if (move.analysis && move.analysis.shapes && move.analysis.shapes.length > 0) {
        const shapes: DrawShape[] = move.analysis.shapes.map(s => ({
          orig: s.orig as Key,
          dest: s.dest ? (s.dest as Key) : undefined,
          brush: s.brush,
        }));
        this.reviewBoard.setAutoShapes(shapes);
      } else {
        this.reviewBoard.setAutoShapes([]);
      }
    }

    // Atualiza barra de avaliação
    this.updateEvalBar(move);

    // Atualiza card de análise
    this.renderReplayAnalysisCard(move);

    // Destaca lance selecionado na lista
    this.container.querySelectorAll('.replay-move-item').forEach(el => {
      el.classList.remove('active');
    });
    const activeEl = this.container.querySelector(`#move-ply-${move.ply}`);
    if (activeEl) {
      activeEl.classList.add('active');
      if (typeof activeEl.scrollIntoView === 'function') {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }

  private updateEvalBar(move: ReplayMove): void {
    const fillEl = this.container.querySelector<HTMLElement>('#eval-bar-fill');
    const textEl = this.container.querySelector<HTMLElement>('#eval-score-text');
    if (!fillEl || !textEl) return;

    if (move.analysis) {
      const cp = move.analysis.evalAfter;
      const mate = move.analysis.mateAfter;

      if (mate !== null) {
        textEl.textContent = mate > 0 ? `+M${mate}` : `-M${Math.abs(mate)}`;
        fillEl.style.height = mate > 0 ? '100%' : '0%';
      } else {
        const pawnScore = (cp / 100).toFixed(1);
        textEl.textContent = cp > 0 ? `+${pawnScore}` : pawnScore;
        // Função sigmoide suave entre 5% e 95%
        const percent = Math.max(5, Math.min(95, 50 + 50 * (2 / (1 + Math.exp(-0.0035 * cp)) - 1)));
        fillEl.style.height = `${percent}%`;
      }
    } else {
      fillEl.style.height = '50%';
      textEl.textContent = '0.0';
    }
  }

  private renderReplayAnalysisCard(move: ReplayMove): void {
    const cardEl = this.container.querySelector<HTMLElement>('#replay-analysis-card');
    if (!cardEl) return;

    if (move.ply === 0) {
      cardEl.innerHTML = `
        <div class="analysis-empty">
          <span class="icon">♟</span>
          <p>Posição inicial do jogo. Avance com as setas para analisar cada lance da partida.</p>
        </div>
      `;
      return;
    }

    const playerLabel = move.color === 'w' ? 'Brancas' : 'Pretas';
    const analysis = move.analysis;

    if (!analysis) {
      cardEl.innerHTML = `
        <div class="analysis-engine-move">
          <div class="move-info-header">
            <span class="move-title">Lance ${move.moveNumber} • ${playerLabel}: <strong>${move.san}</strong></span>
            <span class="engine-tag">Resposta do Motor</span>
          </div>
          <p class="move-subtext">Lance jogado pelo adversário.</p>
        </div>
      `;
      return;
    }

    const hasRedThreat = analysis.shapes && analysis.shapes.some(s => s.brush === 'red');
    const categoryBadge = analysis.categoryLabel
      ? `<span class="category-badge category-${analysis.category}">${analysis.categoryLabel}</span>`
      : '';

    const refutationHtml = (analysis.refutationPv && analysis.refutationPv.length > 0 && analysis.quality !== 'excelente' && analysis.quality !== 'bom')
      ? `<div class="feedback-refutation">
           <span class="refutation-title">Linha de Refutação do Motor:</span>
           <div class="refutation-line">
             ${analysis.refutationPv.map((m, idx) => `<span class="refutation-step"><strong>${idx + 1}.</strong> ${m.san}</span>`).join(' ')}
           </div>
         </div>`
      : '';

    cardEl.innerHTML = `
      <div class="analysis-card-content" style="--badge-color: ${analysis.color}">
        <div class="move-info-header">
          <div class="badges-row">
            <span class="quality-badge" style="background-color: ${analysis.color}">${analysis.label}</span>
            ${categoryBadge}
          </div>
          <span class="move-title">Lance ${move.moveNumber}: <strong>${move.san}</strong></span>
        </div>

        <p class="analysis-explanation-text">${analysis.explanation}</p>

        <div class="feedback-best-move">
          <span class="label">Melhor jogada:</span>
          <span class="value">${analysis.bestMoveSan}</span>
        </div>

        ${hasRedThreat ? `
          <div class="feedback-legend" style="display: flex;">
            <span class="legend-item"><span class="legend-dot green"></span> Melhor lance (${analysis.bestMoveSan})</span>
            <span class="legend-item"><span class="legend-dot red"></span> Ameaça adversária</span>
          </div>
        ` : ''}

        ${refutationHtml}
      </div>
    `;
  }

  private renderMovesList(): void {
    const listEl = this.container.querySelector<HTMLElement>('#replay-moves-list');
    if (!listEl) return;

    // Agrupa lances em pares (brancas e pretas)
    let html = '';
    for (let i = 1; i < this.replayMoves.length; i += 2) {
      const whiteMove = this.replayMoves[i];
      const blackMove = this.replayMoves[i + 1];
      const moveNum = whiteMove.moveNumber;

      const whiteTag = whiteMove.analysis ? `<span class="dot-badge ${whiteMove.analysis.quality}"></span>` : '';
      const blackTag = blackMove && blackMove.analysis ? `<span class="dot-badge ${blackMove.analysis.quality}"></span>` : '';

      html += `
        <div class="replay-move-row">
          <span class="move-row-num">${moveNum}.</span>
          <button type="button" class="replay-move-item" id="move-ply-${whiteMove.ply}" data-ply="${whiteMove.ply}">
            ${whiteTag}
            <span>${whiteMove.san}</span>
          </button>
          ${blackMove ? `
            <button type="button" class="replay-move-item" id="move-ply-${blackMove.ply}" data-ply="${blackMove.ply}">
              ${blackTag}
              <span>${blackMove.san}</span>
            </button>
          ` : '<span class="move-item-empty"></span>'}
        </div>
      `;
    }

    listEl.innerHTML = html;

    listEl.querySelectorAll<HTMLButtonElement>('.replay-move-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const ply = Number(btn.dataset.ply);
        this.goToPly(ply);
      });
    });
  }

  destroy(): void {
    if (typeof window !== 'undefined' && this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    if (this.reviewBoard) {
      this.reviewBoard.destroy();
      this.reviewBoard = null;
    }
    this.container.innerHTML = '';
  }
}
