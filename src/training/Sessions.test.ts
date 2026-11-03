import { beforeEach,expect,it } from 'vitest';
import { getStorage } from '../storage';
import { selectTrainingSession,recordTrainingAttempt,getTrainingQueue,saveTrainingQueue,getDueTrainingPositions } from './TrainingManager';
beforeEach(()=>getStorage().clear());
it('persists curated attempts and never repeats scheduled items early',()=>{const s=selectTrainingSession('daily',5);for(const p of s)recordTrainingAttempt(p.id,true);const next=selectTrainingSession('daily',5);expect(next.some(p=>s.some(old=>old.id===p.id))).toBe(false);expect(getTrainingQueue().find(p=>p.id===s[0].id)?.attempts).toBe(1);});
it('an assisted answer does not advance mastery',()=>{const [p]=selectTrainingSession('theme',5,'garfo');const next=recordTrainingAttempt(p.id,true,true);expect(next?.srsLevel).toBe(0);expect(next?.mastered).toBe(false);});
it('brings mastered positions back when their review is due',()=>{const [p]=selectTrainingSession('daily',1);recordTrainingAttempt(p.id,true);recordTrainingAttempt(p.id,true);const q=getTrainingQueue();q[0].nextReviewDate='2000-01-01';saveTrainingQueue(q);expect(getDueTrainingPositions()[0].mastered).toBe(true);expect(selectTrainingSession('daily',1)[0].id).toBe(p.id);});
it('theme sessions select actual matching puzzles and freeze the sequence',()=>{const s=selectTrainingSession('theme',10,'cravada');expect(s).toHaveLength(10);expect(s.every(p=>p.category==='cravada')).toBe(true);const ids=s.map(p=>p.id);recordTrainingAttempt(s[0].id,false);expect(s.map(p=>p.id)).toEqual(ids);});
