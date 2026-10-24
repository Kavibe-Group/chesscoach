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
