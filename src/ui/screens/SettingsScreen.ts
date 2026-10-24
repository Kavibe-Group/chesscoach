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
            <p class="setting-desc">Sem limite de tempo para estudar com calma ou partida com relógio.</p>
            <div class="segmented-control">
              <button type="button" class="segment-btn ${settings.clockMinutes === 0 ? 'active' : ''}" data-clock="0">
                ⌛ Modo Estudo (Sem Relógio)
              </button>
              <button type="button" class="segment-btn ${settings.clockMinutes === 10 ? 'active' : ''}" data-clock="10">
                ⏱️ 10 Minutos (Rápida)
              </button>
            </div>
          </div>

          <!-- Força do Motor -->
          <div class="setting-group">
            <label class="setting-title">Força do Motor (Stockfish)</label>
            <p class="setting-desc">Ajuste se deseja desafio adaptativo automático ou controle manual.</p>
            <div class="segmented-control">
              <button type="button" class="segment-btn ${settings.engineStrengthMode === 'auto' ? 'active' : ''}" data-mode="auto">
                🎯 Automático (Seu Elo + 50)
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
            <div class="segmented-control">
              <button type="button" class="segment-btn ${settings.boardTheme === 'brown' ? 'active' : ''}" data-theme="brown">
                🟫 Marrom Clássico
              </button>
              <button type="button" class="segment-btn ${settings.boardTheme === 'green' ? 'active' : ''}" data-theme="green">
                🟩 Verde Torneio
              </button>
              <button type="button" class="segment-btn ${settings.boardTheme === 'blue' ? 'active' : ''}" data-theme="blue">
                🟦 Azul Oceano
              </button>
            </div>
          </div>

          <!-- Zona de Perigo / Reset -->
          <div class="setting-group danger-zone">
            <label class="setting-title">Gerenciamento de Dados</label>
            <div class="danger-actions">
              <button type="button" class="btn btn-secondary" id="btn-redo-assessment">
                🔄 Refazer Avaliação de Nível
              </button>
              <button type="button" class="btn btn-danger" id="btn-clear-all-data">
                🗑️ Limpar Todos os Dados e Histórico
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
        const theme = (btn as HTMLElement).dataset.theme as 'brown' | 'green' | 'blue';
        saveSettings({ boardTheme: theme });
        document.documentElement.dataset.boardTheme = theme;
      });
    });

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
