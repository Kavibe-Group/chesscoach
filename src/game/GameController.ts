import { Chess, Move } from 'chess.js';
import type { Square, Color } from 'chess.js';

/**
 * Controlador de jogo de xadrez.
 * Encapsula a biblioteca chess.js e fornece gerenciamento de estado do jogo
 * para o aplicativo de coach de xadrez.
 *
 * Toda a lógica de regras vem do chess.js — nenhuma regra personalizada é implementada.
 */
export class GameController {
  private chess: Chess;

  constructor(fen?: string) {
    this.chess = new Chess();
    if (fen) {
      this.loadFen(fen);
    }
  }

  /**
   * Inicia um novo jogo, opcionalmente a partir de uma posição FEN.
   */
  newGame(fen?: string): void {
    this.chess = new Chess();
    if (fen) {
      this.loadFen(fen);
    }
  }

  /**
   * Alias para `newGame()` — reinicia o jogo para a posição inicial.
   */
  reset(): void {
    this.newGame();
  }

  /**
   * Realiza um lance. Retorna o objeto Move se o lance for legal, ou null caso contrário.
   * chess.js 1.4.0 lança exceção em lances ilegais, então capturamos o erro.
   */
  makeMove(from: string, to: string, promotion?: string): Move | null {
    try {
      const moveObj: { from: string; to: string; promotion?: string } = { from, to };
      if (promotion) {
        moveObj.promotion = promotion;
      }
      return this.chess.move(moveObj);
    } catch {
      return null;
    }
  }

  /**
   * Desfaz o último lance. Retorna o lance desfeito ou null se não houver lance para desfazer.
   */
  undoMove(): Move | null {
    return this.chess.undo();
  }

  /**
   * Retorna a string FEN da posição atual.
   */
  getFen(): string {
    return this.chess.fen();
  }

  /**
   * Retorna a string PGN do jogo atual.
   */
  getPgn(): string {
    return this.chess.pgn();
  }

  /**
   * Verifica se o jogo terminou (xeque-mate, afogamento, empate).
   */
  isGameOver(): boolean {
    return this.chess.isGameOver();
  }

  /**
   * Verifica se a posição atual é xeque-mate.
   */
  isCheckmate(): boolean {
    return this.chess.isCheckmate();
  }

  /**
   * Verifica se a posição atual é afogamento (stalemate).
   */
  isStalemate(): boolean {
    return this.chess.isStalemate();
  }

  /**
   * Verifica se a posição atual é empate.
   * Cobre material insuficiente, regra dos 50 lances e repetição tripla.
   */
  isDraw(): boolean {
    return this.chess.isDraw();
  }

  /**
   * Verifica se ocorreu empate por repetição tripla da posição.
   */
  isThreefoldRepetition(): boolean {
    return this.chess.isThreefoldRepetition();
  }

  /**
   * Verifica se ocorreu empate pela regra dos 50 lances sem capturas ou movimentos de peão.
   */
  isDrawByFiftyMoves(): boolean {
    return this.chess.isDrawByFiftyMoves();
  }

  /**
   * Verifica se ocorreu empate por insuficiência de material.
   */
  isInsufficientMaterial(): boolean {
    return this.chess.isInsufficientMaterial();
  }

  /**
   * Verifica se o rei do lado que deve jogar está em xeque.
   */
  isCheck(): boolean {
    return this.chess.isCheck();
  }

  /**
   * Retorna de quem é a vez de jogar ('w' para brancas, 'b' para pretas).
   */
  turn(): Color {
    return this.chess.turn();
  }

  /**
   * Retorna todos os lances legais na posição atual com informações detalhadas.
   */
  getLegalMoves(): Move[] {
    return this.chess.moves({ verbose: true });
  }

  /**
   * Retorna os lances legais a partir de uma casa específica.
   */
  getLegalMovesForSquare(square: Square): Move[] {
    return this.chess.moves({ square, verbose: true });
  }

  /**
   * Retorna o histórico de lances com informações detalhadas.
   */
  getHistory(): Move[] {
    return this.chess.history({ verbose: true });
  }

  /**
   * Carrega uma posição a partir de uma string FEN.
   * Retorna true se a FEN for válida e carregada com sucesso; false se for inválida.
   */
  loadFen(fen: string): boolean {
    try {
      this.chess.load(fen);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Retorna o número do lance atual.
   */
  moveNumber(): number {
    return this.chess.moveNumber();
  }

  /**
   * Retorna o resultado do jogo se terminado ('1-0', '0-1', '1/2-1/2') ou null.
   */
  getGameResult(): string | null {
    if (!this.chess.isGameOver()) {
      return null;
    }

    if (this.chess.isCheckmate()) {
      // Se é xeque-mate, o lado que deve jogar perdeu.
      return this.chess.turn() === 'w' ? '0-1' : '1-0';
    }

    // Afogamento, material insuficiente, 50 lances ou repetição tripla → empate.
    return '1/2-1/2';
  }

  /**
   * Proxy para chess.board() — retorna a representação do tabuleiro.
   */
  board() {
    return this.chess.board();
  }

  /**
   * Proxy para chess.get(square) — retorna a peça na casa especificada.
   */
  get(square: Square) {
    return this.chess.get(square);
  }
}
