import { getSettings, saveSettings } from '../../profile/index.js';
import { getStorage } from '../../storage.js';

export interface SettingsScreenEvents {
  onBack: () => void;
  onResetAssessment: () => void;
}

export class SettingsScreen {
  private container: HTMLElement;
  private events: SettingsScreenEvents;

  constructor(container: HTMLElement, events: SettingsScreenEvents) {
    this.container = container;
    this.events = events;
    this.render();
  }

  render(): void {
    const settings = getSettings();

    this.container.innerHTML = `
      <div class="settings-screen">
        <header class="screen-header">
          <button type="button" class="btn btn-ghost" id="btn-back-settings">← Voltar</button>
          <h1>Configurações</h1>
        </header>

        <div class="settings-card card">
          <div class="setting-group"><label class="setting-title" for="app-theme">Aparência do app</label><select id="app-theme">${[['system','Seguir o aparelho'],['light','Claro'],['dark','Escuro']].map(([value,label])=>`<option value="${value}" ${settings.appTheme === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div>
          <!-- Cor das peças -->
          <div class="setting-group">
            <label class="setting-title">Cor das Peças para Jogar</label>
            <p class="setting-desc">Escolha de qual lado você jogará por padrão nas partidas.</p>
            <div class="segmented-control">
              <button type="button" class="segment-btn ${settings.playerColor === 'white' ? 'active' : ''}" data-color="white">
                ♔ Brancas (Você joga primeiro)
              </button>
              <button type="button" class="segment-btn ${settings.playerColor === 'black' ? 'active' : ''}" data-color="black">
                ♚ Pretas (Motor joga primeiro)
              </button>
            </div>
          </div>

          <!-- Relógio -->
          <div class="setting-group">
            <label class="setting-title">Modo de Tempo</label>
            <p class="setting-desc">Escolha partidas de estudo livre ou com controle de tempo.</p>
            <div class="segmented-control clock-grid">
              <button type="button" class="segment-btn ${settings.clockMinutes === 0 ? 'active' : ''}" data-clock="0">
                Sem Relógio (Estudo)
              </button>
              <button type="button" class="segment-btn ${settings.clockMinutes === 3 ? 'active' : ''}" data-clock="3">
                3 min (Blitz)
              </button>
              <button type="button" class="segment-btn ${settings.clockMinutes === 5 ? 'active' : ''}" data-clock="5">
                5 min (Blitz)
              </button>
              <button type="button" class="segment-btn ${settings.clockMinutes === 10 ? 'active' : ''}" data-clock="10">
                10 min (Rápida)
              </button>
              <button type="button" class="segment-btn ${settings.clockMinutes === 15 ? 'active' : ''}" data-clock="15">
                15 min (Rápida)
              </button>
            </div>
          </div>

          <!-- Auxílios de Tabuleiro & Som -->
          <div class="setting-group">
            <label class="setting-title">Auxílios de Tabuleiro & Som</label>
            <p class="setting-desc">Personalize os recursos visuais e auditivos durante o treino.</p>
            <div class="toggle-list">
              <label class="toggle-item">
                <div class="toggle-info">
                  <span class="toggle-label">Efeitos Sonoros</span>
                  <span class="toggle-subtext">Sons sintetizados de peças, capturas, xeques e alertas</span>
                </div>
                <input type="checkbox" id="toggle-sound" class="switch-input" ${settings.soundEnabled ? 'checked' : ''} />
              </label>

              <label class="toggle-item">
                <div class="toggle-info">
                  <span class="toggle-label">Barra de Avaliação ao Vivo</span>
                  <span class="toggle-subtext">Mostra a barra dinâmica com a vantagem em centipeões</span>
                </div>
                <input type="checkbox" id="toggle-eval-bar" class="switch-input" ${settings.showEvalBar ? 'checked' : ''} />
              </label>

              <label class="toggle-item">
                <div class="toggle-info">
                  <span class="toggle-label">Mostrar Lances Legais</span>
                  <span class="toggle-subtext">Pontos nas casas possíveis ao clicar em uma peça</span>
                </div>
                <input type="checkbox" id="toggle-legal-moves" class="switch-input" ${settings.showLegalMoves ? 'checked' : ''} />
              </label>

              <label class="toggle-item">
                <div class="toggle-info">
                  <span class="toggle-label">Destacar Último Lance e Xeque</span>
                  <span class="toggle-subtext">Realça a casa de origem/destino e rei ameaçado</span>
                </div>
                <input type="checkbox" id="toggle-highlights" class="switch-input" ${settings.showHighlights ? 'checked' : ''} />
              </label>
            </div>
          </div>

          <!-- Força do Motor -->
          <div class="setting-group">
            <label class="setting-title">Força do Motor (Stockfish)</label>
            <p class="setting-desc">Ajuste se deseja desafio adaptativo automático ou controle manual.</p>
            <div class="segmented-control">
              <button type="button" class="segment-btn ${settings.engineStrengthMode === 'auto' ? 'active' : ''}" data-mode="auto">
                Automático (Seu Elo + 50)
              </button>
              <button type="button" class="segment-btn ${settings.engineStrengthMode === 'manual' ? 'active' : ''}" data-mode="manual">
                🎛️ Manual
              </button>
            </div>

            <div id="manual-elo-container" style="display: ${settings.engineStrengthMode === 'manual' ? 'block' : 'none'}; margin-top: 1rem;">
              <div class="slider-row">
                <span>Elo Selecionado: <strong id="elo-val-display">${settings.manualElo}</strong></span>
                <input type="range" id="input-manual-elo" min="800" max="2200" step="50" value="${settings.manualElo}" />
              </div>
            </div>
          </div>

          <!-- Tema do Tabuleiro -->
          <div class="setting-group">
            <label class="setting-title">Tema do Tabuleiro</label>
            <div class="segmented-control themes-grid">
              <button type="button" class="segment-btn ${settings.boardTheme === 'brown' ? 'active' : ''}" data-theme="brown">
                Marrom Clássico
              </button>
              <button type="button" class="segment-btn ${settings.boardTheme === 'green' ? 'active' : ''}" data-theme="green">
                Verde Torneio
              </button>
              <button type="button" class="segment-btn ${settings.boardTheme === 'blue' ? 'active' : ''}" data-theme="blue">
                Azul Oceano
              </button>
              <button type="button" class="segment-btn ${settings.boardTheme === 'wood' ? 'active' : ''}" data-theme="wood">
                Madeira Nobre
              </button>
              <button type="button" class="segment-btn ${settings.boardTheme === 'dark' ? 'active' : ''}" data-theme="dark">
                Minimalista Escuro
              </button>
              <button type="button" class="segment-btn ${settings.boardTheme === 'contrast' ? 'active' : ''}" data-theme="contrast">
                Alto Contraste
              </button>
            </div>
          </div>

          <!-- Zona de Perigo / Reset -->
          <div class="setting-group danger-zone">
            <label class="setting-title">Gerenciamento de Dados</label>
            <div class="danger-actions">
              <button type="button" class="btn btn-secondary" id="btn-redo-assessment">
                Refazer Avaliação de Nível
              </button>
              <button type="button" class="btn btn-danger" id="btn-clear-all-data">
                Limpar Todos os Dados e Histórico
              </button>
            </div>
          </div>

          <div class="settings-save-row">
            <button type="button" class="btn btn-primary btn-lg" id="btn-save-settings">
              ✓ Salvar e Voltar
            </button>
          </div>
        </div>
      </div>
    `;

    // Listeners para controles
    this.container.querySelector('#app-theme')?.addEventListener('change', event => {
      const appTheme = (event.target as HTMLSelectElement).value as 'system'|'light'|'dark';
      saveSettings({appTheme}); document.documentElement.dataset.theme = appTheme;
    });
    this.container.querySelectorAll('[data-color]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('[data-color]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        saveSettings({ playerColor: (btn as HTMLElement).dataset.color as 'white' | 'black' });
      });
    });

    this.container.querySelectorAll('[data-clock]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('[data-clock]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const minutes = parseInt((btn as HTMLElement).dataset.clock || '0', 10);
        saveSettings({ clockMinutes: minutes });
      });
    });

    this.container.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = (btn as HTMLElement).dataset.mode as 'auto' | 'manual';
        saveSettings({ engineStrengthMode: mode });

        const manualContainer = this.container.querySelector<HTMLElement>('#manual-elo-container');
        if (manualContainer) {
          manualContainer.style.display = mode === 'manual' ? 'block' : 'none';
        }
      });
    });

    const eloSlider = this.container.querySelector<HTMLInputElement>('#input-manual-elo');
    const eloDisplay = this.container.querySelector<HTMLElement>('#elo-val-display');
    if (eloSlider && eloDisplay) {
      eloSlider.addEventListener('input', () => {
        eloDisplay.textContent = eloSlider.value;
        saveSettings({ manualElo: parseInt(eloSlider.value, 10) });
      });
    }

    this.container.querySelectorAll('[data-theme]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('[data-theme]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const theme = (btn as HTMLElement).dataset.theme as any;
        saveSettings({ boardTheme: theme });
        if (typeof document !== 'undefined') {
          document.documentElement.dataset.boardTheme = theme;
        }
      });
    });

    const toggleSound = this.container.querySelector<HTMLInputElement>('#toggle-sound');
    if (toggleSound) {
      toggleSound.addEventListener('change', () => {
        saveSettings({ soundEnabled: toggleSound.checked });
      });
    }

    const toggleEvalBar = this.container.querySelector<HTMLInputElement>('#toggle-eval-bar');
    if (toggleEvalBar) {
      toggleEvalBar.addEventListener('change', () => {
        saveSettings({ showEvalBar: toggleEvalBar.checked });
      });
    }

    const toggleLegalMoves = this.container.querySelector<HTMLInputElement>('#toggle-legal-moves');
    if (toggleLegalMoves) {
      toggleLegalMoves.addEventListener('change', () => {
        saveSettings({ showLegalMoves: toggleLegalMoves.checked });
      });
    }

    const toggleHighlights = this.container.querySelector<HTMLInputElement>('#toggle-highlights');
    if (toggleHighlights) {
      toggleHighlights.addEventListener('change', () => {
        saveSettings({ showHighlights: toggleHighlights.checked });
      });
    }

    this.container.querySelector('#btn-redo-assessment')?.addEventListener('click', () => {
      this.events.onResetAssessment();
    });

    this.container.querySelector('#btn-clear-all-data')?.addEventListener('click', () => {
      if (confirm('Tem certeza que deseja apagar todo o seu histórico, perfil e treinos salvos? Esta ação é irreversível.')) {
        getStorage().clear();
        alert('Dados apagados com sucesso.');
        this.events.onResetAssessment();
      }
    });

    this.container.querySelector('#btn-back-settings')?.addEventListener('click', () => {
      this.events.onBack();
    });

    this.container.querySelector('#btn-save-settings')?.addEventListener('click', () => {
      this.events.onBack();
    });
  }

  destroy(): void {
    this.container.innerHTML = '';
  }
}
