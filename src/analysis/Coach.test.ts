import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { explainPosition } from './Coach';
describe('Grounded progressive hints',()=>{
 it('explains central control without claiming a forced advantage',()=>{const h=explainPosition(new Chess().fen(),'e2e4',['e2e4','e7e5','g1f3']);expect(h.answer).toContain('d5');expect(h.observation).not.toContain('e4');expect(h.frames).toHaveLength(4);});
 it('demonstrates a legal line without mutating its source position',()=>{const chess=new Chess();const fen=chess.fen();const h=explainPosition(fen,'g1f3',['g1f3','g8f6','illegal']);expect(chess.fen()).toBe(fen);expect(h.frames).toHaveLength(3);expect(h.answer).toContain('primeira fileira');});
 it('identifies verified checkmate',()=>{const c=new Chess();for(const m of ['f3','e5','g4'])c.move(m);const h=explainPosition(c.fen(),'d8h4');expect(h.answer).toContain('xeque-mate');});
});
