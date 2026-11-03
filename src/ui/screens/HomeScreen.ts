import { confirmAction } from '../confirmAction.js';
import { getProfile, createProfile, saveProfile, getSettings, saveSettings } from '../../profile/index.js';
import { getActiveGame, clearActiveGame } from '../../session/GameSession.js';
import { getDueTrainingPositions, getMasteredCount } from '../../training/index.js';
export interface HomeScreenEvents {
  onStartGame: () => void; onStartAssessment: () => void; onStartTraining: () => void; onOpenSettings: () => void;
}
export class HomeScreen {
  private container: HTMLElement; private events: HomeScreenEvents;
  constructor(container: HTMLElement, events: HomeScreenEvents) { this.container=container; this.events=events; this.render(); }
  render(): void {
    const profile = getProfile(); const active = getActiveGame(); const settings = getSettings();
    this.container.innerHTML = `<main class="home-screen dashboard">
      <div class="eyebrow">SEU ESPAÇO DE XADREZ</div><h1>Jogue. Entenda. Evolua.</h1>
      <p class="page-intro">Escolha como quer jogar hoje. Seu treinador acompanha o seu ritmo.</p>
      ${!profile ? `<section class="card onboarding"><h2>Por onde começamos?</h2><p>Escolha um nível aproximado. A estimativa é provisória e pode ser calibrada depois.</p><div class="level-choices">${[[800,'Iniciante'],[1200,'Intermediário'],[1600,'Avançado']].map(([elo,name])=>`<button type="button" class="btn btn-secondary" data-level="${elo}">${name}<small>~${elo}</small></button>`).join('')}</div></section>` : ''}
      ${active ? `<section class="card resume-card"><div><span class="eyebrow">EM ANDAMENTO</span><h2>Sua partida está aqui.</h2><p>${active.mode === 'study' ? 'Estudo' : 'Teste'} · ${active.settings.playerColor === 'white' ? 'Brancas' : 'Pretas'} · relógio pausado</p></div><button type="button" class="btn btn-primary" id="resume-game">Continuar partida</button></section>` : ''}
      <div class="dashboard-grid"><section class="card play-card"><span class="eyebrow">JOGAR</span><h2>Uma posição. Muitas ideias.</h2>
        <label class="mode-choice"><input type="radio" name="mode" value="study" ${settings.gameMode !== 'test' ? 'checked' : ''}><span><strong>Estudo</strong><small>Dicas, explicações e novas tentativas. Sem ajuste de Elo.</small></span></label>
        <label class="mode-choice"><input type="radio" name="mode" value="test" ${settings.gameMode === 'test' ? 'checked' : ''}><span><strong>Teste</strong><small>Jogue sem ajuda e revise no final. Atualiza seu Elo estimado.</small></span></label>
        <button type="button" class="btn btn-primary btn-lg" id="btn-play-game">${active ? 'Começar outra partida' : 'Começar partida'}</button>
      </section><section class="card"><span class="eyebrow">APRENDIZAGEM</span><h2>Um pouco melhor a cada dia.</h2><div class="metric-grid"><div><strong>${getDueTrainingPositions().length}</strong><span>revisões disponíveis</span></div><div><strong>${getMasteredCount()}</strong><span>posições dominadas</span></div></div><button type="button" class="btn btn-secondary" id="btn-training">Escolher treino</button></section></div>
      <section class="card assessment-entry"><div><h2>${profile ? `Nível estimado: ${profile.estimatedElo}` : 'Quer medir seu nível?'}</h2><p>${profile?.provisional ? 'Estimativa provisória. ' : ''}A avaliação é opcional: tática e uma partida de calibração.</p></div><button type="button" class="btn btn-ghost" id="btn-re-assessment">Avaliar meu nível</button></section>
      <p class="local-note">No seu aparelho. Sem conta. Disponível offline após carregar o app.</p>
    </main>`;
    const ensureProfile = () => { if (!getProfile()) { const p = createProfile(1200); p.provisional = true; saveProfile(p); } };
    this.container.querySelectorAll<HTMLButtonElement>('[data-level]').forEach(b=> b.addEventListener('click',()=>{ const p=createProfile(Number(b.dataset.level));p.provisional=true;saveProfile(p);this.render(); }));
    this.container.querySelector('#resume-game')?.addEventListener('click',()=>{ensureProfile();this.events.onStartGame();});
    this.container.querySelector('#btn-play-game')?.addEventListener('click',async()=>{
      if (active && !await confirmAction('Substituir a partida em andamento?')) return;
      clearActiveGame(); ensureProfile();
      const mode = this.container.querySelector<HTMLInputElement>('input[name="mode"]:checked')?.value === 'test' ? 'test' : 'study';
      saveSettings({gameMode:mode}); this.events.onStartGame();
    });
    this.container.querySelector('#btn-training')?.addEventListener('click',()=>{ensureProfile();this.events.onStartTraining();});
    this.container.querySelector('#btn-re-assessment')?.addEventListener('click',()=>this.events.onStartAssessment());
  }
  destroy(): void { this.container.innerHTML = ''; }
}
