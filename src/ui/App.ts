import { HomeScreen } from './screens/HomeScreen.js';
import { AssessmentScreen } from './screens/AssessmentScreen.js';
import { GameScreen } from './screens/GameScreen.js';
import { ReviewScreen, type ReviewData } from './screens/ReviewScreen.js';
import { TrainingScreen } from './screens/TrainingScreen.js';
import { SettingsScreen } from './screens/SettingsScreen.js';
import { getSettings } from '../profile/index.js';

export type ScreenName = 'home' | 'assessment' | 'game' | 'review' | 'training' | 'settings';

export class App {
  private root: HTMLElement;
  private currentScreenInstance: { destroy: () => void } | null = null;
  private lastReviewData: ReviewData | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.applyGlobalSettings();
    this.navigate('home');
  }

  private applyGlobalSettings(): void {
    const settings = getSettings();
    document.documentElement.dataset.boardTheme = settings.boardTheme;
  }

  navigate(screen: ScreenName): void {
    if (this.currentScreenInstance) {
      this.currentScreenInstance.destroy();
      this.currentScreenInstance = null;
    }

    this.root.innerHTML = '';
    const container = document.createElement('div');
    container.className = `screen-container screen-${screen}`;
    this.root.appendChild(container);

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

      case 'review':
        if (this.lastReviewData) {
          this.currentScreenInstance = new ReviewScreen(container, this.lastReviewData, {
            onPlayAgain: () => this.navigate('game'),
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
        });
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
