import { beforeAll,afterAll,describe,it,expect } from 'vitest';
import { Chess } from 'chess.js';
import { TRAINING_PUZZLES } from './trainingPuzzles';
import { ASSESSMENT_PUZZLES } from './puzzles';
import { StockfishEngine } from '../engine/StockfishEngine';
import { createNodeStockfishWorker } from '../engine/nodeWorkerAdapter';
describe('Offline thematic bank — Stockfish validation',()=>{
 let engine:StockfishEngine;
 beforeAll(async()=>{engine=new StockfishEngine(createNodeStockfishWorker);await engine.init();});
 afterAll(()=>engine.destroy());
 it('has 60 distinct positions, ten per theme, independent of assessment',()=>{
   expect(TRAINING_PUZZLES).toHaveLength(60);expect(new Set(TRAINING_PUZZLES.map(p=>p.fen)).size).toBe(60);
   const counts=new Map<string,number>();for(const p of TRAINING_PUZZLES){counts.set(p.category,(counts.get(p.category)||0)+1);expect(ASSESSMENT_PUZZLES.some(a=>a.fen===p.fen)).toBe(false);}
   expect([...counts.values()]).toEqual([10,10,10,10,10,10]);
 });
 for(const p of TRAINING_PUZZLES) it(`${p.id} · ${p.category}: full solution is legal and supported by the engine`,async()=>{
   const c=new Chess(p.fen);expect(p.solution[0]).toBe(p.bestMove);
   for(let i=0;i<p.solution.length;i++){
     const move=p.solution[i];let best='';if(i%2===0)best=(await engine.evaluate(c.fen(),12)).bestMove;
     c.move({from:move.slice(0,2),to:move.slice(2,4),promotion:move[4]});
     if(i%2===0)expect(best===move || c.isCheckmate()).toBe(true);
   }
 });
});
