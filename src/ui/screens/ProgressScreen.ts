import { getProfile, getGameStatsHistory } from '../../profile/index.js';
import { getCompletedGames, type CompletedGame } from '../../session/GameSession.js';
import { CATEGORY_LABELS, type TacticalCategory } from '../../analysis/MoveAnalyzer.js';
import { escapeHtml } from '../../analysis/Coach.js';
export class ProgressScreen {
  private container: HTMLElement; private onReview:(g:CompletedGame)=>void; private onTrain:(category:TacticalCategory)=>void;
  constructor(container:HTMLElement, onReview:(g:CompletedGame)=>void, onTrain:(category:TacticalCategory)=>void) { this.container=container; this.onReview=onReview; this.onTrain=onTrain;
    const profile=getProfile(); const games=getCompletedGames().slice().reverse();
    const legacy=getGameStatsHistory().filter(s=>!s.id);
    const cats=Object.entries(profile?.errorCategories ?? {}).filter(([c])=>c in CATEGORY_LABELS).sort((a,b)=>b[1]-a[1]).slice(0,4);
    container.innerHTML=`<main class="progress-screen"><div class="eyebrow">PROGRESSO</div><h1>Aprender deixa pistas.</h1><p class="page-intro">Seu nível de teste e seu trabalho de estudo, vistos separadamente.</p>
    <section class="card"><div class="metric-grid"><div><strong>${profile?.estimatedElo ?? '—'}</strong><span>Elo estimado ${profile?.provisional ? '· provisório' : ''}</span></div><div><strong>${profile?.gamesPlayed ?? 0}</strong><span>partidas analisadas</span></div><div><strong>${profile?.streakDays ?? 0}</strong><span>dias de atividade</span></div></div>
    <p>O Elo é uma estimativa local, atualizada apenas em avaliações e partidas de Teste.</p>
    <div class="elo-history">${(profile?.eloHistory ?? []).slice(-10).map(h=>`<span>${new Date(h.date).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}<strong>${h.elo}</strong></span>`).join('')}</div></section>
    <section class="card"><h2>Padrões para trabalhar</h2>${cats.length ? cats.map(([c,count])=>`<button type="button" class="weakness-link" data-category="${c}"><span>${CATEGORY_LABELS[c as TacticalCategory]}</span><span>${count} ocorrências → Treinar</span></button>`).join('') : '<p>Os padrões aparecerão conforme você jogar e revisar.</p>'}</section>
    <section class="card"><h2>Suas partidas</h2>${games.length ? games.map(g=>`<button type="button" class="history-row" data-game="${g.id}"><span><strong>${g.mode==='study'?'Estudo':'Teste'} · ${escapeHtml(g.result)}</strong><small>${new Date(g.date).toLocaleString('pt-BR')} · ${g.playerColor==='black'?'Pretas':'Brancas'}</small></span><span>${g.moveCount ? g.accuracy + '% precisão' : 'Sem lances analisados'} →</span></button>`).join(''):'<p>Suas próximas partidas ficarão disponíveis para revisão aqui.</p>'}
    ${legacy.length ? `<h3>Registros anteriores</h3>${legacy.slice().reverse().map(g=>`<div class="history-row"><span>${new Date(g.date).toLocaleDateString('pt-BR')} · ${escapeHtml(g.result)}<small>Resumo antigo · replay indisponível</small></span><span>${g.accuracy}%</span></div>`).join('')}` : ''}</section></main>`;
    container.querySelectorAll<HTMLButtonElement>('[data-game]').forEach(b=>b.addEventListener('click',()=>{const g=games.find(g=>g.id===b.dataset.game);if(g)this.onReview(g);}));
    container.querySelectorAll<HTMLButtonElement>('[data-category]').forEach(b=>b.addEventListener('click',()=>this.onTrain(b.dataset.category as TacticalCategory)));
  }
  destroy():void{this.container.innerHTML='';}
}
