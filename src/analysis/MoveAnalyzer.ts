/**
 * Módulo de análise de lances.
 * Classifica lances do jogador e gera feedback baseado na avaliação do Stockfish.
 *
 * Toda a lógica de avaliação vem do Stockfish — nenhuma avaliação personalizada é implementada.
 * Toda a lógica de regras vem do chess.js — nenhuma regra personalizada é implementada.
 */

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
  /** Explicação em PT-BR */
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Retorna o rótulo de exibição (PT-BR) para uma qualidade de lance.
 */
export function getQualityLabel(quality: MoveQuality): string {
  return QUALITY_CONFIG[quality].label;
}

/**
 * Verifica se um valor de mate é favorável ao jogador.
 * Mate positivo → jogador dá mate; mate negativo → adversário dá mate.
 */
function isMateFavorable(mate: number | null): boolean {
  return mate !== null && mate > 0;
}

/**
 * Verifica se um valor de mate é desfavorável ao jogador.
 */
function isMateUnfavorable(mate: number | null): boolean {
  return mate !== null && mate < 0;
}

/**
 * Calcula a perda em centipeões do lance jogado.
 */
function calculateCpLoss(ctx: PositionContext): number {
  // Mate handling —
  // Se o jogador tinha mate e perdeu
  if (isMateFavorable(ctx.mateBefore) && !isMateFavorable(ctx.mateAfter)) {
    return MATE_CP_LOSS;
  }

  // Se o lance permitiu mate do adversário (e antes não havia)
  if (isMateUnfavorable(ctx.mateAfter) && !isMateUnfavorable(ctx.mateBefore)) {
    return MATE_CP_LOSS;
  }

  // Se o jogador jogou o melhor lance (ou dentro de 10cp)
  const rawLoss = ctx.evalBefore - ctx.evalAfter;
  if (rawLoss <= 10) {
    return 0;
  }

  return rawLoss;
}

/**
 * Classifica a qualidade do lance com base na perda de centipeões.
 */
function classifyMove(cpLoss: number): MoveQuality {
  if (cpLoss <= 10) return 'excelente';
  if (cpLoss <= 30) return 'bom';
  if (cpLoss <= 60) return 'imprecisao';
  if (cpLoss <= 150) return 'erro';
  return 'erro_grave';
}

/**
 * Qualidades ordenadas por severidade (menor para maior).
 */
const SEVERITY_ORDER: MoveQuality[] = [
  'excelente',
  'bom',
  'imprecisao',
  'erro',
  'erro_grave',
];

/**
 * Reduz a severidade em um nível (para posições já decididas).
 */
function downgradeSeverity(quality: MoveQuality): MoveQuality {
  const idx = SEVERITY_ORDER.indexOf(quality);
  if (idx <= 0) return SEVERITY_ORDER[0]!;
  return SEVERITY_ORDER[idx - 1]!;
}

/**
 * Gera a explicação em PT-BR para o lance analisado.
 */
function generateExplanation(
  quality: MoveQuality,
  cpLoss: number,
  ctx: PositionContext,
): string {
  // --- Detecções específicas de mate ---

  // Mate perdido: jogador tinha mate favorável e perdeu
  if (isMateFavorable(ctx.mateBefore) && !isMateFavorable(ctx.mateAfter)) {
    return `Havia mate em ${ctx.mateBefore} com ${ctx.bestMoveSan}, mas você não jogou!`;
  }

  // Mate permitido: o lance permite mate pelo adversário
  if (isMateUnfavorable(ctx.mateAfter) && !isMateUnfavorable(ctx.mateBefore)) {
    return 'Erro grave! Seu lance permite mate pelo adversário.';
  }

  // --- Templates genéricos ---
  switch (quality) {
    case 'excelente':
      return 'Excelente! Este era o melhor lance.';
    case 'bom':
      return 'Bom lance. Mantém a posição.';
    case 'imprecisao':
      return `Imprecisão. O motor preferia ${ctx.bestMoveSan} — sua posição fica ${cpLoss} centipeões pior.`;
    case 'erro':
      return `Erro. O motor preferia ${ctx.bestMoveSan} — sua posição fica ${cpLoss} centipeões pior.`;
    case 'erro_grave':
      return `Erro grave! O motor preferia ${ctx.bestMoveSan} — sua posição fica ${cpLoss} centipeões pior.`;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Analisa a qualidade de um lance jogado e retorna informações detalhadas.
 */
export function analyzeMoveQuality(ctx: PositionContext): MoveAnalysis {
  const cpLoss = calculateCpLoss(ctx);
  let quality = classifyMove(cpLoss);

  // Se a posição já estava decidida (|evalBefore| > 500), reduz a severidade em um nível
  if (Math.abs(ctx.evalBefore) > DECIDED_POSITION_THRESHOLD) {
    quality = downgradeSeverity(quality);
  }

  const explanation = generateExplanation(quality, cpLoss, ctx);
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
