# Status — Xadrez Coach

Reformulação implementada em 03/11/2026. Push e deploy autorizados pelo Victor nesta data; publicação automática pelo GitHub Actions ao atualizar `main`.

## O que mudou

- Interface sóbria, com temas automático/claro/escuro e navegação Jogar, Treinar e Progresso.
- Layout de partida com tabuleiro e controles fixos na área visível e painel interno com abas.
- Estudo e Teste separados; apenas testes e avaliação ajustam a estimativa de Elo.
- Uma partida ativa, gravação automática e retomada por PGN com relógios pausados ao sair.
- Dicas progressivas, explicações baseadas em fatos e demonstração independente da partida.
- Pausa após erros importantes para entender, tentar de novo ou continuar.
- Treino com sessões finitas, filtros reais, 60 puzzles distintos em seis temas e progresso persistente dos puzzles curados.
- Histórico detalhado das últimas 100 partidas e encerramento idempotente com journal de recuperação.
- Correções de resultados jogando de pretas, preservação da atividade diária e posição original dos erros.
- Avaliação opcional, sem apagar histórico existente.
- Cache offline gerado com os hashes dos assets e instalação atômica.

## Validação

Resultados e limites finais ficam em `VALIDATION.md`.

## Próximo passo

Validar no iPhone físico: Safari e PWA, alternar de app, fechar durante análise/resposta do motor, retomar relógio e histórico. Ajustar a experiência com o uso real após a publicação autorizada.

O resultado da publicação pode ser acompanhado no workflow Deploy Xadrez Coach PWA to GitHub Pages.
