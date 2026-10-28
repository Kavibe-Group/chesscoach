import { getProfile, getEloBand } from '../../profile/index.js';
import { getActiveTrainingPositions, getMasteredCount } from '../../training/index.js';

export interface HomeScreenEvents {
  onStartGame: () => void;
  onStartAssessment: () => void;
  onStartTraining: () => void;
  onOpenSettings: () => void;
}

export class HomeScreen {
  private container: HTMLElement;
  private events: HomeScreenEvents;

  constructor(container: HTMLElement, events: HomeScreenEvents) {
    this.container = container;
    this.events = events;
    this.render();
  }

  render(): void {
    const profile = getProfile();
    const activeErrors = getActiveTrainingPositions();
    const masteredCount = getMasteredCount();

    if (!profile || !profile.assessmentCompleted) {
      // Primeira vez — Apresentação + CTA de avaliação
      this.container.innerHTML = `
        <div class="home-screen welcome">
          <header class="app-header">
            <div class="logo-badge">♞</div>
            <h1>Xadrez Coach</h1>
            <p class="tagline">Seu treinador pessoal de xadrez que joga e analisa cada lance com você</p>
          </header>

          <div class="welcome-card card">
            <div class="welcome-icon">🎯</div>
            <h2>Avalie o seu nível para começar</h2>
            <p>
              O app ajusta a força do motor para a sua <strong>zona de aprendizado</strong> (sempre um desafio leve)
              e analisa todos os seus lances em tempo real.
            </p>
            <div class="assessment-preview-list">
              <div class="preview-item">
                <span class="preview-num">1</span>
                <span><strong>12 posições táticas:</strong> encontre o melhor lance em mates e golpes táticos.</span>
              </div>
              <div class="preview-item">
                <span class="preview-num">2</span>
                <span><strong>Partida de calibração:</strong> teste prático contra o motor.</span>
              </div>
              <div class="preview-item">
                <span class="preview-num">3</span>
                <span><strong>Treino sob medida:</strong> feedback imediato e treino a partir dos seus próprios erros.</span>
              </div>
            </div>

            <button type="button" class="btn btn-primary btn-lg" id="btn-start-assessment">
              🎯 Avaliar meu nível agora
            </button>
          </div>

          <footer class="app-footer">
            <span>100% local · Sem contas · Sem anúncios · Custo $0</span>
          </footer>
        </div>
      `;

      this.container.querySelector('#btn-start-assessment')?.addEventListener('click', () => {
        this.events.onStartAssessment();
      });
      return;
    }

    // Usuário já avaliado — Dashboard do perfil + Atalhos
    const eloBand = getEloBand(profile.estimatedElo);
    const avgAccuracy = profile.gamesPlayed > 0 ? Math.round(profile.totalAccuracy) : 0;
    const historyPoints = profile.eloHistory.slice(-5);

    this.container.innerHTML = `
      <div class="home-screen dashboard">
        <header class="app-header">
          <div class="header-left">
            <span class="logo-badge">♞</span>
            <div>
              <h1>Xadrez Coach</h1>
              <p class="tagline">Treinador pessoal adaptativo</p>
            </div>
          </div>
          <button type="button" class="btn-icon" id="btn-settings-header" title="Configurações">
            ⚙️
          </button>
        </header>

        <div class="dashboard-grid">
          <!-- Card de Perfil & Elo -->
          <div class="card profile-card">
            <span class="section-badge">Seu Nível Estimado</span>
            <div class="elo-display">
              <span class="elo-number">${profile.estimatedElo}</span>
              <span class="elo-band">${eloBand}</span>
            </div>

            <div class="profile-stats-row">
              <div class="stat-pill">
                <span class="stat-label">Precisão</span>
                <span class="stat-value">${avgAccuracy}%</span>
              </div>
              <div class="stat-pill">
                <span class="stat-label">Partidas</span>
                <span class="stat-value">${profile.gamesPlayed}</span>
              </div>
              <div class="stat-pill">
                <span class="stat-label">Sequência</span>
                <span class="stat-value">🔥 ${profile.streakDays || 1}d</span>
              </div>
              <div class="stat-pill">
                <span class="stat-label">Dominados</span>
                <span class="stat-value">🏆 ${masteredCount}</span>
              </div>
            </div>

            <!-- Mini evolução de Elo em gráfico SVG -->
            ${historyPoints.length > 1 ? renderEloChart(profile.eloHistory) : ''}
          </div>

          <!-- Ações Principais -->
          <div class="actions-card card">
            <button type="button" class="btn btn-primary btn-xl" id="btn-play-game">
              ⚔️ Jogar contra o Motor
              <small>Motor calibrado para Elo ~${profile.estimatedElo + 50}</small>
            </button>

            <button type="button" class="btn btn-secondary btn-lg" id="btn-training">
              🧩 Puzzles & Treino de Erros
              <span class="badge-count">${activeErrors.length > 0 ? `${activeErrors.length} erros` : '5 diários'}</span>
            </button>

            <div class="secondary-actions">
              <button type="button" class="btn btn-ghost" id="btn-re-assessment">
                🔄 Refazer avaliação de nível
              </button>
              <button type="button" class="btn btn-ghost" id="btn-settings">
                ⚙️ Configurações
              </button>
            </div>
          </div>
        </div>

        <!-- Dica de instalação PWA no celular / iPhone -->
        <div class="pwa-install-banner" id="pwa-install-tip">
          <div class="install-tip-icon">📲</div>
          <div class="install-tip-text">
            <strong>Instale no seu iPhone:</strong>
            <span>Toque em <strong>Compartilhar</strong> (ícone com seta) no Safari e escolha <strong>Adicionar à Tela de Início</strong> para jogar sem barras e 100% offline.</span>
          </div>
          <button type="button" class="btn-dismiss-install" id="btn-dismiss-pwa" title="Fechar">✕</button>
        </div>

        <footer class="app-footer">
          <span>Xadrez Coach · Motor Stockfish 19 WASM · Análise em tempo real</span>
        </footer>
      </div>
    `;

    // Se já estiver rodando como PWA instalado (standalone), oculta o banner
    const isStandalone = typeof window !== 'undefined' && (
      Boolean((window.navigator as any)?.standalone) ||
      Boolean(window.matchMedia?.('(display-mode: standalone)').matches)
    );
    const bannerEl = this.container.querySelector<HTMLElement>('#pwa-install-tip');
    if (bannerEl && isStandalone) {
      bannerEl.style.display = 'none';
    }
    this.container.querySelector('#btn-dismiss-pwa')?.addEventListener('click', () => {
      if (bannerEl) bannerEl.style.display = 'none';
    });

    // Listeners
    this.container.querySelector('#btn-play-game')?.addEventListener('click', () => {
      this.events.onStartGame();
    });
    this.container.querySelector('#btn-training')?.addEventListener('click', () => {
      this.events.onStartTraining();
    });
    this.container.querySelector('#btn-re-assessment')?.addEventListener('click', () => {
      this.events.onStartAssessment();
    });
    this.container.querySelector('#btn-settings')?.addEventListener('click', () => {
      this.events.onOpenSettings();
    });
    this.container.querySelector('#btn-settings-header')?.addEventListener('click', () => {
      this.events.onOpenSettings();
    });
  }

  destroy(): void {
    this.container.innerHTML = '';
  }
}

function renderEloChart(history: { date: string; elo: number }[]): string {
  if (history.length < 2) return '';
  const points = history.slice(-8);
  const elos = points.map(p => p.elo);
  const minElo = Math.min(...elos);
  const maxElo = Math.max(...elos);
  const range = maxElo - minElo || 40;

  const width = 300;
  const height = 75;
  const padX = 24;
  const padTop = 18;
  const padBottom = 16;
  const usableW = width - padX * 2;
  const usableH = height - padTop - padBottom;

  const coords = points.map((p, i) => {
    const x = padX + (i / (points.length - 1)) * usableW;
    const y = padTop + usableH - ((p.elo - minElo) / range) * usableH;
    return { x: Math.round(x), y: Math.round(y), elo: p.elo };
  });

  const pathD = coords.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '');
  const areaD = `${pathD} L ${coords[coords.length - 1].x} ${height - 4} L ${coords[0].x} ${height - 4} Z`;

  const delta = points[points.length - 1].elo - points[0].elo;
  const deltaSign = delta > 0 ? `+${delta}` : `${delta}`;

  const dots = coords.map((pt, i) => {
    const isLast = i === coords.length - 1;
    return `
      <g class="chart-point">
        <circle cx="${pt.x}" cy="${pt.y}" r="${isLast ? 4 : 2.5}" fill="${isLast ? '#4caf50' : '#8bc34a'}" stroke="#1e1e1e" stroke-width="1.5" />
        <text x="${pt.x}" y="${pt.y - 6}" font-size="9" text-anchor="middle" fill="#ccc" font-weight="${isLast ? 'bold' : 'normal'}">${pt.elo}</text>
      </g>
    `;
  }).join('');

  return `
    <div class="elo-chart-container">
      <div class="chart-header">
        <span class="stat-label">📈 Evolução de Elo</span>
        <span class="elo-delta-badge ${delta >= 0 ? 'positive' : 'negative'}">
          ${deltaSign} Elo
        </span>
      </div>
      <svg class="elo-svg-chart" viewBox="0 0 ${width} ${height}">
        <defs>
          <linearGradient id="eloGradHome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#4caf50" stop-opacity="0.3" />
            <stop offset="100%" stop-color="#4caf50" stop-opacity="0.0" />
          </linearGradient>
        </defs>
        <path d="${areaD}" fill="url(#eloGradHome)" />
        <path d="${pathD}" fill="none" stroke="#4caf50" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        ${dots}
      </svg>
    </div>
  `;
}
