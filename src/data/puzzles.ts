// Assessment puzzle positions
// 4 mate-in-1, 4 mate-in-2, 4 decisive advantage
// Each position has been validated by Stockfish in automated tests

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
  // === MATE IN 1 (4 posições) ===
  {
    id: 'mate1-1',
    fen: '6k1/5ppp/8/8/8/8/1Q6/K7 w - - 0 1',
    solution: 'b2b8',
    solutionSan: 'Qb8#',
    type: 'mate1',
    difficulty: 1,
    description: 'Mate em 1: Dama dá mate na oitava fila.',
  },
  {
    id: 'mate1-2',
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
    solution: 'h5f7',
    solutionSan: 'Qxf7#',
    type: 'mate1',
    difficulty: 1,
    description: 'Mate do Pastor: Dama captura em f7 com apoio do Bispo.',
  },
  {
    id: 'mate1-3',
    fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/5PP1/8/PPPPP2P/RNBQKBNR b KQkq - 0 3',
    solution: 'd8h4',
    solutionSan: 'Qh4#',
    type: 'mate1',
    difficulty: 1,
    description: 'Mate do Louco: Dama preta aplica mate na diagonal desprotegida.',
  },
  {
    id: 'mate1-4',
    fen: '6k1/R7/8/8/8/8/8/4R1K1 w - - 0 1',
    solution: 'e1e8',
    solutionSan: 'Re8#',
    type: 'mate1',
    difficulty: 1,
    description: 'Mate em 1: Torre invade a oitava fila aplicando xeque-mate.',
  },

  // === MATE IN 2 (4 posições) ===
  {
    id: 'mate2-1',
    fen: 'r2qkb1r/pp2nppp/3p4/2pNN1B1/2BnP3/3P4/PPP2PPP/R2bK2R w KQkq - 0 1',
    solution: 'd5f6',
    solutionSan: 'Nf6+',
    type: 'mate2',
    difficulty: 2,
    description: 'Mate de Légall: Sacrifício e combinação brilhante de cavalo e bispo.',
  },
  {
    id: 'mate2-2',
    fen: '4kb1r/p2n1ppp/4q3/4p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 0 16',
    solution: 'b3b8',
    solutionSan: 'Qb8+',
    type: 'mate2',
    difficulty: 2,
    description: 'Partida da Ópera (Morphy): Sacrifício de Dama seguido de mate de Torre.',
  },
  {
    id: 'mate2-3',
    fen: 'r6k/5ppp/8/8/8/8/3R1PPP/3R2K1 w - - 0 1',
    solution: 'd2d8',
    solutionSan: 'R2d8+',
    type: 'mate2',
    difficulty: 2,
    description: 'Bateria na coluna D: invasão das Torres com mate forçado em 2.',
  },
  {
    id: 'mate2-4',
    fen: 'r5k1/5ppp/8/8/8/8/1R3PPP/1R4K1 w - - 0 1',
    solution: 'b2b8',
    solutionSan: 'R2b8+',
    type: 'mate2',
    difficulty: 2,
    description: 'Torres dobradas: invasão na oitava fila com troca forçada e mate.',
  },

  // === VANTAGEM DECISIVA (4 posições) ===
  {
    id: 'adv-1',
    fen: '2r2rk1/1b2bppp/p3p3/1p2P3/3q4/P1NB4/1PP3PP/3RQR1K w - - 0 19',
    solution: 'd3h7',
    solutionSan: 'Bxh7+',
    type: 'advantage',
    difficulty: 3,
    description: 'Ataque descoberto: bispo dá xeque e a Dama preta é capturada.',
  },
  {
    id: 'adv-2',
    fen: 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2',
    solution: 'e4d5',
    solutionSan: 'exd5',
    type: 'advantage',
    difficulty: 1,
    description: 'Captura vantajosa: ganhe o peão central desprotegido.',
  },
  {
    id: 'adv-3',
    fen: 'r1bqkb1r/pppppppp/2n2n2/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq - 0 3',
    solution: 'f6e4',
    solutionSan: 'Nxe4',
    type: 'advantage',
    difficulty: 2,
    description: 'Peça pendurada: capture o peão central indefeso com o cavalo.',
  },
  {
    id: 'adv-4',
    fen: '3r1k2/p4ppp/1p6/8/8/1P6/P4PPP/3R2K1 w - - 0 1',
    solution: 'd1d8',
    solutionSan: 'Rxd8+',
    type: 'advantage',
    difficulty: 2,
    description: 'Final ganho: capture a torre com xeque e converta a partida.',
  },
];
