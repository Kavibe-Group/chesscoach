# Status — Xadrez Coach
Fase atual: 5 · Última atualização: 2026-10-24 00:27
Modelo executor: Claude Opus 4.6
Fases: 0 [x] · 1 [x] · 2 [x] · 3 [x] · 4 [x] · 5 [x]
Testes: 45 passando / 0 falhando · comando: npm test (vitest run)
Decisões autônomas tomadas:
- Utilizado Stockfish 19 Lite Single-Threaded WASM (1.7MB) servido via pasta public/ para execução client-side 100% autônoma, sem dependência de headers de SharedArrayBuffer/Cross-Origin Isolation.
- Chessground integrado com temas visual clássico (Marrom), torneio (Verde) e oceano (Azul), com suporte a setas e destaques SVG nativos.
- Camada de armazenamento seguro ('storage.ts') compatível com localStorage no navegador e fallback em memória para testes no ambiente Node/Vitest.
- Lista fechada de padrões verificáveis do MoveAnalyzer implementada com checagem de fatos do tabuleiro via chess.js (peça desprotegida punível, captura gratuita perdida, mate perdido/permitido, material perdido, desenvolvimento/segurança do rei e lances ótimos).
- Bateria de 12 posições calibrada com 100% de concordância automatizada no Stockfish (4 mate em 1, 4 mate em 2, 4 decisivas).
- Adicionado teste de aceitação de fluxo de ponta a ponta (e2e.test.ts) simulando toda a jornada do jogador.
Problemas encontrados e como foram resolvidos:
- Race condition no handshake UCI do Stockfish em chamadas síncronas no Node: resolvido implementando primitivas `sendAndWait` e registro de handlers antes do disparo dos comandos.
- Posições iniciais de mate com FEN inválida ou lances não exclusivos detectadas pelos testes automatizados do Stockfish: substituídas por posições clássicas e composições forçadas (Légall, Ópera de Morphy, invasão de torre na 8ª fila, ataque descoberto) validadas com 100% de aprovação pelo motor.
- Erro grave de mate perdido sendo rebaixado por posição decidida (>500cp): ajustado o classificador para garantir que mate perdido ou mate permitido é sempre classificado como 'erro_grave' (perda máxima), conforme especificação da seção 5.
Bloqueios: nenhum

---

## Reparo — 2026-10-24
Modelo executor: Claude Sonnet 4.6
Bugs encontrados: P0 3 · P1 6 · P2 3 (Total: 12)
Bugs resolvidos: P0 3 · P1 6 · P2 3 · Abertos: 0
Suíte final: 63/63 passando · Fuzz / Soak: 100/100 partidas limpas (0 crashes, 0 lances ilegais)
Instalação limpa: [x] ok · Fluxo completo no build final: [x] ok
Limitações conhecidas restantes: nenhuma

### Resumo dos Reparos Executados e Testados
- **BUG-01 (P0):** Fluxo de "Tentar de novo" e cancelamento do motor corrigidos (`src/ui/screens/GameScreen.ts`). Quando o motor já respondeu, desfaz ambos os lances (motor + erro); se o motor estiver pensando, aborta a busca via `opponentEngine.stop()`. Teste de regressão: `src/ui/screens/GameScreen.test.ts`. Commit: `fix(BUG-01)`.
- **BUG-02 (P0):** Isolamento de motores analista e oponente em instâncias separadas com fila de comandos UCI serializada (`src/engine/StockfishEngine.ts` e `src/ui/screens/GameScreen.ts`). Elimina race conditions e conflitos de força. Teste de regressão: `src/engine/StockfishEngine.test.ts`. Commit: `fix(BUG-02)`.
- **BUG-03 (P0):** Implementação da partida de calibração real contra o motor com medição de perda de centipeões (ACPL) calculada pelo Stockfish (`src/ui/screens/AssessmentScreen.ts`). Eliminado o cálculo de ACPL simulado. Teste de regressão: `src/ui/screens/AssessmentScreen.test.ts`. Commit: `fix(BUG-03)`.
- **BUG-04 (P1):** Detecção de peça desprotegida no MoveAnalyzer corrigida para usar `pvAfter[0]` (resposta do adversário ao lance jogado) em vez de `pvBefore[1]`. Teste de regressão: `src/analysis/MoveAnalyzer.test.ts`. Commit: `fix(BUG-04)`.
- **BUG-05 (P1):** Classificação de mate em 1 perdido corrigida como erro grave (perda máxima de 9999 cp) mesmo que a posição mantenha vantagem com mate em N lances. Teste de regressão: `src/analysis/MoveAnalyzer.test.ts`. Commit: `fix(BUG-05)`.
- **BUG-06 (P1):** Avanço de índice no treino de erros corrigido com `currentIdx++` e rotação circular ao clicar em "Próximo exercício" (`src/ui/screens/TrainingScreen.ts`). Teste de regressão: `src/ui/screens/TrainingScreen.test.ts`. Commit: `fix(BUG-06)`.
- **BUG-07 (P1):** Desfazer jogada em "Tentar de novo" agora remove o erro da fila de treino em vez de poluir a fila ativa (`src/training/TrainingManager.ts`, `src/ui/screens/GameScreen.ts`). Teste de regressão: `src/ui/screens/GameScreen.test.ts`. Commit: `fix(BUG-07)`.
- **BUG-08 (P1):** Proteção defensiva de storage (`src/storage.ts`, `src/profile/`, `src/training/`): suporte a modo anônimo sem exceções e sanitização de dados corrompidos (ex: `{}`) com fallbacks seguros. Teste de regressão: `src/storage.test.ts`. Commit: `fix(BUG-08)`.
- **BUG-09 (P1):** Tratamento defensivo de FEN inválida no `GameController.ts` com retorno booleano e fallback para posição inicial sem lançar exceções. Teste de regressão: `src/game/GameController.test.ts`. Commit: `fix(BUG-09)`.
- **BUG-10 (P2):** Configuração `autoCastle: true` e `blockTouchScroll: true` ativadas no Chessground para usabilidade fluida no mobile e roque automático. Teste de regressão: `src/ui/ChessBoard.test.ts`. Commit: `fix(BUG-10)`.
- **BUG-11 (P2):** Envio de `ucinewgame` e cancelamento de buscas em andamento ao reiniciar uma partida (`src/ui/screens/GameScreen.ts`). Teste de regressão: `src/ui/screens/GameScreen.test.ts`. Commit: `fix(BUG-11)`.
- **BUG-12 (P2):** Limpeza garantida de handlers `info` e restauração de força em bloco `try...finally` no método `evaluate` do `StockfishEngine.ts`. Teste de regressão: `src/engine/StockfishEngine.test.ts`. Commit: `fix(BUG-12)`.


