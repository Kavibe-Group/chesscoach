export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

export class PromotionModal {
  private element: HTMLElement;
  private resolveCallback: ((piece: PromotionPiece | undefined) => void) | null = null;
  private currentColor: 'white' | 'black' = 'white';

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'promotion-modal-overlay';
    this.element.style.display = 'none';
    this.render();
    if (typeof document !== 'undefined' && document.body) {
      document.body.appendChild(this.element);
    }
  }

  private render(): void {
    const isWhite = this.currentColor === 'white';
    const queenIcon = isWhite ? '♕' : '♛';
    const rookIcon = isWhite ? '♖' : '♜';
    const bishopIcon = isWhite ? '♗' : '♝';
    const knightIcon = isWhite ? '♘' : '♞';

    this.element.innerHTML = `
      <div class="promotion-modal-card">
        <h3>Promover Peão</h3>
        <p>Escolha a peça para promoção:</p>
        <div class="promotion-choices">
          <button type="button" class="promo-btn" data-piece="q" title="Dama">
            <span class="promo-icon">${queenIcon}</span>
            <span class="promo-name">Dama</span>
          </button>
          <button type="button" class="promo-btn" data-piece="r" title="Torre">
            <span class="promo-icon">${rookIcon}</span>
            <span class="promo-name">Torre</span>
          </button>
          <button type="button" class="promo-btn" data-piece="b" title="Bispo">
            <span class="promo-icon">${bishopIcon}</span>
            <span class="promo-name">Bispo</span>
          </button>
          <button type="button" class="promo-btn" data-piece="n" title="Cavalo">
            <span class="promo-icon">${knightIcon}</span>
            <span class="promo-name">Cavalo</span>
          </button>
        </div>
        <div class="promo-cancel-row">
          <button type="button" class="btn btn-ghost btn-sm" id="btn-cancel-promotion">Cancelar lance</button>
        </div>
      </div>
    `;

    const buttons = this.element.querySelectorAll<HTMLButtonElement>('.promo-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const piece = btn.dataset.piece as PromotionPiece;
        this.close(piece);
      });
    });

    this.element.querySelector('#btn-cancel-promotion')?.addEventListener('click', () => {
      this.close(undefined);
    });

    this.element.addEventListener('click', (e) => {
      if (e.target === this.element) {
        this.close(undefined);
      }
    });
  }

  open(color: 'white' | 'black' = 'white'): Promise<PromotionPiece | undefined> {
    this.currentColor = color;
    this.render();
    return new Promise(resolve => {
      this.resolveCallback = resolve;
      this.element.style.display = 'flex';
    });
  }

  private close(piece: PromotionPiece | undefined): void {
    this.element.style.display = 'none';
    if (this.resolveCallback) {
      this.resolveCallback(piece);
      this.resolveCallback = null;
    }
  }

  destroy(): void {
    this.element.remove();
  }
}
