export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

export class PromotionModal {
  private element: HTMLElement;
  private resolveCallback: ((piece: PromotionPiece) => void) | null = null;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'promotion-modal-overlay';
    this.element.style.display = 'none';
    this.render();
    document.body.appendChild(this.element);
  }

  private render(): void {
    this.element.innerHTML = `
      <div class="promotion-modal-card">
        <h3>Promover Peão</h3>
        <p>Escolha a peça para promoção:</p>
        <div class="promotion-choices">
          <button type="button" class="promo-btn" data-piece="q" title="Dama">
            <span class="promo-icon">♛</span>
            <span class="promo-name">Dama</span>
          </button>
          <button type="button" class="promo-btn" data-piece="r" title="Torre">
            <span class="promo-icon">♜</span>
            <span class="promo-name">Torre</span>
          </button>
          <button type="button" class="promo-btn" data-piece="b" title="Bispo">
            <span class="promo-icon">♝</span>
            <span class="promo-name">Bispo</span>
          </button>
          <button type="button" class="promo-btn" data-piece="n" title="Cavalo">
            <span class="promo-icon">♞</span>
            <span class="promo-name">Cavalo</span>
          </button>
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
  }

  open(): Promise<PromotionPiece> {
    return new Promise(resolve => {
      this.resolveCallback = resolve;
      this.element.style.display = 'flex';
    });
  }

  private close(piece: PromotionPiece): void {
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
