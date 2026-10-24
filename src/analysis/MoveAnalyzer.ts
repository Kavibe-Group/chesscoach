/**
 * Módulo de análise de lances.
 * Classifica lances do jogador e gera feedback baseado na avaliação do Stockfish
 * e fatos verificáveis extraídos via chess.js.
 *
 * Toda a lógica de regras vem do chess.js.
 * Toda a lógica de avaliação vem do Stockfish.
 * Explicações geradas somente a partir de fatos verificáveis (lista fechada).
 */

import { Chess } from 'chess.js';
import type { Square, PieceSymbol } from 'chess.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MoveQuality = 'excelente' | 'bom' | 'imprecisao' | 'erro' | 'erro_grave';

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getQualityLabel(quality: MoveQuality): string {
  return QUALITY_CONFIG[quality].label;
}

function isMateFavorable(mate: number | null): boolean {
  return mate !== null && mate > 0;
}

function isMateUnfavorable(mate: number | null): boolean {
  return mate !== null && mate < 0;
}

function calculateCpLoss(ctx: PositionContext): number {
  // Se jogou o melhor lance exato do motor, perda é sempre 0
  if (ctx.playerMoveUci === ctx.bestMoveUci) {
    return 0;
  }

  // Mate handling: jogador tinha mate favorável e perdeu
  if (isMateFavorable(ctx.mateBefore) && !isMateFavorable(ctx.mateAfter)) {
    return MATE_CP_LOSS;
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

// ---------------------------------------------------------------------------
// Verifiable Pattern Detection (Lista Fechada da Seção 5)
// ---------------------------------------------------------------------------

function detectPatternExplanation(
  quality: MoveQuality,
  cpLoss: number,
  ctx: PositionContext,
): string {
  const opponentColor = ctx.playerColor === 'w' ? 'b' : 'w';

  // 1. Mate perdido: havia mate em N e ele não jogou
  if (isMateFavorable(ctx.mateBefore) && !isMateFavorable(ctx.mateAfter)) {
    return `Havia mate em ${ctx.mateBefore} com ${ctx.bestMoveSan}, mas você não jogou!`;
  }

  // 2. Mate permitido: seu lance permite mate pelo adversário
  if (isMateUnfavorable(ctx.mateAfter) && !isMateUnfavorable(ctx.mateBefore)) {
    return 'Erro grave! Seu lance permite mate pelo adversário.';
  }

  // Para lances com erro (imprecisão, erro, erro_grave)
  if (quality === 'imprecisao' || quality === 'erro' || quality === 'erro_grave') {
    try {
      const chessBefore = new Chess(ctx.fenBefore);
      const chessAfter = new Chess(ctx.fenAfter);

      // 3. Peça deixada desprotegida e capturável (e a melhor resposta do motor a punia)
      // Usa pvAfter[0] (resposta do adversário ao lance real do jogador)
      const replyUci = (ctx.pvAfter && ctx.pvAfter.length > 0)
        ? ctx.pvAfter[0]
        : (ctx.pvBefore && ctx.pvBefore.length > 1 ? ctx.pvBefore[1] : null);

      if (replyUci && replyUci.length >= 4) {
        const replyTo = replyUci.substring(2, 4) as Square;
        const pieceAtTarget = chessAfter.get(replyTo);

        if (pieceAtTarget && pieceAtTarget.color === ctx.playerColor) {
          const defenders = chessAfter.attackers(replyTo, ctx.playerColor);
          if (defenders.length === 0) {
            const pieceName = PIECE_NAMES_PT[pieceAtTarget.type] || 'sua peça';
            return `Peça desprotegida! O seu lance deixou ${pieceName} em ${replyTo} sem defesa.`;
          }
        }
      }

      // 4. Captura gratuita perdida (havia peça adversária pendurada e ele não pegou)
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
          return `Captura gratuita perdida! Você podia capturar ${pieceName} em ${bestMoveTo} com ${ctx.bestMoveSan}.`;
        }
      }

      // 5. Material perdido no lance (troca desfavorável imediata)
      const playerTo = ctx.playerMoveUci.substring(2, 4) as Square;
      const playerPieceAfter = chessAfter.get(playerTo);
      if (playerPieceAfter && playerPieceAfter.color === ctx.playerColor) {
        const enemyAttackers = chessAfter.attackers(playerTo, opponentColor);
        const myDefenders = chessAfter.attackers(playerTo, ctx.playerColor);
        if (enemyAttackers.length > 0 && myDefenders.length === 0 && cpLoss >= 100) {
          const pieceName = PIECE_NAMES_PT[playerPieceAfter.type] || 'sua peça';
          return `Material perdido! O seu lance colocou ${pieceName} em ${playerTo} onde pode ser capturada.`;
        }
      }
    } catch {
      // Em caso de erro na análise da posição, segue para o template genérico
    }
  }

  // 6. Lance de desenvolvimento / segurança do rei na abertura (até lance 12, sem perda tática)
  if (ctx.moveNumber <= 12 && cpLoss <= 30) {
    if (ctx.playerMoveSan === 'O-O' || ctx.playerMoveSan === 'O-O-O') {
      return 'Bom lance de segurança do rei: roque realizado.';
    }

    // Lance de cavalo ou bispo saindo da fileira inicial
    const fromSquare = ctx.playerMoveUci.substring(0, 2);
    const startRank = ctx.playerColor === 'w' ? '1' : '8';
    if (
      fromSquare[1] === startRank &&
      (ctx.playerMoveSan.startsWith('N') || ctx.playerMoveSan.startsWith('B'))
    ) {
      return 'Bom lance de desenvolvimento na abertura.';
    }
  }

  // 7. Lance que era o melhor ou defendia a ameaça concreta da posição
  if (quality === 'excelente' || quality === 'bom') {
    try {
      const chessBefore = new Chess(ctx.fenBefore);
      if (chessBefore.isCheck()) {
        return 'Excelente! Defendeu o rei em xeque.';
      }
    } catch {
      // Fallback
    }

    if (ctx.playerMoveUci === ctx.bestMoveUci || cpLoss <= 10) {
      return 'Excelente! Este era o melhor lance.';
    }
    return 'Bom lance. Mantém a posição.';
  }

  // 8. Template genérico e honesto (fora dos padrões acima)
  switch (quality) {
    case 'imprecisao':
      return `Imprecisão. O motor preferia ${ctx.bestMoveSan} — sua posição fica ${cpLoss} centipeões pior.`;
    case 'erro':
      return `Erro. O motor preferia ${ctx.bestMoveSan} — sua posição fica ${cpLoss} centipeões pior.`;
    case 'erro_grave':
      return `Erro grave! O motor preferia ${ctx.bestMoveSan} — sua posição fica ${cpLoss} centipeões pior.`;
    default:
      return 'Bom lance.';
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

  const explanation = detectPatternExplanation(quality, cpLoss, ctx);
  const config = QUALITY_CONFIG[quality];

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
  };
}
