import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Config } from 'chessground/config';
import type { Key, Color as CgColor } from 'chessground/types';
import type { DrawShape } from 'chessground/draw';
import type { Square } from 'chess.js';
import { GameController } from '../game/GameController.js';
import { PromotionModal } from './PromotionModal.js';

export interface MoveEvent {
  from: string;
  to: string;
  promotion?: string;
  san: string;
}

export class ChessBoard {
  private cg: Api;
  private container: HTMLElement;
  private game: GameController;
  private promotionModal: PromotionModal;
  private playerColor: 'white' | 'black' = 'white';
  private onMoveCallback: ((event: MoveEvent) => void) | null = null;
  private isInteractive = true;

  constructor(container: HTMLElement, game: GameController, playerColor: 'white' | 'black' = 'white') {
    this.container = container;
    this.game = game;
    this.playerColor = playerColor;
    this.promotionModal = new PromotionModal();

    this.container.classList.add('cg-board-wrapper');
    this.cg = Chessground(this.container, this.buildConfig());
  }

  private buildConfig(): Config {
    const turn = this.game.turn() === 'w' ? 'white' : 'black';
    const isPlayerTurn = turn === this.playerColor && this.isInteractive && !this.game.isGameOver();

    return {
      fen: this.game.getFen(),
      orientation: this.playerColor,
      turnColor: turn,
      check: this.game.isCheck(),
      autoCastle: true,
      blockTouchScroll: true,
      animation: {
        enabled: true,
        duration: 200,
      },
      movable: {
        free: false,
        color: isPlayerTurn ? this.playerColor : undefined,
        dests: isPlayerTurn ? this.calculateDests() : new Map(),
        showDests: true,
        events: {
          after: (orig: Key, dest: Key) => this.handleUserMove(orig, dest),
        },
      },
      drawable: {
        enabled: true,
        visible: true,
      },
    };
  }

  private calculateDests(): Map<Key, Key[]> {
    const dests = new Map<Key, Key[]>();
    const legalMoves = this.game.getLegalMoves();
    for (const m of legalMoves) {
      const from = m.from as Key;
      const to = m.to as Key;
      const existing = dests.get(from) || [];
      if (!existing.includes(to)) {
        existing.push(to);
        dests.set(from, existing);
      }
    }
    return dests;
  }

  private async handleUserMove(orig: Key, dest: Key): Promise<void> {
    if (orig === 'a0' || dest === 'a0') {
      this.sync();
      return;
    }

    // Verifica se é lance de promoção de peão
    let promotion: string | undefined = undefined;
    const piece = this.game.get(orig as Square);

    if (piece && piece.type === 'p') {
      const isWhitePromotion = piece.color === 'w' && orig[1] === '7' && dest[1] === '8';
      const isBlackPromotion = piece.color === 'b' && orig[1] === '2' && dest[1] === '1';

      if (isWhitePromotion || isBlackPromotion) {
        promotion = await this.promotionModal.open();
      }
    }

    const move = this.game.makeMove(orig, dest, promotion);
    if (!move) {
      // Lance ilegal (ou cancelado): restaura posição do tabuleiro
      this.sync();
      return;
    }

    // Atualiza estado do tabuleiro
    this.sync();

    // Notifica callback
    if (this.onMoveCallback) {
      this.onMoveCallback({
        from: orig,
        to: dest,
        promotion,
        san: move.san,
      });
    }
  }

  /**
   * Sincroniza o tabuleiro visual com o estado do GameController
   */
  sync(): void {
    const turn = this.game.turn() === 'w' ? 'white' : 'black';
    const isPlayerTurn = turn === this.playerColor && this.isInteractive && !this.game.isGameOver();

    const history = this.game.getHistory();
    const lastMove = history.length > 0
      ? [history[history.length - 1].from as Key, history[history.length - 1].to as Key]
      : undefined;

    this.cg.set({
      fen: this.game.getFen(),
      turnColor: turn,
      check: this.game.isCheck(),
      lastMove,
      movable: {
        color: isPlayerTurn ? this.playerColor : undefined,
        dests: isPlayerTurn ? this.calculateDests() : new Map(),
      },
    });
  }

  /**
   * Exibe seta verde para o melhor lance recomendado pelo motor
   */
  showBestMove(from: string, to: string): void {
    const shape: DrawShape = {
      orig: from as Key,
      dest: to as Key,
      brush: 'green',
    };
    this.cg.setAutoShapes([shape]);
  }

  /**
   * Remove setas e destaques temporários
   */
  clearShapes(): void {
    this.cg.setAutoShapes([]);
  }

  /**
   * Ativa ou desativa interatividade do jogador
   */
  setInteractive(interactive: boolean): void {
    this.isInteractive = interactive;
    this.sync();
  }

  /**
   * Define o callback disparado quando o jogador realiza um lance legal
   */
  onMove(callback: (event: MoveEvent) => void): void {
    this.onMoveCallback = callback;
  }

  /**
   * Altera a orientação das peças
   */
  setOrientation(color: 'white' | 'black'): void {
    this.playerColor = color;
    this.cg.set({ orientation: color });
    this.sync();
  }

  /**
   * Carrega uma nova posição FEN
   */
  setFen(fen: string): void {
    this.game.loadFen(fen);
    this.cg.set({ fen });
    this.clearShapes();
    this.sync();
  }

  destroy(): void {
    this.cg.destroy();
    this.promotionModal.destroy();
  }
}
