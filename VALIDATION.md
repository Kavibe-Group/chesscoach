# Validação da reformulação

Data: 03/11/2026. Implementação validada localmente; push e deploy autorizados pelo Victor nesta data. O GitHub Actions executa novamente a suíte antes de publicar.

## Checks automatizados

- `npm test`: 178 testes em 23 arquivos, incluindo validação das 60 soluções completas pelo Stockfish 19 em profundidade 12.
- `npm run build`: TypeScript e Vite concluídos sem erros.
- `node scripts/verify-offline.cjs`: shell e arquivos com hash, WASM, instalação atômica, fallback no subcaminho do GitHub Pages e limpeza restrita aos caches deste app.
- `git diff --check`: sem erros de whitespace.

Cobertura acrescentada: retomada por PGN com repetição e desfazer, análise interrompida, decisão após erro, resposta antiga do motor após pausa, bloqueio enquanto prepara uma nova partida, relógio sem cobrança durante análise, expiração antes de aceitar lance, resultado jogando de pretas, revisão sem efeitos, encerramento idempotente e recuperação de quota em cada etapa de gravação. Inclui acesso negado ao armazenamento, promoção resolvida após destruir o tabuleiro, filtros de treino, progresso dos puzzles curados e revisões de posições dominadas.

## Conferência no navegador local

- Entrada sem avaliação obrigatória e nível provisório.
- Partida de Estudo: e4, resposta do motor e histórico conservado após recarga; partida retorna pausada com “Continuar”.
- Três níveis de dica, justificativa concreta e demonstração navegável separada da partida.
- Confirmação de desistência dentro do app, revisão de estudo sem ajuste de Elo e registro acessível em Progresso.
- Partida sem lances mostra ausência de amostra, em vez de precisão ou elogios inventados.
- Seleção de cinco puzzles de garfo, tema correspondente e dica no treino.
- Troca de aparência clara/escura e retorno ao modo automático.
- Viewports de partida 375 × 667, 390 × 844, 430 × 932 e horizontal 844 × 390: tabuleiro e ações essenciais dentro da tela, sem transbordamento da página. Interface também conferida em largura de computador.
- Treino em 390 × 844: página com 390 × 844, tabuleiro entre x=20 e x=370; controles abaixo, feedback com rolagem interna.

## Limites e próxima validação

A conferência de navegador usa o navegador integrado e tamanhos de tela simulados. **Não substitui testes em Safari/WebKit nem no iPhone físico.** A lógica do Service Worker foi verificada com o pacote de produção e um ambiente simulado; falta confirmar a instalação real da PWA e o uso com a conexão desligada.

Validação pendente no iPhone físico:

1. Instalar a PWA após uma carga completa e conferir abertura offline.
2. Alternar de app e encerrar o processo durante vez do jogador, análise e resposta do motor.
3. Retomar dias depois, conferir posição, histórico, relógio e novas tentativas.
4. Conferir toques, arraste, roque, promoção, áreas seguras, acessibilidade e modo de movimento reduzido no aparelho.
5. Validar com uso real a utilidade das explicações e a calibração de nível.

Dados são locais por navegador/origem; usar uma aba de jogo por vez. A origem de desenvolvimento contém partidas e perfil sintéticos produzidos durante a validação. A publicação atualiza o app; não migra nem apaga os dados locais existentes.

## Correção do ícone ao adicionar à tela inicial

Em 03/11/2026, Victor relatou ausência do ícone no iPhone. O PNG publicado respondeu HTTP 200, `image/png`, 180 × 180: não era um arquivo ausente. Aplicado no build o workaround confirmado por Victor no app da Jacie (Gemma, 29/10): `apple-touch-icon` PNG embutido como data URI no HTML. O arquivo separado permanece disponível.

Build para GitHub Pages e verificação offline aprovados; o script confere que a imagem embutida é idêntica ao PNG original. O hash do Service Worker agora também inclui HTML, ícone e manifesto, para que uma mudança nesses arquivos atualize o cache mesmo sem alterar JS/CSS. A confirmação visual do ícone neste app depende de novo teste do Victor no iPhone. O mesmo workaround não resolveu o Aggelos, portanto não é tratado como garantia universal.
