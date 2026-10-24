import { describe, it, expect } from 'vitest';
import { analyzeMoveQuality } from './MoveAnalyzer';
import type { PositionContext } from './MoveAnalyzer';

describe('MoveAnalyzer (Fase 2 - Feedback pós-lance e Padrões)', () => {
  it('classifica o melhor lance como excelente', () => {
    const ctx: PositionContext = {
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      moveNumber: 1,
      playerColor: 'w',
      evalBefore: 20,
      mateBefore: null,
      bestMoveUci: 'e2e4',
      bestMoveSan: 'e4',
      pvBefore: ['e2e4', 'e7e5'],
      evalAfter: 20,
      mateAfter: null,
      playerMoveSan: 'e4',
      playerMoveUci: 'e2e4',
      fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      fenAfter: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
    };

    const analysis = analyzeMoveQuality(ctx);
    expect(analysis.quality).toBe('excelente');
    expect(analysis.label).toBe('Excelente');
    expect(analysis.cpLoss).toBe(0);
    expect(analysis.isRetryable).toBe(false);
    expect(analysis.explanation).toContain('melhor lance');
  });

  it('classifica desenvolvimento de cavalo na abertura', () => {
    const ctx: PositionContext = {
      fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      moveNumber: 2,
      playerColor: 'b',
      evalBefore: -20,
      mateBefore: null,
      bestMoveUci: 'b8c6',
      bestMoveSan: 'Nc6',
      pvBefore: ['b8c6', 'd2d4'],
      evalAfter: -35,
      mateAfter: null,
      playerMoveSan: 'Nc6',
      playerMoveUci: 'b8c6',
      fenBefore: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      fenAfter: 'r1bqkbnr/pppppppp/2n5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 2',
    };

    const analysis = analyzeMoveQuality(ctx);
    expect(analysis.quality).toBe('excelente');
    expect(analysis.explanation).toContain('desenvolvimento');
  });

  it('classifica roque na abertura como lance de segurança do rei', () => {
    const ctx: PositionContext = {
      fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
      moveNumber: 4,
      playerColor: 'w',
      evalBefore: 30,
      mateBefore: null,
      bestMoveUci: 'e1g1',
      bestMoveSan: 'O-O',
      pvBefore: ['e1g1', 'd7d6'],
      evalAfter: 20,
      mateAfter: null,
      playerMoveSan: 'O-O',
      playerMoveUci: 'e1g1',
      fenBefore: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
      fenAfter: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 5 4',
    };

    const analysis = analyzeMoveQuality(ctx);
    expect(analysis.quality).toBe('excelente');
    expect(analysis.explanation).toContain('segurança do rei');
  });

  it('classifica pendurar a dama como erro grave e permite tentar de novo', () => {
    // Brancas jogam Dama em casa atacada por peão sem defesa
    const ctx: PositionContext = {
      fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
      moveNumber: 3,
      playerColor: 'w',
      evalBefore: 30,
      mateBefore: null,
      bestMoveUci: 'f1c4',
      bestMoveSan: 'Bc4',
      pvBefore: ['f1c4', 'g8f6'],
      evalAfter: -850, // Perdeu a dama!
      mateAfter: null,
      playerMoveSan: 'Qe2', // Ou moveu dama para f7 pendurada
      playerMoveUci: 'd1d7', // Pendurou dama em d7
      fenBefore: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
      fenAfter: 'r1bQkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNB1KB1R b KQkq - 0 3',
    };

    const analysis = analyzeMoveQuality(ctx);
    expect(analysis.quality).toBe('erro_grave');
    expect(analysis.label).toBe('Erro Grave');
    expect(analysis.cpLoss).toBeGreaterThan(150);
    expect(analysis.isRetryable).toBe(true);
  });

  it('detecta mate perdido como erro grave com mensagem específica', () => {
    // Jogador tinha mate em 1 e não jogou
    const ctx: PositionContext = {
      fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
      moveNumber: 4,
      playerColor: 'w',
      evalBefore: 100000,
      mateBefore: 1, // Mate em 1!
      bestMoveUci: 'h5f7',
      bestMoveSan: 'Qxf7#',
      pvBefore: ['h5f7'],
      evalAfter: 50, // Jogou outro lance qualquer
      mateAfter: null, // Perdeu o mate
      playerMoveSan: 'Qe2',
      playerMoveUci: 'h5e2',
      fenBefore: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
      fenAfter: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/8/PPPPQPPP/RNB1K1NR b KQkq - 5 4',
    };

    const analysis = analyzeMoveQuality(ctx);
    expect(analysis.quality).toBe('erro_grave');
    expect(analysis.cpLoss).toBe(9999);
    expect(analysis.isRetryable).toBe(true);
    expect(analysis.explanation).toContain('Havia mate em 1');
  });

  it('detecta mate permitido pelo adversário', () => {
    const ctx: PositionContext = {
      fen: 'r1bqkb1r/pppp1ppp/2n5/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 0 3',
      moveNumber: 3,
      playerColor: 'w',
      evalBefore: 0,
      mateBefore: null,
      bestMoveUci: 'g1f3',
      bestMoveSan: 'Nf3',
      pvBefore: ['g1f3'],
      evalAfter: -100000,
      mateAfter: -1, // Adversário tem mate em 1 agora
      playerMoveSan: 'f3',
      playerMoveUci: 'f2f3',
      fenBefore: 'r1bqkb1r/pppp1ppp/2n5/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 0 3',
      fenAfter: 'r1bqkb1r/pppp1ppp/2n5/4p3/2B1P3/5P2/PPPP2PP/RNBQK1NR b KQkq - 0 3',
    };

    const analysis = analyzeMoveQuality(ctx);
    expect(analysis.quality).toBe('erro_grave');
    expect(analysis.explanation).toContain('permite mate pelo adversário');
  });

  it('rebaixa a severidade em posições já decididas (|eval| > 500)', () => {
    // Posição com +900 de vantagem: erro de 80 cp vira imprecisão em vez de erro
    const ctx: PositionContext = {
      fen: '4k3/8/8/8/8/8/4Q3/4K3 w - - 0 1',
      moveNumber: 25,
      playerColor: 'w',
      evalBefore: 900,
      mateBefore: null,
      bestMoveUci: 'e2e5',
      bestMoveSan: 'Qe5',
      pvBefore: ['e2e5'],
      evalAfter: 820, // Perdeu 80cp (normalmente seria 'erro')
      mateAfter: null,
      playerMoveSan: 'Qe3',
      playerMoveUci: 'e2e3',
      fenBefore: '4k3/8/8/8/8/8/4Q3/4K3 w - - 0 1',
      fenAfter: '4k3/8/8/8/8/4Q3/8/4K3 b - - 1 1',
    };

    const analysis = analyzeMoveQuality(ctx);
    // Erro (61-150) rebaixado em 1 nível vira imprecisão
    expect(analysis.quality).toBe('imprecisao');
  });

  it('BUG-04: detecta peça desprotegida punível usando pvAfter[0] em vez de pvBefore[1]', () => {
    // Brancas têm cavalo em e4 atacado pelo peão preto em d5.
    // Melhor lance: e4f6 (pvBefore: ['e4f6', 'e8f7']). pvBefore[1] é e8f7 (lance de rei).
    // Jogador joga a2a3, deixando o cavalo em e4 sem defesa.
    // A resposta do motor ao lance a2a3 é d5e4 (captura o cavalo em e4).
    const ctx: PositionContext = {
      fen: '4k3/8/8/3p4/4N3/P7/8/4K3 b - - 0 1',
      moveNumber: 10,
      playerColor: 'w',
      evalBefore: 0,
      mateBefore: null,
      bestMoveUci: 'e4f6',
      bestMoveSan: 'Nf6+',
      pvBefore: ['e4f6', 'e8f7'],
      pvAfter: ['d5e4'],
      evalAfter: -350,
      mateAfter: null,
      playerMoveSan: 'a3',
      playerMoveUci: 'a2a3',
      fenBefore: '4k3/8/8/3p4/4N3/8/P7/4K3 w - - 0 1',
      fenAfter: '4k3/8/8/3p4/4N3/P7/8/4K3 b - - 0 1',
    };

    const analysis = analyzeMoveQuality(ctx);
    expect(analysis.quality).toBe('erro_grave');
    expect(analysis.explanation).toContain('Peça desprotegida');
    expect(analysis.explanation).toContain('cavalo em e4 sem defesa');
  });

  it('BUG-05: classifica perda de mate em 1 como erro grave mesmo se a posição mantiver mate em 4', () => {
    const ctx: PositionContext = {
      fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
      moveNumber: 4,
      playerColor: 'w',
      evalBefore: 100000,
      mateBefore: 1, // Mate em 1 disponível (Qxf7#)
      bestMoveUci: 'h5f7',
      bestMoveSan: 'Qxf7#',
      pvBefore: ['h5f7'],
      evalAfter: 100000,
      mateAfter: 4, // Lance jogado mantém mate em 4, mas perdeu o mate imediato!
      playerMoveSan: 'Qe2',
      playerMoveUci: 'h5e2',
      fenBefore: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
      fenAfter: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/8/PPPPQPPP/RNB1K1NR b KQkq - 5 4',
    };

    const analysis = analyzeMoveQuality(ctx);
    expect(analysis.quality).toBe('erro_grave');
    expect(analysis.label).toBe('Erro Grave');
    expect(analysis.cpLoss).toBe(9999);
    expect(analysis.isRetryable).toBe(true);
    expect(analysis.explanation).toContain('Havia mate em 1 com Qxf7#');
  });
});
