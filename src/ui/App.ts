import { ProgressScreen } from './screens/ProgressScreen.js';
import { reconcileCompletion, getCompletedGames } from '../session/GameSession.js';
import type { TacticalCategory } from '../analysis/MoveAnalyzer.js';
import { HomeScreen } from './screens/HomeScreen.js';
import { AssessmentScreen } from './screens/AssessmentScreen.js';
import { GameScreen } from './screens/GameScreen.js';
import { ReviewScreen, type ReviewData } from './screens/ReviewScreen.js';
import { TrainingScreen } from './screens/TrainingScreen.js';
import { SettingsScreen } from './screens/SettingsScreen.js';
import { getSettings } from '../profile/index.js';

export type ScreenName = 'home' | 'assessment' | 'game' | 'review' | 'training' | 'settings' | 'progress';

export class App {
  private root: HTMLElement;
  private currentScreenInstance: { destroy: () => void } | null = null;
  private lastReviewData: ReviewData | null = null;
  private currentScreen: ScreenName = 'home';
  private trainingCategory?: TacticalCategory;

  constructor(root: HTMLElement) {
    this.root = root;
    reconcileCompletion();
    this.applyGlobalSettings();

    let initialScreen: ScreenName = 'home';
    if (typeof window !== 'undefined' && window.location?.hash) {
      const hashScreen = window.location.hash.replace('#', '') as ScreenName;
      if (['home', 'assessment', 'game', 'review', 'training', 'settings', 'progress'].includes(hashScreen)) {
        initialScreen = hashScreen;
      }
    }

    this.navigate(initialScreen, false);
    this.setupHistoryRouting();
  }

  private applyGlobalSettings(): void {
    const settings = getSettings();
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.boardTheme = settings.boardTheme;
      document.documentElement.dataset.theme = settings.appTheme ?? 'system';
    }
  }

  private setupHistoryRouting(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', (e: PopStateEvent) => {
        const targetScreen = (e.state?.screen as ScreenName) || 'home';
        this.navigate(targetScreen, false);
      });
    }
  }

  navigate(screen: ScreenName, updateHistory = true): void {
    if (this.currentScreenInstance) {
      this.currentScreenInstance.destroy();
      this.currentScreenInstance = null;
    }

    this.currentScreen = screen;
    if (typeof window !== 'undefined') window.scrollTo?.(0, 0);

    if (updateHistory && typeof window !== 'undefined' && typeof window.history?.pushState === 'function') {
      const url = `${window.location.pathname}#${screen}`;
      window.history.pushState({ screen }, '', url);
    }

    this.root.innerHTML = '';
    const container = document.createElement('div');
    container.className = `screen-container screen-${screen}`;
    this.root.innerHTML = `<header class="shell-header"><a href="#home" class="brand">♞ <span>Xadrez Coach</span></a><button type="button" class="btn btn-ghost" id="shell-settings" aria-label="Configurações">Configurações</button></header>`;
    this.root.appendChild(container);
    const gameScreen = screen === 'game';
    this.root.classList.toggle('in-game', gameScreen);
    if (!gameScreen) {
      const nav = document.createElement('nav'); nav.className = 'main-nav'; nav.setAttribute('aria-label','Navegação principal');
      nav.innerHTML = [['home','Jogar'],['training','Treinar'],['progress','Progresso']].map(([id,label])=>`<button type="button" data-nav="${id}" ${id===screen ? 'aria-current="page"' : ''}>${label}</button>`).join('');
      nav.querySelectorAll<HTMLButtonElement>('[data-nav]').forEach(b=>b.addEventListener('click',()=>this.navigate(b.dataset.nav as ScreenName)));
      this.root.appendChild(nav);
    }
    this.root.querySelector('.brand')?.addEventListener('click',e=>{e.preventDefault();this.navigate('home');});
    this.root.querySelector('#shell-settings')?.addEventListener('click',()=>this.navigate('settings'));

    switch (screen) {
      case 'home':
        this.currentScreenInstance = new HomeScreen(container, {
          onStartGame: () => this.navigate('game'),
          onStartAssessment: () => this.navigate('assessment'),
          onStartTraining: () => this.navigate('training'),
          onOpenSettings: () => this.navigate('settings'),
        });
        break;

      case 'assessment':
        this.currentScreenInstance = new AssessmentScreen(container, {
          onCompleted: () => this.navigate('game'),
          onCancel: () => this.navigate('home'),
        });
        break;

      case 'game':
        this.currentScreenInstance = new GameScreen(container, {
          onGameOver: stats => {
            this.lastReviewData = stats;
            this.navigate('review');
          },
          onExit: () => this.navigate('home'),
        });
        break;

      case 'progress':
        this.currentScreenInstance = new ProgressScreen(container, g => {this.lastReviewData=g;this.navigate('review');}, category => {this.trainingCategory=category;this.navigate('training');});
        break;

      case 'review':
        this.lastReviewData ??= getCompletedGames().at(-1) ?? null;
        if (this.lastReviewData) {
          this.currentScreenInstance = new ReviewScreen(container, this.lastReviewData, {
            onPlayAgain: () => this.navigate('home'),
            onGoTraining: () => this.navigate('training'),
            onGoHome: () => this.navigate('home'),
          });
        } else {
          this.navigate('home');
        }
        break;

      case 'training':
        this.currentScreenInstance = new TrainingScreen(container, {
          onBack: () => this.navigate('home'),
        }, this.trainingCategory);
        this.trainingCategory = undefined;
        break;

      case 'settings':
        this.currentScreenInstance = new SettingsScreen(container, {
          onBack: () => {
            this.applyGlobalSettings();
            this.navigate('home');
          },
          onResetAssessment: () => this.navigate('assessment'),
        });
        break;
    }
  }
}
