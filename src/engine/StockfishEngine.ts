/**
 * Wrapper para Stockfish WASM rodando em Web Worker.
 * Comunicação via protocolo UCI (Universal Chess Interface).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EngineEvaluation {
  /** Pontuação em centipawns da perspectiva do lado que move. */
  score: number;
  /** Mate em N lances (positivo = lado que move vence, negativo = perde). */
  mate: number | null;
  /** Melhor lance em formato UCI, ex.: "e2e4". */
  bestMove: string;
  /** Variação principal (lista de lances UCI). */
  pv: string[];
  /** Profundidade alcançada pela busca. */
  depth: number;
}

export interface EngineConfig {
  /** Nível de habilidade do Stockfish (0–20). */
  skillLevel?: number;
  /** Elo alvo quando UCI_LimitStrength está ativo. */
  uciElo?: number;
  /** Ativa limitação de força via UCI_Elo. */
  limitStrength?: boolean;
  /** Profundidade de busca. */
  depth?: number;
  /** Tempo por lance em milissegundos. */
  moveTime?: number;
}

// ---------------------------------------------------------------------------
// Helper – mapeia Elo estimado do jogador para configuração do engine
// ---------------------------------------------------------------------------

/**
 * Retorna uma configuração de engine que joga ligeiramente acima do Elo
 * informado (playerElo + 50) para oferecer um desafio adequado.
 */
export function eloToEngineConfig(playerElo: number): EngineConfig {
  const targetElo = playerElo + 50;

  if (targetElo < 1320) {
    // Faixa baixa – usa Skill Level (UCI_LimitStrength nem sempre é preciso aqui)
    if (targetElo < 900) return { skillLevel: 0, limitStrength: false };
    if (targetElo < 1100) return { skillLevel: 3, limitStrength: false };
    if (targetElo < 1260) return { skillLevel: 5, limitStrength: false };
    return { skillLevel: 8, limitStrength: false };
  }

  // Faixa média/alta – usa UCI_Elo para controle mais preciso
  return { uciElo: targetElo, limitStrength: true };
}

// ---------------------------------------------------------------------------
// Worker interface for browser and Node.js testing
// ---------------------------------------------------------------------------

export interface IWorker {
  postMessage(message: string): void;
  onmessage: ((event: { data: string }) => void) | null;
  terminate(): void;
}

class BrowserWorkerWrapper implements IWorker {
  private worker: Worker;

  constructor(scriptUrl: string) {
    this.worker = new Worker(scriptUrl);
  }

  postMessage(msg: string): void {
    this.worker.postMessage(msg);
  }

  set onmessage(handler: ((event: { data: string }) => void) | null) {
    this.worker.onmessage = handler
      ? (ev: MessageEvent) => handler({ data: String(ev.data) })
      : null;
  }

  get onmessage(): null {
    return null;
  }

  terminate(): void {
    this.worker.terminate();
  }
}

// ---------------------------------------------------------------------------
// StockfishEngine
// ---------------------------------------------------------------------------

const DEFAULT_EVAL_DEPTH = 15;
const DEFAULT_TIMEOUT_MS = 30_000;

export class StockfishEngine {
  private worker: IWorker | null = null;
  private messageHandlers: ((line: string) => void)[] = [];
  private ready = false;
  private currentConfig: EngineConfig | null = null;
  private workerFactory?: () => IWorker;

  constructor(workerFactory?: () => IWorker) {
    this.workerFactory = workerFactory;
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /**
   * Inicializa o Web Worker do Stockfish e aguarda o protocolo UCI ficar
   * pronto (`uciok` + `readyok`).
   */
  async init(): Promise<void> {
    if (this.worker) {
      return;
    }

    if (this.workerFactory) {
      this.worker = this.workerFactory();
    } else if (typeof Worker !== 'undefined') {
      this.worker = new BrowserWorkerWrapper('/stockfish-19-lite-single.js');
    } else {
      throw new Error('Ambiente sem suporte a Web Worker. Forneça uma fábrica de workers.');
    }

    if (!this.worker) {
      throw new Error('Falha ao inicializar o worker do Stockfish.');
    }

    this.worker.onmessage = (event: { data: string }) => {
      const line: string =
        typeof event.data === 'string' ? event.data : String(event.data);

      // Notifica todos os handlers registrados (cópia defensiva)
      for (const handler of [...this.messageHandlers]) {
        handler(line);
      }
    };

    // Handshake UCI
    await this.sendAndWait('uci', /^uciok$/);
    await this.sendAndWait('isready', /^readyok$/);

    this.ready = true;
  }

  /**
   * Destrói o worker e libera recursos.
   */
  destroy(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.ready = false;
    this.messageHandlers = [];
    this.currentConfig = null;
  }

  /**
   * Retorna `true` se o engine está inicializado e pronto.
   */
  isReady(): boolean {
    return this.ready;
  }

  // -----------------------------------------------------------------------
  // UCI communication primitives
  // -----------------------------------------------------------------------

  /**
   * Envia um comando UCI bruto para o worker.
   */
  private send(cmd: string): void {
    if (!this.worker) {
      throw new Error('Stockfish worker não inicializado. Chame init() primeiro.');
    }
    this.worker.postMessage(cmd);
  }

  /**
   * Registra a espera por um padrão e envia o comando.
   * Evita race condition se a resposta for síncrona ou muito rápida.
   */
  private sendAndWait(
    cmd: string,
    pattern: RegExp,
    timeout: number = DEFAULT_TIMEOUT_MS,
  ): Promise<string> {
    const promise = this.waitFor(pattern, timeout);
    this.send(cmd);
    return promise;
  }

  /**
   * Aguarda até que o engine responda com uma linha que corresponda ao
   * `pattern` informado. Retorna a linha que fez match.
   *
   * @param pattern  RegExp para testar cada linha recebida.
   * @param timeout  Tempo máximo de espera em ms (padrão 30 s).
   */
  private waitFor(
    pattern: RegExp,
    timeout: number = DEFAULT_TIMEOUT_MS,
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(
          new Error(
            `Stockfish: timeout aguardando resposta (pattern: ${pattern})`,
          ),
        );
      }, timeout);

      const handler = (line: string) => {
        if (pattern.test(line)) {
          cleanup();
          resolve(line);
        }
      };

      const cleanup = () => {
        clearTimeout(timer);
        const idx = this.messageHandlers.indexOf(handler);
        if (idx !== -1) {
          this.messageHandlers.splice(idx, 1);
        }
      };

      this.messageHandlers.push(handler);
    });
  }

  // -----------------------------------------------------------------------
  // Engine configuration
  // -----------------------------------------------------------------------

  /**
   * Configura a força do engine para o modo oponente.
   */
  async setStrength(config: EngineConfig): Promise<void> {
    this.ensureReady();

    if (config.limitStrength && config.uciElo !== undefined) {
      this.send('setoption name UCI_LimitStrength value true');
      this.send(`setoption name UCI_Elo value ${config.uciElo}`);
    } else {
      // Desativa limitação de Elo ao usar Skill Level
      this.send('setoption name UCI_LimitStrength value false');
    }

    if (config.skillLevel !== undefined) {
      this.send(`setoption name Skill Level value ${config.skillLevel}`);
    }

    this.currentConfig = { ...config };

    // Garante que o engine processou as opções
    await this.sendAndWait('isready', /^readyok$/);
  }

  // -----------------------------------------------------------------------
  // Search – opponent mode
  // -----------------------------------------------------------------------

  /**
   * Retorna o melhor lance para a posição FEN dada, respeitando a força
   * configurada via `setStrength`.
   *
   * @param fen     Posição em formato FEN.
   * @param config  Overrides de profundidade / tempo para esta busca.
   * @returns       Lance em formato UCI (ex.: "e2e4").
   */
  async getBestMove(
    fen: string,
    config?: { depth?: number; moveTime?: number },
  ): Promise<string> {
    this.ensureReady();

    this.send(`position fen ${fen}`);

    const depth = config?.depth ?? this.currentConfig?.depth;
    const moveTime = config?.moveTime ?? this.currentConfig?.moveTime;

    const bestMovePromise = this.waitFor(/^bestmove\s/);

    if (moveTime !== undefined) {
      this.send(`go movetime ${moveTime}`);
    } else if (depth !== undefined) {
      this.send(`go depth ${depth}`);
    } else {
      // Padrão razoável para modo oponente
      this.send('go movetime 1000');
    }

    const bestMoveLine = await bestMovePromise;
    const match = bestMoveLine.match(/^bestmove\s(\S+)/);

    if (!match) {
      throw new Error(
        `Stockfish: não foi possível extrair bestmove de "${bestMoveLine}"`,
      );
    }

    return match[1];
  }

  // -----------------------------------------------------------------------
  // Search – analyst mode (full strength)
  // -----------------------------------------------------------------------

  /**
   * Avalia a posição em força total e retorna pontuação, melhor lance e
   * variação principal.
   *
   * Internamente, o engine é temporariamente configurado para força máxima
   * (Skill Level 20, sem limitação de Elo). Após a avaliação, a configuração
   * anterior é restaurada.
   *
   * A pontuação é da perspectiva do lado que move (conforme retornado pelo
   * Stockfish). Cabe ao chamador converter se necessário.
   *
   * @param fen   Posição em formato FEN.
   * @param depth Profundidade de busca (padrão 15).
   */
  async evaluate(
    fen: string,
    depth: number = DEFAULT_EVAL_DEPTH,
  ): Promise<EngineEvaluation> {
    this.ensureReady();

    // Salva configuração atual
    const savedConfig = this.currentConfig ? { ...this.currentConfig } : null;

    // Força máxima para análise
    this.send('setoption name Skill Level value 20');
    this.send('setoption name UCI_LimitStrength value false');
    await this.sendAndWait('isready', /^readyok$/);

    this.send(`position fen ${fen}`);

    // Variáveis para capturar a melhor info durante a busca
    let lastScore = 0;
    let lastMate: number | null = null;
    let lastPv: string[] = [];
    let lastDepth = 0;

    // Registra handler para coletar linhas "info" durante a busca
    const infoHandler = (line: string) => {
      if (!line.startsWith('info ') || !line.includes(' pv ')) {
        return;
      }

      // Parse depth
      const depthMatch = line.match(/\bdepth\s(\d+)/);
      if (depthMatch) {
        lastDepth = parseInt(depthMatch[1], 10);
      }

      // Parse score
      const cpMatch = line.match(/\bscore cp\s(-?\d+)/);
      if (cpMatch) {
        lastScore = parseInt(cpMatch[1], 10);
        lastMate = null;
      }

      const mateMatch = line.match(/\bscore mate\s(-?\d+)/);
      if (mateMatch) {
        lastMate = parseInt(mateMatch[1], 10);
        // Quando é mate, usamos um score alto para indicar a direção
        lastScore = lastMate > 0 ? 100_000 : -100_000;
      }

      // Parse PV (tudo depois de " pv ")
      const pvMatch = line.match(/\bpv\s(.+)$/);
      if (pvMatch) {
        lastPv = pvMatch[1].trim().split(/\s+/);
      }
    };

    this.messageHandlers.push(infoHandler);

    // Inicia busca registrando espera por bestmove antes de enviar comando
    const bestMovePromise = this.waitFor(/^bestmove\s/);
    this.send(`go depth ${depth}`);
    const bestMoveLine = await bestMovePromise;

    // Remove o handler de info
    const handlerIdx = this.messageHandlers.indexOf(infoHandler);
    if (handlerIdx !== -1) {
      this.messageHandlers.splice(handlerIdx, 1);
    }

    // Extrai bestmove
    const bestMoveMatch = bestMoveLine.match(/^bestmove\s(\S+)/);
    if (!bestMoveMatch) {
      throw new Error(
        `Stockfish: não foi possível extrair bestmove de "${bestMoveLine}"`,
      );
    }

    const bestMove = bestMoveMatch[1];

    // Restaura configuração anterior
    if (savedConfig) {
      await this.setStrength(savedConfig);
    }

    return {
      score: lastScore,
      mate: lastMate,
      bestMove,
      pv: lastPv.length > 0 ? lastPv : [bestMove],
      depth: lastDepth,
    };
  }

  // -----------------------------------------------------------------------
  // Control
  // -----------------------------------------------------------------------

  /**
   * Interrompe a busca atual.
   */
  stop(): void {
    if (this.worker) {
      this.send('stop');
    }
  }

  /**
   * Reseta o estado do engine para uma nova partida.
   */
  async newGame(): Promise<void> {
    this.ensureReady();

    this.send('ucinewgame');
    await this.sendAndWait('isready', /^readyok$/);
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private ensureReady(): void {
    if (!this.ready || !this.worker) {
      throw new Error('Stockfish engine não está pronto. Chame init() primeiro.');
    }
  }
}
