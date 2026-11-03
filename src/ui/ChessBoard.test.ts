import { describe, it, expect, vi } from 'vitest';
import { GameController } from '../game/GameController';

let capturedConfig: any = null;

vi.mock('chessground', () => {
  return {
    Chessground: vi.fn((el, config) => {
      capturedConfig = config;
      return {
        set: vi.fn(),
        state: {},
        getFen: vi.fn(),
        destroy: vi.fn(),
      };
    }),
  };
});

vi.mock('./PromotionModal', () => {
  return {
    PromotionModal: class {
      destroy = vi.fn();
    },
  };
});

describe('ChessBoard - BUG-10 (autoCastle e blockTouchScroll)', () => {
  it('configura autoCastle: true e blockTouchScroll: true para usabilidade mobile e roque fluido', async () => {
    const { ChessBoard } = await import('./ChessBoard');
    const container = {
      classList: { add: vi.fn() },
    } as unknown as HTMLElement;

    const game = new GameController();
    const board = new ChessBoard(container, game, 'white');

    expect(capturedConfig).toBeDefined();
    expect(capturedConfig.autoCastle).toBe(true);
    expect(capturedConfig.blockTouchScroll).toBe(true);

    board.destroy();
  });
});

it('does not apply a promotion resolved after the board is destroyed',async()=>{
 const {ChessBoard}=await import('./ChessBoard');
 const game=new GameController('7k/P7/8/8/8/8/8/7K w - - 0 1');
 const board=new ChessBoard({classList:{add:vi.fn()}} as unknown as HTMLElement,game,'white');
 let resolve!:(piece:string)=>void;
 (board as any).promotionModal.open=()=>new Promise<string>(r=>resolve=r);
 const fen=game.getFen();const pending=(board as any).handleUserMove('a7','a8');board.destroy();resolve('q');await pending;
 expect(game.getFen()).toBe(fen);
});
