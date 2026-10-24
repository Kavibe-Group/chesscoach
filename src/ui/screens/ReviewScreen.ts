import { updateEloAfterGame, getProfile, getEloBand, saveGameStats } from '../../profile/index.js';
import type { GameStats } from '../../profile/index.js';

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
}

export class ReviewScreen {
  private container: HTMLElement;
  private events: ReviewScreenEvents;
  private data: ReviewData;

  constructor(container: HTMLElement, data: ReviewData, events: ReviewScreenEvents) {
    this.container = container;
    this.events = events;
    this.data = data;
    this.processStatsAndUpdateProfile();
    this.render();
  }

  private processStatsAndUpdateProfile(): void {
    const profile = getProfile();
    if (!profile) return;

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
    updateEloAfterGame(profile, gameStats);
  }

  private getMiniLesson(): { title: string; text: string; icon: string } {
    if (this.data.blunders > 0) {
      return {
        icon: '🛡️',
        title: 'Minilição: Verificação de Segurança em 3 Passos',
        text: 'A maioria dos erros graves acontece quando deixamos peças desprotegidas ou não percebemos a resposta imediata do adversário. Antes de soltar a peça no tabuleiro, pergunte-se: 1. A casa de destino é segura? 2. Alguma peça minha ficou desprotegida? 3. O adversário ganha algum xeque perigoso?',
      };
    }

    if (this.data.mistakes > 0) {
      return {
        icon: '⚖️',
        title: 'Minilição: Cálculo de Trocas de Peças',
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
    const profile = getProfile();
    const eloBand = profile ? getEloBand(profile.estimatedElo) : '';
    const lesson = this.getMiniLesson();

    // 3 maiores erros ordenados por perda de centipeões
    const top3Mistakes = [...this.data.mistakesHistory]
      .sort((a, b) => (b.cpLoss === 9999 ? 10000 : b.cpLoss) - (a.cpLoss === 9999 ? 10000 : a.cpLoss))
      .slice(0, 3);

    const resultLabel = this.data.result === '1-0'
      ? '🎉 Vitória!'
      : this.data.result === '0-1'
      ? 'Derrota'
      : 'Empate';

    this.container.innerHTML = `
      <div class="review-screen">
        <header class="review-header">
          <span class="review-badge">Revisão Pós-Partida</span>
          <h1>${resultLabel}</h1>
          <p class="review-subtitle">Veja como foi o seu desempenho e o que treinar agora</p>
        </header>

        <div class="review-content">
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
                <span class="overview-value">${profile?.estimatedElo ?? '—'}</span>
                <span class="overview-label">Novo Elo (${eloBand})</span>
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
            <h2>🎯 Os 3 Maiores Erros da Partida</h2>
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

          <!-- Ações -->
          <div class="review-actions">
            <button type="button" class="btn btn-primary btn-xl" id="btn-review-play-again">
              ⚔️ Jogar Novamente
            </button>
            <button type="button" class="btn btn-secondary btn-lg" id="btn-review-go-training">
              🧩 Treinar meus erros
            </button>
            <button type="button" class="btn btn-ghost" id="btn-review-go-home">
              ← Menu Principal
            </button>
          </div>
        </div>
      </div>
    `;

    // Listeners
    this.container.querySelector('#btn-review-play-again')?.addEventListener('click', () => {
      this.events.onPlayAgain();
    });
    this.container.querySelector('#btn-review-go-training')?.addEventListener('click', () => {
      this.events.onGoTraining();
    });
    this.container.querySelector('#btn-review-go-home')?.addEventListener('click', () => {
      this.events.onGoHome();
    });
  }

  destroy(): void {
    this.container.innerHTML = '';
  }
}
