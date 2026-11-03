# Xadrez Coach

Treinador pessoal de xadrez em português, pensado para iPhone e disponível como PWA. Stockfish 19 roda no aparelho; perfil, partidas e treino ficam no armazenamento do navegador. Sem conta, backend, anúncios, telemetria ou APIs externas.

## Experiência

- **Jogar:** Estudo com dicas progressivas e novas tentativas, ou Teste sem ajuda durante a partida. Somente Teste e avaliação ajustam o Elo estimado local.
- **Retomar:** uma partida ativa salva automaticamente, incluindo histórico completo, configuração, análises e relógios. Ao sair do app o tempo pausa; “Continuar” retoma o jogo.
- **Entender:** dicas em três etapas — observação, ideia e lance explicado — com continuação explorável em um tabuleiro separado. As explicações usam fatos verificáveis e deixam claros os limites da avaliação.
- **Treinar:** revisões diárias, próprios erros ou seis temas táticos; sessões de 5, 10 ou todas as posições disponíveis. Respostas com ajuda não avançam domínio. Revisões seguem intervalos de 1, 3, 7 e 14 dias.
- **Progresso:** últimas 100 partidas completas com replay, indicadores de aprendizagem e padrões de erro. Reabrir uma revisão não contabiliza a partida novamente.
- **Começar:** escolha de nível provisório (800, 1200 ou 1600), sem avaliação obrigatória. A avaliação completa continua disponível e preserva seu histórico.

Tema claro/escuro acompanha o aparelho e pode ser fixado em Configurações. O tabuleiro mantém seus seis temas independentes. No celular, tabuleiro e ações essenciais ficam visíveis enquanto o painel do treinador tem rolagem própria.

## Desenvolvimento

Node.js 22 ou superior e npm.

```sh
npm ci
npm run dev
npm test
npm run build
node scripts/verify-offline.cjs
npm run preview
```

A stack permanece Vite 8, TypeScript 6, chess.js 1.4, Chessground 9.2, Stockfish 19 Lite WASM e Vitest 3.2. Os motores adversário e analista usam workers separados.

## Dados e compatibilidade

Chaves antigas de perfil, estatísticas, configurações e treino são preservadas. Novos registros:

- `xadrez-coach-active-v1`: partida ativa versionada, com PGN completo, fase e relógios.
- `xadrez-coach-history-v1`: partidas concluídas e respectivos snapshots de Elo.
- `xadrez-coach-completion-v1`: journal temporário para recuperar um encerramento interrompido sem duplicar resultados.

Estatísticas antigas sem PGN aparecem como resumos sem replay. Uma falha de gravação é informada na interface: o fallback em memória não é anunciado como persistência durável. Dados são específicos do navegador e da origem; limpar os dados do site remove seu progresso. Não há sincronização entre dispositivos. Use uma única aba para jogar.

## Banco de puzzles

O banco de treino contém **60 posições distintas**, dez por tema: mates, garfos, cravadas, ataques descobertos, peças desprotegidas e defesa. É separado das 12 posições da avaliação. Cada solução completa foi conferida com Stockfish 19 em profundidade 12; mates em um aceitam qualquer lance que dê mate.

As posições são um recorte do [banco público do Lichess](https://database.lichess.org/#puzzles), sob CC0, obtido pelo [espelho oficial Lichess no Hugging Face](https://huggingface.co/datasets/Lichess/chess-puzzles). Cada posição mantém ID, temas originais e link de origem. O app não consulta esses serviços durante o uso. `scripts/select-training.cjs` documenta a seleção e a validação a partir de arquivos locais de dados públicos.

## Offline e publicação

O build gera um Service Worker com cache versionado pelo hash dos arquivos. A instalação só conclui depois de guardar o shell, JavaScript, CSS e WASM. A navegação offline reconhece o subcaminho `/chesscoach/`. O Service Worker é registrado apenas em produção; use `npm run preview` para validar o pacote offline.

O build embute o `apple-touch-icon` PNG de 180 × 180 no HTML para a instalação no iPhone; o arquivo PNG separado continua disponível. O hash do cache também considera HTML, ícone e manifesto.

A primeira carga completa exige internet. Instale no iPhone pelo Safari: Compartilhar → Adicionar à Tela de Início. A validação em iPhone físico/Safari e da retomada após o iOS encerrar o processo continua pendente no aparelho físico.

O GitHub Pages atualiza automaticamente após push em `main`. Victor autorizou o push e a publicação desta reformulação em 03/11/2026.
