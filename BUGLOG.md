# BUGLOG — Xadrez Coach (Missão de Reparo)

Este documento registra todos os bugs identificados, como reproduzir, a causa raiz, os testes de regressão e o status de resolução.

---

## Sumário de Bugs
- **P0 (Quebra o jogo / fluxo crítico):** 3
- **P1 (Ensina errado / trava fluxo / dados):** 6
- **P2 (Cosmético / usabilidade / robustez):** 3
- **Total:** 12

---

## BUG-01
- **Severidade:** P0
- **Onde:** `src/ui/screens/GameScreen.ts`
- **Como reproduzir:** Em uma partida, jogar um lance de erro grave. O motor adversário responde quase imediatamente. Se o jogador clicar em "Tentar de novo", o método `handleRetryMove` apenas chama `undoMove()` uma vez, desfazendo o lance do motor e mantendo o erro do jogador no tabuleiro. Se o motor ainda estiver pensando, o clique é sumariamente ignorado.
- **Causa provável:** O motor oponente iniciava a busca imediatamente sem intervalo de decisão para o jogador. `handleRetryMove` não desfazia ambos os lances (motor + jogador) caso o motor já tivesse respondido, nem abortava a busca em andamento.
- **Teste de regressão:** `src/ui/screens/GameScreen.test.ts` (testes de desfecho duplo após resposta e aborto enquanto motor pensa)
- **Status:** Resolvido (commit fix(BUG-01))

---

## BUG-02
- **Severidade:** P0
- **Onde:** `src/engine/StockfishEngine.ts` e `src/ui/screens/GameScreen.ts`
- **Como reproduzir:** Invocar `getBestMove` e `evaluate` concorrentemente ou em rápida sucessão. `evaluate()` reconfigura globalmente `Skill Level 20` e `UCI_LimitStrength false` no mesmo worker do oponente e envia comandos sem fila exclusiva, gerando respostas UCI cruzadas e corrompendo a busca do oponente.
- **Causa provável:** `GameScreen` instanciava apenas 1 `StockfishEngine` para os dois papéis (analista e oponente) e a classe não possuía fila/mutex para comandos UCI.
- **Teste de regressão:** `src/engine/StockfishEngine.test.ts` (`BUG-02: enfileira chamadas concorrentes sem colisão de comandos UCI em worker assíncrono`)
- **Status:** Resolvido (commit fix(BUG-02))

---

## BUG-03
- **Severidade:** P0
- **Onde:** `src/ui/screens/AssessmentScreen.ts`
- **Como reproduzir:** Concluir as 12 posições da avaliação. O app saltava diretamente para o sumário calculando um `estimatedAcpl = Math.max(30, 220 - correctCount * 15)` puramente simulado, sem jogar a partida de calibração contra o motor prevista no plano original.
- **Causa provável:** A partida de calibração contra o motor foi pulada e substituída por uma fórmula matemática estática, violando a regra de não inventar avaliações sem o Stockfish.
- **Teste de regressão:** `src/ui/screens/AssessmentScreen.test.ts` (testes de transição para calibração real e cálculo do ACPL pelo Stockfish)
- **Status:** Resolvido (commit fix(BUG-03))

---

## BUG-04
- **Severidade:** P1
- **Onde:** `src/analysis/MoveAnalyzer.ts`
- **Como reproduzir:** Jogar um lance que pendura uma peça. A explicação tentava detectar a peça desprotegida usando `ctx.pvBefore[1]`, que é a resposta ao *melhor lance* (não jogado), e não ao lance real do jogador.
- **Causa provável:** Uso incorreto de `pvBefore` em vez de `pvAfter` (variante calculada sobre `fenAfter`).
- **Teste de regressão:** `src/analysis/MoveAnalyzer.test.ts` (`BUG-04: detecta peça desprotegida punível usando pvAfter[0] em vez de pvBefore[1]`)
- **Status:** Resolvido (commit fix(BUG-04))

---

## BUG-05
- **Severidade:** P1
- **Onde:** `src/analysis/MoveAnalyzer.ts`
- **Como reproduzir:** Em uma posição com mate em 1, jogar qualquer lance legal que mantenha vantagem com mate em 4. `calculateCpLoss` tratava mate em 4 como favorável e classificava o lance como `Excelente` (0 cpLoss) devido ao valor sentinela de 100.000 cp.
- **Causa provável:** Falta de detecção de mate imediato ignorado quando o jogador não joga o melhor lance de mate.
- **Teste de regressão:** `src/analysis/MoveAnalyzer.test.ts` (`BUG-05: classifica perda de mate em 1 como erro grave mesmo se a posição mantiver mate em 4`)
- **Status:** Resolvido (commit fix(BUG-05))

---

## BUG-06
- **Severidade:** P1
- **Onde:** `src/ui/screens/TrainingScreen.ts`
- **Como reproduzir:** Ter vários erros na fila de treino. Ao resolver ou errar o primeiro exercício e clicar em "Próximo exercício", a mesma posição é recarregada porque o índice `currentIdx` nunca era incrementado.
- **Causa provável:** Ausência de `this.currentIdx++` no evento do botão `btn-next-training`.
- **Teste de regressão:** `src/ui/screens/TrainingScreen.test.ts` (`BUG-06: incrementa currentIdx ao clicar em próximo exercício quando o exercício não foi dominado`)
- **Status:** Resolvido (commit fix(BUG-06))

---

## BUG-07
- **Severidade:** P1
- **Onde:** `src/ui/screens/GameScreen.ts` e `src/training/TrainingManager.ts`
- **Como reproduzir:** Cometer um erro e clicar em "Tentar de novo". O erro anterior já havia sido salvo no `TrainingManager` e permanecia na fila de treino mesmo após ser corrigido na segunda chance.
- **Causa provável:** Chamada imediata a `addTrainingPosition` no momento do lance sem remoção correspondente ao desfazer a jogada.
- **Teste de regressão:** `src/ui/screens/GameScreen.test.ts` (`BUG-07: remove erro da fila de treino ao clicar em tentar de novo`)
- **Status:** Resolvido (commit fix(BUG-07))

---

## BUG-08
- **Severidade:** P1
- **Onde:** `src/storage.ts`, `src/profile/ProfileManager.ts`, `src/training/TrainingManager.ts`, `src/profile/SettingsManager.ts`
- **Como reproduzir:** Salvar dados corrompidos ou JSON incompleto (ex.: `{}`) no `localStorage`. Métodos de array como `queue.filter` e propriedades como `eloHistory.slice` lançam `TypeError` e impedem a inicialização do app.
- **Causa provável:** Ausência de sanitização, validação de schema e valores padrão seguros ao ler do storage.
- **Teste de regressão:** `src/storage.test.ts` (testes de perfil corrompido, treino corrompido, stats corrompidos e configurações)
- **Status:** Resolvido (commit fix(BUG-08))

---

## BUG-09
- **Severidade:** P1
- **Onde:** `src/game/GameController.ts`
- **Como reproduzir:** Passar uma string FEN inválida para `loadFen()`. O `chess.js` lança exceção não capturada, travando o fluxo.
- **Causa provável:** Ausência de bloco `try...catch` defensivo em `loadFen()` e no construtor de `GameController`.
- **Teste de regressão:** `src/game/GameController.test.ts` (`BUG-09: trata FEN inválida sem lançar exceção não tratada`)
- **Status:** Resolvido (commit fix(BUG-09))

---

## BUG-10
- **Severidade:** P2
- **Onde:** `src/ui/ChessBoard.ts`
- **Como reproduzir:** Em dispositivos móveis com toque, arrastar peças arrasta a página. Ao fazer roque com o rei, a torre não acompanha a animação automaticamente.
- **Causa provável:** Omissão de `autoCastle: true` e `blockTouchScroll: true` na configuração do Chessground.
- **Teste de regressão:** `src/ui/ChessBoard.test.ts` (`BUG-10: configura autoCastle: true e blockTouchScroll: true para usabilidade mobile e roque fluido`)
- **Status:** Resolvido (commit fix(BUG-10))

---

## BUG-11
- **Severidade:** P2
- **Onde:** `src/ui/screens/GameScreen.ts`
- **Como reproduzir:** Clicar em "Nova Partida" no meio de uma partida. O motor não recebia `ucinewgame` nem abortava a busca anterior em andamento.
- **Causa provável:** Ausência de `this.opponentEngine.stop()` e `this.opponentEngine.newGame()` no método `handleNewGame`.
- **Teste de regressão:** `src/ui/screens/GameScreen.test.ts` (`BUG-11: interrompe busca e reseta ambos os motores com newGame ao reiniciar partida`)
- **Status:** Resolvido (commit fix(BUG-11))

---

## BUG-12
- **Severidade:** P2
- **Onde:** `src/engine/StockfishEngine.ts`
- **Como reproduzir:** Ocorrer um erro ou timeout no método `evaluate()`. O handler de mensagens `infoHandler` permanecia indefinidamente no array `messageHandlers` e a força anterior do motor não era restaurada.
- **Causa provável:** Ausência de bloco `try...finally` garantindo a remoção do handler e restauração da configuração.
- **Teste de regressão:** `src/engine/StockfishEngine.test.ts` (`BUG-12: limpa handlers e garante que falhas no evaluate não deixam listeners orfãos`)
- **Status:** Resolvido (commit fix(BUG-12))
