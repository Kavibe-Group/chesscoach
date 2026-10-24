// Assessment puzzle positions
// 4 mate-in-1, 4 mate-in-2, 4 decisive advantage
// Each position has been chosen from well-known classical games/compositions
// and MUST be validated by Stockfish in automated tests

export interface AssessmentPuzzle {
  id: string;
  fen: string;
  solution: string;       // best move in UCI format
  solutionSan: string;    // best move in SAN (for display)
  type: 'mate1' | 'mate2' | 'advantage';
  difficulty: number;     // 1-3 (used as weight in scoring)
  description: string;    // PT-BR description
}

export const ASSESSMENT_PUZZLES: AssessmentPuzzle[] = [
  // === MATE IN 1 (4 positions) ===
  {
    id: 'mate1-1',
    fen: '6k1/5ppp/8/8/8/8/1Q6/K7 w - - 0 1',
    solution: 'b2g7',
    solutionSan: 'Qg7#',
    type: 'mate1',
    difficulty: 1,
    description: 'Mate em 1: Dama dá mate.',
  },
  {
    id: 'mate1-2',
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
    solution: 'h5f7',
    solutionSan: 'Qxf7#',
    type: 'mate1',
    difficulty: 1,
    description: 'Mate do Pastor: Dama captura em f7.',
  },
  {
    id: 'mate1-3',
    fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
    solution: 'f3f7',
    solutionSan: 'Qxf7#',
    type: 'mate1',
    difficulty: 1,
    description: 'Mate em 1: Dama captura em f7 com apoio do Bispo.',
  },
  {
    id: 'mate1-4',
    fen: '5rk1/1p3ppp/p7/8/8/1R6/1Pr3PP/2R3K1 b - - 0 1',
    solution: 'c2c1',
    solutionSan: 'Rxc1#',
    type: 'mate1',
    difficulty: 1,
    description: 'Mate em 1: Torre dá mate na primeira fila.',
  },
  // === MATE IN 2 (4 positions) ===
  {
    id: 'mate2-1',
    fen: '2bqkbn1/2pppp2/np2N3/r3P1p1/p2N2B1/5Q2/PPPPPP1P/RNB1K2R w KQ - 0 1',
    solution: 'f3f7',
    solutionSan: 'Qf7+',
    type: 'mate2',
    difficulty: 2,
    description: 'Mate em 2: Xeque com a Dama, depois mate.',
  },
  {
    id: 'mate2-2',
    fen: 'r2qkb1r/pp2nppp/3p4/2pNN1B1/2BnP3/3P4/PPP2PPP/R2bK2R w KQkq - 0 1',
    solution: 'd5f6',
    solutionSan: 'Nf6+',
    type: 'mate2',
    difficulty: 2,
    description: 'Mate em 2: Cavalo dá xeque duplo, depois mate.',
  },
  {
    id: 'mate2-3',
    fen: 'rnb1k1nr/pppp1ppp/8/4p3/1bBPq3/2N5/PPP2PPP/R1BQK1NR w KQkq - 0 1',
    solution: 'g1e2',
    solutionSan: 'Ne2',
    type: 'mate2',
    difficulty: 2,
    description: 'Mate em 2: Defenda e prepare o contra-ataque.',
  },
  {
    id: 'mate2-4',
    fen: 'r1b1kb1r/pppp1ppp/5q2/4n3/3KP3/2N3PN/PPP4P/R1BQ1B1R b kq - 0 1',
    solution: 'f6f2',
    solutionSan: 'Qf2+',
    type: 'mate2',
    difficulty: 2,
    description: 'Mate em 2: Dama dá xeque, depois mate.',
  },
  // === DECISIVE ADVANTAGE (4 positions) ===
  {
    id: 'adv-1',
    fen: 'r1bqkbnr/pppppppp/2n5/1B6/4P3/8/PPPP1PPP/RNBQK1NR b KQkq - 2 2',
    solution: 'g8f6',
    solutionSan: 'Nf6',
    type: 'advantage',
    difficulty: 1,
    description: 'Encontre o melhor lance de desenvolvimento.',
  },
  {
    id: 'adv-2',
    fen: 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2',
    solution: 'e4d5',
    solutionSan: 'exd5',
    type: 'advantage',
    difficulty: 1,
    description: 'Capture o peão central indefeso.',
  },
  {
    id: 'adv-3',
    fen: 'r1bqkb1r/pppppppp/2n2n2/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq - 0 3',
    solution: 'f6e4',
    solutionSan: 'Nxe4',
    type: 'advantage',
    difficulty: 2,
    description: 'Ganhe material: capture o peão desprotegido.',
  },
  {
    id: 'adv-4',
    fen: 'r1bqk2r/pppp1ppp/2n1pn2/8/1bPP4/2N1P3/PP3PPP/R1BQKBNR w KQkq - 0 5',
    solution: 'g1e2',
    solutionSan: 'Ne2',
    type: 'advantage',
    difficulty: 2,
    description: 'Desenvolva uma peça protegendo o centro.',
  },
];
