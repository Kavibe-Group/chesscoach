import { confirmAction } from '../confirmAction.js';
import { GameController } from '../../game/GameController.js';
import { ChessBoard } from '../ChessBoard.js';
import { explainPosition, escapeHtml } from '../../analysis/Coach.js';
import { CATEGORY_LABELS, type TacticalCategory } from '../../analysis/MoveAnalyzer.js';
import { selectTrainingSession, recordTrainingAttempt, TRAINING_THEMES, type TrainingPosition, type TrainingSource } from '../../training/TrainingManager.js';
import { getProfile, recordDailyActivity } from '../../profile/index.js';
export interface TrainingScreenEvents { onBack:()=>void; }
export interface TrainingSession { source:TrainingSource; category?:TacticalCategory; limit:number; positions:TrainingPosition[]; correct:number; assisted:number; }
export class TrainingScreen {
  private container:HTMLElement; private events:TrainingScreenEvents;
  private queue:TrainingPosition[]=[]; private currentIdx=0; private game=new GameController();
  private board:ChessBoard|null=null; private isAnswered=false; private assisted=false; private step=0; private hintLevel=0;
  private score=0; private helped=0; private category?:TacticalCategory;
  private keydown=(e:KeyboardEvent)=>{if(this.isAnswered && ['Enter',' ','ArrowRight'].includes(e.key)){e.preventDefault();this.next();}};
  constructor(container:HTMLElement,events:TrainingScreenEvents,category?:TacticalCategory){
    this.container=container;this.events=events;this.category=category;this.renderPicker();
    if(typeof window!=='undefined')window.addEventListener('keydown',this.keydown);
  }
  private renderPicker():void {
    this.board?.destroy();this.board=null;
    this.container.innerHTML=`<main class="training-picker"><div class="eyebrow">TREINAR</div><h1>Escolha o seu foco.</h1><p class="page-intro">Pratique seus erros, explore um tema ou faça uma revisão curta.</p>
    <section class="card"><label for="training-source">Tipo de treino</label><select id="training-source"><option value="daily">Treino diário · revisões e novos puzzles</option><option value="errors">Meus erros</option><option value="theme" ${this.category?'selected':''}>Por tema</option></select>
    <label for="training-category">Tema</label><select id="training-category" ${this.category?'':'disabled'}><option value="">Todos os temas</option>${[...new Set([...TRAINING_THEMES,...(this.category?[this.category]:[])])].map(c=>`<option value="${c}" ${this.category===c?'selected':''}>${CATEGORY_LABELS[c]}</option>`).join('')}</select>
    <label for="training-size">Tamanho da sessão</label><select id="training-size"><option value="5">5 exercícios</option><option value="10">10 exercícios</option><option value="100000">Treino livre · todas as posições disponíveis</option></select>
    <button type="button" class="btn btn-primary btn-lg" id="start-training">Começar treino</button><p id="training-empty" role="status"></p></section></main>`;
    this.container.querySelector('#training-source')?.addEventListener('change',event=>{this.container.querySelector<HTMLSelectElement>('#training-category')!.disabled=(event.target as HTMLSelectElement).value!=='theme';});
    this.container.querySelector('#start-training')?.addEventListener('click',()=>{
      const source=this.container.querySelector<HTMLSelectElement>('#training-source')!.value as TrainingSource;
      const category=this.container.querySelector<HTMLSelectElement>('#training-category')!.value as TacticalCategory || undefined;
      if(source==='theme'&&!category){this.container.querySelector('#training-empty')!.textContent='Escolha um tema para começar.';return;}
      this.queue=selectTrainingSession(source,Number(this.container.querySelector<HTMLSelectElement>('#training-size')!.value),source==='theme'?category:undefined);
      if(!this.queue.length){this.container.querySelector('#training-empty')!.textContent='Nenhuma posição disponível para essa seleção. Experimente outro tema ou volte na próxima revisão.';return;}
      this.currentIdx=0;this.score=0;this.helped=0;this.render();
    });
  }
  render():void {
    this.board?.destroy();this.board=null;
    if(this.currentIdx>=this.queue.length){this.renderSummary();return;}
    const pos=this.queue[this.currentIdx];
    this.isAnswered=false;this.assisted=false;this.step=0;this.hintLevel=0;this.game.loadFen(pos.fen);
    this.container.innerHTML=`<main class="training-screen active compact-training"><header class="screen-header"><button type="button" class="btn btn-ghost" id="exit-training">← Treinos</button><span>Exercício ${this.currentIdx+1} de ${this.queue.length}</span></header>
    <div class="training-layout"><div class="board-column"><div id="training-board-container" class="board-frame"></div><div class="training-actions"><button type="button" class="btn btn-secondary" id="training-hint">Dica</button><button type="button" class="btn btn-primary" id="btn-next-training" hidden>Próximo</button></div></div>
    <section class="side-column card"><span class="eyebrow">${pos.category?CATEGORY_LABELS[pos.category]:'SEUS ERROS'}</span><h2>Encontre a continuação.</h2><p>${this.game.turn()==='w'?'Brancas':'Pretas'} jogam. ${pos.playerMove!=='—'?`Antes você jogou ${escapeHtml(pos.playerMove)}.`:''}</p><div id="training-feedback" aria-live="polite">Faça seu lance no tabuleiro.</div><p id="training-help" aria-live="polite"></p></section></div></main>`;
    this.board=new ChessBoard(this.container.querySelector<HTMLElement>('#training-board-container')!,this.game,this.game.turn()==='w'?'white':'black');
    this.board.onMove(e=>this.handlePlayerMove(e.from+e.to+(e.promotion||'')));
    this.container.querySelector('#exit-training')?.addEventListener('click',async()=>{if(this.currentIdx && !await confirmAction('Encerrar esta sessão? Seu progresso já está salvo.'))return;this.renderPicker();});
    this.container.querySelector('#btn-next-training')?.addEventListener('click',()=>this.next());
    this.container.querySelector('#training-hint')?.addEventListener('click',()=>{
      if(this.isAnswered)return;this.assisted=true;
      const move=(pos.solution ?? [pos.bestMove])[this.step];
      const hint=explainPosition(this.game.getFen(),move,[move]);this.hintLevel=Math.min(3,this.hintLevel+1);
      this.container.querySelector('#training-help')!.textContent=this.hintLevel===1?hint.observation:this.hintLevel===2?hint.idea:hint.answer;
      if(this.hintLevel===3)this.board?.showBestMove(move.slice(0,2),move.slice(2,4));
    });
  }
  private handlePlayerMove(moveUci:string):void {
    if(this.isAnswered)return;
    const pos=this.queue[this.currentIdx];const solution=pos.solution ?? [pos.bestMove];
    const expected=solution[this.step];
    // A different mate-in-one is valid too.
    const correct=moveUci===expected || (this.game.isCheckmate() && solution.length===1);
    if(correct && this.step+1<solution.length){
      const response=solution[this.step+1];
      const move=this.game.makeMove(response.slice(0,2),response.slice(2,4),response[4]);
      if(move){this.step+=2;this.hintLevel=0;this.board?.sync();this.container.querySelector('#training-help')!.textContent='';this.container.querySelector('#training-feedback')!.textContent=`O adversário respondeu ${move.san}. Continue.`;return;}
    }
    this.isAnswered=true;this.board?.setInteractive(false);
    const updated=recordTrainingAttempt(pos.id,correct,this.assisted);
    if(correct && !this.assisted)this.score++;if(this.assisted)this.helped++;
    const p=getProfile();if(p)recordDailyActivity(p);
    let fact='';try{fact=explainPosition(pos.fen,pos.bestMove,pos.solution ? [...pos.solution] : []).answer;}catch{/* Legacy position. */}
    const feedback=this.container.querySelector<HTMLElement>('#training-feedback')!;
    feedback.innerHTML=`<strong>${correct?(this.assisted?'Resolvido com ajuda':'Correto'):'Vamos revisar'}</strong><p>${escapeHtml(pos.explanation)}</p><p>${escapeHtml(fact)}</p><small>${this.assisted?'Ajuda usada: não avança domínio.':`Próxima revisão: ${updated?.nextReviewDate ? new Date(updated.nextReviewDate).toLocaleDateString('pt-BR'):'disponível'}`}</small>`;
    if(!correct){this.game.loadFen(pos.fen);this.board?.sync();this.board?.showBestMove(pos.bestMove.slice(0,2),pos.bestMove.slice(2,4));}
    const next=this.container.querySelector<HTMLButtonElement>('#btn-next-training')!;next.hidden=false;next.textContent=this.currentIdx+1===this.queue.length?'Ver resultado':'Próximo';
    this.container.querySelector<HTMLButtonElement>('#training-hint')!.disabled=true;
  }
  private next():void {if(!this.isAnswered)return;this.currentIdx++;this.render();}
  private renderSummary():void {
    this.isAnswered=false;
    this.container.innerHTML=`<main class="training-picker"><div class="eyebrow">SESSÃO CONCLUÍDA</div><h1>Treino feito.</h1><section class="card"><div class="metric-grid"><div><strong>${this.queue.length}</strong><span>exercícios</span></div><div><strong>${this.score}</strong><span>acertos sem ajuda</span></div><div><strong>${this.helped}</strong><span>com ajuda</span></div></div><p>As revisões foram agendadas conforme suas respostas. Erros e respostas com ajuda continuam disponíveis.</p><button type="button" class="btn btn-primary" id="another-session">Escolher outro treino</button></section></main>`;
    this.container.querySelector('#another-session')?.addEventListener('click',()=>this.renderPicker());
  }
  destroy():void {if(typeof window!=='undefined')window.removeEventListener('keydown',this.keydown);this.board?.destroy();this.container.innerHTML='';}
}
