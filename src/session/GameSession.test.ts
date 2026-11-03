import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { GameController } from '../game/GameController';
import { getStorage, isStorageDurable } from '../storage';
import { createProfile, getProfile, saveProfile } from '../profile/ProfileManager';
import { getSettings } from '../profile/SettingsManager';
import { finalizeGame, getCompletedGames, saveActiveGame, getActiveGame, reconcileCompletion, type ActiveGame } from './GameSession';
import { GameClock } from './Clock';
const data = {id:'test-1',mode:'test' as const,accuracy:80,acpl:40,moveCount:3,excellentMoves:2,goodMoves:1,inaccuracies:0,mistakes:0,blunders:0,result:'0-1',playerColor:'black' as const,mistakesHistory:[],pgn:new GameController().getPgn()};
beforeEach(()=>{getStorage().clear();createProfile(1200);});
afterEach(()=>vi.unstubAllGlobals());
describe('Persistent games and idempotent completion',()=>{
 it('counts a black win correctly and records the result exactly once',()=>{
   const record=finalizeGame(data);expect(record.eloAfter).toBe(1230);
   finalizeGame(data);expect(getProfile()?.gamesPlayed).toBe(1);expect(getCompletedGames()).toHaveLength(1);
 });
 it('study records learning without changing Elo or Elo history',()=>{
   const record=finalizeGame({...data,mode:'study'});expect(record.eloAfter).toBe(1200);
   expect(getProfile()?.gamesPlayed).toBe(1);expect(getProfile()?.eloHistory).toHaveLength(1);
 });
 it('recovers a completion journal without incrementing the profile again',()=>{
   const record=finalizeGame(data);const profile=getProfile();
   getStorage().setItem('xadrez-coach-completion-v1',JSON.stringify({record,profile,stats:[{...data,date:record.date}]}));
   reconcileCompletion();reconcileCompletion();expect(getProfile()).toEqual(profile);expect(getCompletedGames()).toHaveLength(1);
 });
 it('restores PGN repetition history and undo, not merely the final FEN',()=>{
   const game=new GameController();for(let i=0;i<2;i++){game.makeMove('g1','f3');game.makeMove('g8','f6');game.makeMove('f3','g1');game.makeMove('f6','g8');}
   const snap:ActiveGame={version:1,id:'ongoing',pgn:game.getPgn(),mode:'study',settings:getSettings(),targetElo:1250,phase:'player',analyzedMoves:[],clock:{white:123.5,black:80},lastFen:game.getFen(),cachedEval:null};
   saveActiveGame(snap);const saved=getActiveGame()!;expect(saved.clock.white).toBe(123.5);
   const restored=new GameController();expect(restored.loadPgn(saved.pgn)).toBe(true);expect(restored.isThreefoldRepetition()).toBe(true);restored.undoMove();expect(restored.getHistory()).toHaveLength(7);
 });
 it('rejects corrupt snapshots',()=>{getStorage().setItem('xadrez-coach-active-v1','{"version":1,"id":"bad"}');expect(getActiveGame()).toBeNull();});
 it('does not claim durability or alter ratings when browser storage rejects writes',()=>{
   vi.stubGlobal('localStorage',{getItem:()=>null,setItem:()=>{throw Error('quota');},removeItem:()=>{}});
   getStorage().setItem('probe','1');expect(isStorageDurable()).toBe(false);
   const result=finalizeGame(data);expect(result.storageWarning).toBe(true);
 });
 it('preserves daily activity fields on profile reads',()=>{const p=getProfile()!;p.streakDays=5;p.lastActiveDate='2026-11-01';saveProfile(p);expect(getProfile()?.streakDays).toBe(5);});
});
describe('Elapsed time clock',()=>{
 it('accounts elapsed time and freezes across long pauses',()=>{let now=0;const c=new GameClock(3,()=>now);c.start('w');now=2350;expect(c.snapshot().white).toBeCloseTo(177.65);c.pause();now=999999;expect(c.snapshot().white).toBeCloseTo(177.65);c.start('b');now+=1000;expect(c.snapshot().black).toBe(179);});
 it('restores remaining time without restarting it',()=>{const c=new GameClock(10,()=>999999);c.restore({white:45,black:30});expect(c.snapshot()).toEqual({white:45,black:30});});
});

describe('Completion quota failures after the journal is durable',()=>{
 for(const failedKey of ['xadrez-coach-history-v1','xadrez-coach-stats','xadrez-coach-profile']) it(`reports and recovers failure writing ${failedKey}`,()=>{
   const values=new Map<string,string>();let reject=false;
   vi.stubGlobal('localStorage',{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{if(reject && k===failedKey)throw Error('quota');values.set(k,v);},removeItem:(k:string)=>values.delete(k)});
   createProfile(1200);reject=true;
   const failed=finalizeGame(data);expect(failed.storageWarning).toBe(true);expect(values.has('xadrez-coach-completion-v1')).toBe(true);
   const original=values.get('xadrez-coach-completion-v1');
   expect(finalizeGame({...data,id:'second-result'}).storageWarning).toBe(true);
   expect(values.get('xadrez-coach-completion-v1')).toBe(original);
   reject=false;expect(reconcileCompletion()).toBe(true);expect(getProfile()?.gamesPlayed).toBe(1);expect(getProfile()?.estimatedElo).toBe(1230);
   expect(getCompletedGames()).toHaveLength(1);expect(finalizeGame(data).eloAfter).toBe(1230);expect(getProfile()?.gamesPlayed).toBe(1);
 });
});
it('does not infer accuracy or change rating for a game without analyzed moves',()=>{
 const record=finalizeGame({...data,moveCount:0});expect(record.eloAfter).toBe(1200);expect(getProfile()?.gamesPlayed).toBe(0);
});
it('reports a denied localStorage getter without crashing completion',()=>{
 vi.stubGlobal('localStorage',undefined);
 Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('SecurityError');}});
 expect(finalizeGame(data).storageWarning).toBe(true);
});
