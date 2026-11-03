import { beforeEach,describe,expect,it,vi } from 'vitest';
import { Chess } from 'chess.js';
import { GameScreen } from './GameScreen';
import { getStorage } from '../../storage';
import { saveSettings,getSettings } from '../../profile/SettingsManager';
import { getActiveGame,saveActiveGame,getCompletedGames } from '../../session/GameSession';
import { createProfile } from '../../profile/ProfileManager';

vi.mock('../ChessBoard',()=>({ChessBoard:class{sync=vi.fn();clearShapes=vi.fn();setInteractive=vi.fn();showBestMove=vi.fn();showAnalysisShapes=vi.fn();destroy=vi.fn();onMove=vi.fn();}}));
vi.mock('../ClockView',()=>({ClockView:class{start=vi.fn();stop=vi.fn();reset=vi.fn();switchTurn=vi.fn();destroy=vi.fn();onTimeOut=vi.fn();restore=vi.fn();snapshot=()=>({white:120,black:100});}}));
vi.mock('../../engine/StockfishEngine',()=>({eloToEngineConfig:()=>({}),StockfishEngine:class{
 init=async()=>{};setStrength=async()=>{};stop=vi.fn();destroy=vi.fn();newGame=async()=>{};
 evaluate=async(fen:string)=>{const c=new Chess(fen);const m=c.moves({verbose:true})[0];return {score:c.turn()==='b'?400:0,mate:null,bestMove:m?m.from+m.to+(m.promotion||''):'',pv:[],depth:12};};
 getBestMove=async(fen:string)=>{const c=new Chess(fen);const m=c.moves({verbose:true})[0];return m.from+m.to+(m.promotion||'');};
}}));
function container():HTMLElement {return {innerHTML:'',querySelector:vi.fn(()=>({addEventListener:vi.fn(),textContent:'',style:{},hidden:false,disabled:false,querySelector:()=>null})),querySelectorAll:()=>[]} as unknown as HTMLElement;}
async function screen(mode:'study'|'test'='study') {saveSettings({gameMode:mode});const s=new GameScreen(container(),{onGameOver:vi.fn(),onExit:vi.fn()});await vi.waitFor(()=>expect((s as any).ready).toBe(true));return s as any;}
beforeEach(()=>{getStorage().clear();createProfile(1200);});
describe('Game interruption boundaries',()=>{
 it('pauses before the engine answers a study error and permits retry',async()=>{const s=await screen();const original=s.game.getFen();const move=s.game.makeMove('e2','e4');await s.handlePlayerMove(move);expect(s.phase).toBe('decision');expect(s.analyzing).toBe(false);expect(s.game.getHistory()).toHaveLength(1);expect(getActiveGame()?.phase).toBe('decision');s.handleRetryMove();expect(s.game.getFen()).toBe(original);expect(s.analyzedMoves).toHaveLength(0);s.destroy();});
 it('test plays through without revealing feedback or enabling retries',async()=>{const s=await screen('test');const feedback=vi.spyOn(s.feedbackCard,'renderAnalysis');const move=s.game.makeMove('e2','e4');await s.handlePlayerMove(move);expect(s.game.getHistory()).toHaveLength(2);expect(s.phase).toBe('player');expect(feedback).not.toHaveBeenCalled();s.handleRetryMove();expect(s.game.getHistory()).toHaveLength(2);s.destroy();});
 it('does not apply a stale engine answer after pausing; continuing applies only one reply',async()=>{const s=await screen('test');let reply!:(move:string)=>void;s.game.makeMove('e2','e4');s.phase='engine';s.opponentEngine.getBestMove=()=>new Promise<string>(r=>reply=r);const pending=s.triggerEngineMove();s.pauseGame();reply('e7e5');await pending;expect(s.game.getHistory()).toHaveLength(1);s.opponentEngine.getBestMove=async()=> 'e7e5';await s.continueGame();expect(s.game.getHistory()).toHaveLength(2);s.destroy();});
 it('restores an interrupted analysis, completes it once, then saves a decision',async()=>{
   const c=new Chess();c.move('e4');saveActiveGame({version:1,id:'recover-analysis',pgn:c.pgn(),settings:getSettings(),mode:'study',targetElo:1250,phase:'analysis',analyzedMoves:[],clock:{white:75,black:60},lastFen:new Chess().fen(),cachedEval:{score:0,mate:null,bestMove:'d2d4',pv:['d2d4']}});
   const s=await screen();expect(s.paused).toBe(true);expect(s.game.getHistory()).toHaveLength(1);await s.continueGame();expect(s.phase).toBe('decision');expect(s.analyzedMoves).toHaveLength(1);expect(s.game.getHistory()).toHaveLength(1);s.destroy();
 });
 it('restores a saved decision without repeating analysis or the engine reply',async()=>{const s=await screen();await s.handlePlayerMove(s.game.makeMove('e2','e4'));s.destroy();const r=await screen();expect(r.phase).toBe('decision');expect(r.paused).toBe(true);await r.continueGame();expect(r.game.getHistory()).toHaveLength(2);expect(r.analyzedMoves).toHaveLength(1);r.destroy();});
 it('concludes a terminal restored position rather than waiting for a missing engine move',async()=>{
  const s=await screen('test');for(const [from,to] of [['f2','f3'],['e7','e5'],['g2','g4'],['d8','h4']])s.game.makeMove(from,to);
  s.phase='engine';s.pauseGame();await s.continueGame();expect(getCompletedGames()).toHaveLength(1);s.destroy();
 });
});

describe('Clock and cache transition locks',()=>{
 it('does not start the player clock until analysis finishes and input is enabled',async()=>{
   const s=await screen('test');s.game.makeMove('e2','e4');s.phase='engine';
   let evaluation!:(value:any)=>void;s.analystEngine.evaluate=()=>new Promise(r=>evaluation=r);
   const pending=s.triggerEngineMove();await vi.waitFor(()=>expect(evaluation).toBeDefined());
   const starts=s.clockView.start.mock.calls.length;
   expect(s.board.setInteractive.mock.calls.at(-1)[0]).toBe(false);
   expect(s.clockView.stop).toHaveBeenCalled();
   evaluation({score:0,mate:null,bestMove:'g1f3',pv:['g1f3']});await pending;
   expect(s.clockView.start.mock.calls.length).toBe(starts+1);expect(s.board.setInteractive.mock.calls.at(-1)[0]).toBe(true);s.destroy();
 });
 it('keeps a new game locked and clears its stale evaluation before preparing the initial position',async()=>{
   const s=await screen();let evaluation!:(value:any)=>void;
   s.analystEngine.evaluate=()=>new Promise(r=>evaluation=r);
   const pending=s.handleNewGame(true);await vi.waitFor(()=>expect(evaluation).toBeDefined());
   expect(s.lastEvalBeforeMove).toBeNull();expect(s.board.setInteractive.mock.calls.at(-1)[0]).toBe(false);
   evaluation({score:0,mate:null,bestMove:'e2e4',pv:['e2e4']});await pending;expect(s.lastEvalBeforeMove.bestMove).toBe('e2e4');expect(s.board.setInteractive.mock.calls.at(-1)[0]).toBe(true);s.destroy();
 });
 it('does not reset a session after the screen is destroyed during newGame',async()=>{
   const s=await screen();const original=s.id;let done!:()=>void;
   s.opponentEngine.newGame=()=>new Promise<void>(r=>done=r);const pending=s.handleNewGame(true);s.destroy();done();await pending;expect(s.id).toBe(original);
 });
});
it('rejects a player move if time expired between clock ticks',async()=>{
 const s=await screen('test');s.clockView.expired=()=>true;
 const move=s.game.makeMove('e2','e4');await s.handlePlayerMove(move);
 expect(s.game.getHistory()).toHaveLength(0);expect(getCompletedGames()[0].result).toBe('0-1');s.destroy();
});
