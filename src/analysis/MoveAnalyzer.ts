/**
 * Módulo de análise de lances.
 * Classifica lances do jogador e gera feedback baseado na avaliação do Stockfish
 * e fatos verificáveis extraídos via chess.js.
 *
 * Toda a lógica de regras vem do chess.js.
 * Toda a lógica de avaliação vem do Stockfish.
 * Explicações geradas somente a partir de fatos verificáveis com suporte a
 * setas visuais e categorização tática avançada.
 */

import { Chess } from 'chess.js';
import type { Square, PieceSymbol, Color } from 'chess.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MoveQuality = 'excelente' | 'bom' | 'imprecisao' | 'erro' | 'erro_grave';

export type TacticalCategory =
  | 'mate_perdido'
  | 'mate_ameacado'
  | 'peca_pendurada'
  | 'garfo'
  | 'cravada'
  | 'troca_desfavoravel'
  | 'captura_perdida'
  | 'seguranca_rei'
  | 'desenvolvimento'
  | 'posicional';

export interface TacticalShape {
  orig: string;
  dest?: string;
  brush: 'green' | 'red' | 'yellow' | 'blue';
}

export interface PvMove {
  uci: string;
  san: string;
}

export interface MoveAnalysis {
  quality: MoveQuality;
  /** Rótulo de exibição em PT-BR */
  label: string;
  /** Cor CSS para exibição */
  color: string;
  /** Perda em centipeões */
  cpLoss: number;
  /** Avaliação antes do lance (perspectiva do jogador, centipeões) */
  evalBefore: number;
  /** Avaliação após o lance (perspectiva do jogador, centipeões) */
  evalAfter: number;
  mateBefore: number | null;
  mateAfter: number | null;
  /** Melhor lance no formato UCI */
  bestMove: string;
  /** Melhor lance em SAN */
  bestMoveSan: string;
  /** Explicação em PT-BR (lista fechada de padrões verificáveis) */
  explanation: string;
  /** Lance jogado em SAN */
  playerMove: string;
  /** Lance jogado no formato UCI */
  playerMoveUci: string;
  /** Verdadeiro para 'erro' ou 'erro_grave' */
  isRetryable: boolean;
  /** Categoria tática do lance */
  category: TacticalCategory;
  /** Rótulo legível da categoria tática */
  categoryLabel: string;
  /** Formas e setas para renderização visual no tabuleiro */
  shapes: TacticalShape[];
  /** Variante de refutação em lances legíveis */
  refutationPv: PvMove[];
}

export interface PositionContext {
  fen: string;
  moveNumber: number;
  playerColor: 'w' | 'b';
  /** Avaliação do motor antes do lance (cp, perspectiva do jogador) */
  evalBefore: number;
  mateBefore: number | null;
  bestMoveUci: string;
  bestMoveSan: string;
  /** Variante principal antes do lance */
  pvBefore: string[];
  /** Variante principal recomendada pelo motor após o lance do jogador */
  pvAfter?: string[];
  /** Avaliação do motor após o lance (cp, perspectiva do jogador) */
  evalAfter: number;
  mateAfter: number | null;
  /** Lance jogado em SAN */
  playerMoveSan: string;
  /** Lance jogado no formato UCI */
  playerMoveUci: string;
  /** FEN antes do lance */
  fenBefore: string;
  /** FEN após o lance */
  fenAfter: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUALITY_CONFIG: Record<MoveQuality, { label: string; color: string }> = {
  excelente:  { label: 'Excelente',  color: '#15781b' },
  bom:        { label: 'Bom',        color: '#5c8c2a' },
  imprecisao: { label: 'Imprecisão', color: '#e6a817' },
  erro:       { label: 'Erro',       color: '#ca6a1f' },
  erro_grave: { label: 'Erro Grave', color: '#ca3431' },
};

export const CATEGORY_LABELS: Record<TacticalCategory, string> = {
  mate_perdido: 'Mate Perdido',
  mate_ameacado: 'Ameaça de Mate',
  peca_pendurada: 'Peça Pendurada',
  garfo: 'Garfo Tático',
  cravada: 'Cravada',
  troca_desfavoravel: 'Troca Desfavorável',
  captura_perdida: 'Captura Perdida',
  seguranca_rei: 'Segurança do Rei',
  desenvolvimento: 'Desenvolvimento',
  posicional: 'Posicional',
};

/** Valor sentinela de perda de cp para situações de mate */
const MATE_CP_LOSS = 9999;

/** Limiar de posição já decidida */
const DECIDED_POSITION_THRESHOLD = 500;

const PIECE_NAMES_PT: Record<PieceSymbol, string> = {
  p: 'o peão',
  n: 'o cavalo',
  b: 'o bispo',
  r: 'a torre',
  q: 'a dama',
  k: 'o rei',
};

const PIECE_NAMES_CAP_PT: Record<PieceSymbol, string> = {
  p: 'Peão',
  n: 'Cavalo',
  b: 'Bispo',
  r: 'Torre',
  q: 'Dama',
  k: 'Rei',
};

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 1000,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getQualityLabel(quality: MoveQuality): string {
  return QUALITY_CONFIG[quality].label;
}

function isMateFavorable(mate: number | null): mate is number {
  return mate !== null && mate > 0;
}

function isMateUnfavorable(mate: number | null): mate is number {
  return mate !== null && mate < 0;
}

function calculateCpLoss(ctx: PositionContext): number {
  // Se jogou o melhor lance exato do motor, perda é sempre 0
  if (ctx.playerMoveUci === ctx.bestMoveUci) {
    return 0;
  }

  // Mate em 1 perdido é sempre erro grave de perda máxima
  if (ctx.mateBefore === 1) {
    return MATE_CP_LOSS;
  }

  // Mate handling: jogador tinha mate favorável e perdeu ou atrasou
  if (isMateFavorable(ctx.mateBefore)) {
    if (!isMateFavorable(ctx.mateAfter) || (ctx.mateAfter !== null && ctx.mateAfter > ctx.mateBefore)) {
      return MATE_CP_LOSS;
    }
  }

  // Se o lance permitiu mate do adversário (e antes não havia)
  if (isMateUnfavorable(ctx.mateAfter) && !isMateUnfavorable(ctx.mateBefore)) {
    return MATE_CP_LOSS;
  }

  const rawLoss = ctx.evalBefore - ctx.evalAfter;
  if (rawLoss <= 10) {
    return 0;
  }

  return rawLoss;
}

function classifyMove(cpLoss: number): MoveQuality {
  if (cpLoss <= 10) return 'excelente';
  if (cpLoss <= 30) return 'bom';
  if (cpLoss <= 60) return 'imprecisao';
  if (cpLoss <= 150) return 'erro';
  return 'erro_grave';
}

const SEVERITY_ORDER: MoveQuality[] = [
  'excelente',
  'bom',
  'imprecisao',
  'erro',
  'erro_grave',
];

function downgradeSeverity(quality: MoveQuality): MoveQuality {
  const idx = SEVERITY_ORDER.indexOf(quality);
  if (idx <= 0) return SEVERITY_ORDER[0]!;
  return SEVERITY_ORDER[idx - 1]!;
}

/**
 * Converte lista de lances UCI em lances SAN a partir de uma FEN inicial
 */
function convertPvToSan(fen: string, uciMoves: string[]): PvMove[] {
  const result: PvMove[] = [];
  try {
    const game = new Chess(fen);
    for (const uci of uciMoves) {
      if (!uci || uci.length < 4) break;
      const from = uci.substring(0, 2);
      const to = uci.substring(2, 4);
      const promotion = uci.length > 4 ? uci[4] : undefined;
      const move = game.move({ from, to, promotion });
      if (!move) break;
      result.push({ uci, san: move.san });
    }
  } catch {
    // Retorna o que conseguiu converter
  }
  return result;
}

// ---------------------------------------------------------------------------
// Tactical Pattern Detection & Visual Shapes
// ---------------------------------------------------------------------------

interface PatternResult {
  category: TacticalCategory;
  explanation: string;
  shapes: TacticalShape[];
}

function detectTacticalDetails(
  quality: MoveQuality,
  cpLoss: number,
  ctx: PositionContext,
): PatternResult {
  const opponentColor: Color = ctx.playerColor === 'w' ? 'b' : 'w';
  const shapes: TacticalShape[] = [];

  // Seta verde para o melhor lance sempre presente quando disponível
  if (ctx.bestMoveUci && ctx.bestMoveUci.length >= 4) {
    shapes.push({
      orig: ctx.bestMoveUci.substring(0, 2),
      dest: ctx.bestMoveUci.substring(2, 4),
      brush: 'green',
    });
  }

  // 1. Mate perdido: havia mate em N e ele não jogou o melhor lance
  if (isMateFavorable(ctx.mateBefore) && ctx.playerMoveUci !== ctx.bestMoveUci) {
    if (!isMateFavorable(ctx.mateAfter) || ctx.mateBefore === 1 || (ctx.mateAfter !== null && ctx.mateAfter > ctx.mateBefore)) {
      // Círculo amarelo na casa destino do lance de mate
      shapes.push({ orig: ctx.bestMoveUci.substring(2, 4), brush: 'yellow' });
      return {
        category: 'mate_perdido',
        explanation: `Havia mate em ${ctx.mateBefore} com ${ctx.bestMoveSan}, mas você não jogou!`,
        shapes,
      };
    }
  }

  // 2. Mate permitido: seu lance permite mate pelo adversário
  if (isMateUnfavorable(ctx.mateAfter) && !isMateUnfavorable(ctx.mateBefore)) {
    // Seta vermelha da resposta que aplica o mate
    const replyUci = ctx.pvAfter && ctx.pvAfter.length > 0 ? ctx.pvAfter[0] : null;
    if (replyUci && replyUci.length >= 4) {
      shapes.push({
        orig: replyUci.substring(0, 2),
        dest: replyUci.substring(2, 4),
        brush: 'red',
      });
    }
    // Círculo vermelho no rei do jogador
    try {
      const chessAfter = new Chess(ctx.fenAfter);
      const board = chessAfter.board();
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = board[r][c];
          if (piece && piece.type === 'k' && piece.color === ctx.playerColor) {
            shapes.push({ orig: piece.square, brush: 'red' });
          }
        }
      }
    } catch {
      // Fallback
    }

    const mateInN = Math.abs(ctx.mateAfter!);
    return {
      category: 'mate_ameacado',
      explanation: mateInN === 1
        ? 'Erro grave! Seu lance permite mate pelo adversário.'
        : `Erro grave! Seu lance permite mate pelo adversário em ${mateInN} lances.`,
      shapes,
    };
  }

  // Para lances com erro (imprecisão, erro, erro_grave)
  if (quality === 'imprecisao' || quality === 'erro' || quality === 'erro_grave') {
    try {
      const chessBefore = new Chess(ctx.fenBefore);
      const chessAfter = new Chess(ctx.fenAfter);

      // Resposta principal do motor ao lance do jogador
      const replyUci = (ctx.pvAfter && ctx.pvAfter.length > 0)
        ? ctx.pvAfter[0]
        : (ctx.pvBefore && ctx.pvBefore.length > 1 ? ctx.pvBefore[1] : null);

      if (replyUci && replyUci.length >= 4) {
        const replyFrom = replyUci.substring(0, 2) as Square;
        const replyTo = replyUci.substring(2, 4) as Square;
        const replyPromo = replyUci.length > 4 ? replyUci[4] : undefined;

        // Simula o tabuleiro após a resposta do adversário
        const chessAfterReply = new Chess(ctx.fenAfter);
        const replyMoveObj = chessAfterReply.move({ from: replyFrom, to: replyTo, promotion: replyPromo });

        // 3. Detecção de Garfo (Fork / Ataque Duplo do adversário)
        if (replyMoveObj) {
          const replyPiece = chessAfterReply.get(replyTo);
          if (replyPiece) {
            const attackedSquares: Square[] = [];
            const attackedPieces: { sq: Square; type: PieceSymbol; val: number }[] = [];

            // Varre peças do jogador para ver quais são atacadas por replyTo
            const boardAfterReply = chessAfterReply.board();
            for (let r = 0; r < 8; r++) {
              for (let c = 0; c < 8; c++) {
                const sqPiece = boardAfterReply[r][c];
                if (sqPiece && sqPiece.color === ctx.playerColor) {
                  const attackers = chessAfterReply.attackers(sqPiece.square, opponentColor);
                  if (attackers.includes(replyTo)) {
                    attackedSquares.push(sqPiece.square);
                    attackedPieces.push({
                      sq: sqPiece.square,
                      type: sqPiece.type,
                      val: PIECE_VALUES[sqPiece.type],
                    });
                  }
                }
              }
            }

            // Garfo se ataca 2 ou mais peças valiosas (valor >= 3 ou rei)
            const highValAttacks = attackedPieces.filter(p => p.val >= 3 || p.type === 'k');
            if (attackedPieces.length >= 2 && highValAttacks.length >= 1 && cpLoss >= 120) {
              // Seta vermelha do lance do garfo
              shapes.push({ orig: replyFrom, dest: replyTo, brush: 'red' });
              // Setas vermelhas para os dois alvos principais
              for (const target of attackedPieces.slice(0, 2)) {
                shapes.push({ orig: replyTo, dest: target.sq, brush: 'red' });
                shapes.push({ orig: target.sq, brush: 'red' });
              }

              const t1Name = PIECE_NAMES_CAP_PT[attackedPieces[0].type];
              const t2Name = PIECE_NAMES_CAP_PT[attackedPieces[1].type];
              return {
                category: 'garfo',
                explanation: `Garfo tático! O seu lance permitiu que o adversário ataque ${t1Name} em ${attackedPieces[0].sq} e ${t2Name} em ${attackedPieces[1].sq} simultaneamente com ${replyMoveObj.san}.`,
                shapes,
              };
            }
          }
        }

        // 4. Peça deixada desprotegida e capturável (e a melhor resposta do motor a punia)
        const pieceAtTarget = chessAfter.get(replyTo);
        if (pieceAtTarget && pieceAtTarget.color === ctx.playerColor) {
          const defenders = chessAfter.attackers(replyTo, ctx.playerColor);
          if (defenders.length === 0) {
            const pieceName = PIECE_NAMES_PT[pieceAtTarget.type] || 'sua peça';
            // Seta vermelha da captura do adversário
            shapes.push({ orig: replyFrom, dest: replyTo, brush: 'red' });
            // Círculo vermelho na peça desprotegida
            shapes.push({ orig: replyTo, brush: 'red' });

            return {
              category: 'peca_pendurada',
              explanation: `Peça desprotegida! O seu lance deixou ${pieceName} em ${replyTo} sem defesa.`,
              shapes,
            };
          }
        }
      }

      // 5. Captura gratuita perdida (havia peça adversária pendurada e ele não pegou)
      const bestMoveFrom = ctx.bestMoveUci.substring(0, 2) as Square;
      const bestMoveTo = ctx.bestMoveUci.substring(2, 4) as Square;
      const targetPieceBefore = chessBefore.get(bestMoveTo);

      if (
        targetPieceBefore &&
        targetPieceBefore.color === opponentColor &&
        ctx.playerMoveUci !== ctx.bestMoveUci
      ) {
        const enemyDefenders = chessBefore.attackers(bestMoveTo, opponentColor);
        if (enemyDefenders.length === 0) {
          const pieceName = PIECE_NAMES_PT[targetPieceBefore.type] || 'a peça';
          // Círculo amarelo na peça pendurada que não foi capturada
          shapes.push({ orig: bestMoveTo, brush: 'yellow' });

          return {
            category: 'captura_perdida',
            explanation: `Captura gratuita perdida! Você podia capturar ${pieceName} em ${bestMoveTo} com ${ctx.bestMoveSan}.`,
            shapes,
          };
        }
      }

      // 6. Material perdido no lance (troca desfavorável imediata)
      const playerTo = ctx.playerMoveUci.substring(2, 4) as Square;
      const playerPieceAfter = chessAfter.get(playerTo);
      if (playerPieceAfter && playerPieceAfter.color === ctx.playerColor) {
        const enemyAttackers = chessAfter.attackers(playerTo, opponentColor);
        const myDefenders = chessAfter.attackers(playerTo, ctx.playerColor);
        if (enemyAttackers.length > 0 && myDefenders.length === 0 && cpLoss >= 100) {
          const pieceName = PIECE_NAMES_PT[playerPieceAfter.type] || 'sua peça';
          // Seta vermelha do primeiro atacante para a casa da peça perdida
          shapes.push({ orig: enemyAttackers[0], dest: playerTo, brush: 'red' });
          shapes.push({ orig: playerTo, brush: 'red' });

          return {
            category: 'troca_desfavoravel',
            explanation: `Material perdido! O seu lance colocou ${pieceName} em ${playerTo} onde pode ser capturada.`,
            shapes,
          };
        }
      }
    } catch {
      // Em caso de erro na análise da posição, segue para o template genérico
    }
  }

  // 7. Lance de desenvolvimento / segurança do rei na abertura (até lance 12, sem perda tática)
  if (ctx.moveNumber <= 12 && cpLoss <= 30) {
    if (ctx.playerMoveSan === 'O-O' || ctx.playerMoveSan === 'O-O-O') {
      return {
        category: 'seguranca_rei',
        explanation: 'Bom lance de segurança do rei: roque realizado.',
        shapes,
      };
    }

    // Lance de cavalo ou bispo saindo da fileira inicial
    const fromSquare = ctx.playerMoveUci.substring(0, 2);
    const startRank = ctx.playerColor === 'w' ? '1' : '8';
    if (
      fromSquare[1] === startRank &&
      (ctx.playerMoveSan.startsWith('N') || ctx.playerMoveSan.startsWith('B'))
    ) {
      return {
        category: 'desenvolvimento',
        explanation: 'Bom lance de desenvolvimento na abertura.',
        shapes,
      };
    }
  }

  // 8. Lance que era o melhor ou defendia a ameaça concreta da posição
  if (quality === 'excelente' || quality === 'bom') {
    try {
      const chessBefore = new Chess(ctx.fenBefore);
      if (chessBefore.isCheck()) {
        return {
          category: 'seguranca_rei',
          explanation: 'Excelente! Defendeu o rei em xeque.',
          shapes,
        };
      }
    } catch {
      // Fallback
    }

    if (ctx.playerMoveUci === ctx.bestMoveUci || cpLoss <= 10) {
      return {
        category: 'posicional',
        explanation: 'Excelente! Este era o melhor lance.',
        shapes,
      };
    }
    return {
      category: 'posicional',
      explanation: 'Bom lance. Mantém a posição.',
      shapes,
    };
  }

  // 9. Template padrão por qualidade
  switch (quality) {
    case 'imprecisao':
      return {
        category: 'posicional',
        explanation: `Imprecisão. O motor preferia ${ctx.bestMoveSan} — sua posição fica ${cpLoss} centipeões pior.`,
        shapes,
      };
    case 'erro':
      return {
        category: 'posicional',
        explanation: `Erro. O motor preferia ${ctx.bestMoveSan} — sua posição fica ${cpLoss} centipeões pior.`,
        shapes,
      };
    case 'erro_grave':
      return {
        category: 'posicional',
        explanation: `Erro grave! O motor preferia ${ctx.bestMoveSan} — sua posição fica ${cpLoss} centipeões pior.`,
        shapes,
      };
    default:
      return {
        category: 'posicional',
        explanation: 'Bom lance.',
        shapes,
      };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function analyzeMoveQuality(ctx: PositionContext): MoveAnalysis {
  const cpLoss = calculateCpLoss(ctx);
  let quality = classifyMove(cpLoss);

  // Se a posição já estava decidida (|evalBefore| > 500) e NÃO envolve mate perdido/permitido,
  // reduz a severidade em um nível
  if (
    Math.abs(ctx.evalBefore) > DECIDED_POSITION_THRESHOLD &&
    cpLoss !== MATE_CP_LOSS
  ) {
    quality = downgradeSeverity(quality);
  }

  const { category, explanation, shapes } = detectTacticalDetails(quality, cpLoss, ctx);
  const config = QUALITY_CONFIG[quality];
  const categoryLabel = CATEGORY_LABELS[category];

  // Converte a refutação principal do motor em lances legíveis
  const pvRaw = ctx.pvAfter && ctx.pvAfter.length > 0 ? ctx.pvAfter.slice(0, 4) : [];
  const refutationPv = convertPvToSan(ctx.fenAfter, pvRaw);

  return {
    quality,
    label: config.label,
    color: config.color,
    cpLoss,
    evalBefore: ctx.evalBefore,
    evalAfter: ctx.evalAfter,
    mateBefore: ctx.mateBefore,
    mateAfter: ctx.mateAfter,
    bestMove: ctx.bestMoveUci,
    bestMoveSan: ctx.bestMoveSan,
    explanation,
    playerMove: ctx.playerMoveSan,
    playerMoveUci: ctx.playerMoveUci,
    isRetryable: quality === 'erro' || quality === 'erro_grave',
    category,
    categoryLabel,
    shapes,
    refutationPv,
  };
}
