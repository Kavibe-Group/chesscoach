# Xadrez Coach — Treinador Pessoal

Um aplicativo de xadrez **somente contra a máquina** que atua como um treinador pessoal completo:
1. **Avaliação Inicial:** Bateria de 12 posições táticas (validadas pelo motor) + estimativa precisa de faixa de Elo.
2. **Feedback Pós-Lance em Tempo Real:** Análise instantânea após cada lance do jogador com selo de qualidade, perda em centipeões, explicação em linguagem natural (baseada estritamente em fatos verificáveis) e opção de **refazer o lance** diante de erros graves.
3. **Revisão Pós-Partida:** Precisão percentual, ACPL (perda média), os 3 momentos mais caros e minilição personalizada baseada no padrão de erro dominante.
4. **Treino dos Próprios Erros:** Fila dinâmica gerada a partir das posições reais das suas partidas onde você errou. Acerte o melhor lance duas vezes consecutivas para dominar o exercício.
5. **Dificuldade Adaptativa:** A força do motor Stockfish acompanha a sua evolução, mantendo-se sempre ligeiramente acima do seu nível (zona de aprendizado).

> **100% Local, Custo $0, Sem Contas e Sem Dependências Externas.**
> Toda a computação (incluindo o motor Stockfish 19 WASM) roda inteiramente no seu navegador via Web Worker.

---

## 🚀 Como Rodar o Projeto

### Pré-requisitos
- Node.js (v18 ou superior)
- npm

### 1. Instalação das dependências
```bash
npm install
```

### 2. Executar em modo de desenvolvimento
```bash
npm run dev
```
O Vite iniciará o servidor local (geralmente em `http://localhost:5173`). Abra o endereço no seu navegador.

### 3. Rodar a suíte completa de testes
```bash
npm test
```
Executa os 44 testes automatizados cobrindo regras (chess.js), validação de puzzles no Stockfish, wrapper UCI, classificador de lances, avaliação de nível e progressão de treino.

### 4. Gerar o build de produção
```bash
npm run build
```
Gera a pasta `dist/` estática, pronta para publicação em qualquer servidor estático (GitHub Pages, Cloudflare Pages, Vercel, Netlify, Nginx, etc.).

Para visualizar o build gerado localmente:
```bash
npm run preview
```

---

## 💾 Onde Ficam Armazenados Perfil e Dados?

Todos os dados são persistidos no **`localStorage`** do navegador do usuário. Não há backend nem envio de telemetria.

As chaves utilizadas são:
- `xadrez-coach-profile`: Perfil do jogador (Elo estimado, histórico de evolução, partidas jogadas, precisão média, categorias de erros).
- `xadrez-coach-stats`: Histórico detalhado das últimas partidas disputadas.
- `xadrez-coach-training`: Fila de posições reais das partidas para o modo "Treinar meus erros".
- `xadrez-coach-settings`: Configurações de tema, relógio, cor das peças e força do motor.

Para reiniciar seus dados a qualquer momento, acesse a tela de **Configurações (⚙️)** no app e clique em *"Limpar Todos os Dados e Histórico"*.

---

## ⚙️ Como Trocar a Força do Motor

A força do Stockfish é calibrada usando duas estratégias:
- **Abaixo de 1320 de Elo:** Ajuste refinado via `Skill Level` (0 a 20).
- **A partir de 1320 de Elo:** Limitação formal de força via `UCI_LimitStrength` + `UCI_Elo`.

### Modos disponíveis:
1. **Automático (Recomendado):** O motor joga no nível do seu Elo estimado **+ 50 pontos** para proporcionar um desafio leve e instrutivo.
2. **Manual:** Acesse **Configurações (⚙️)**, selecione o modo **Manual** e ajuste o controle deslizante de 800 a 2200 de Elo.

---

## 🧱 Arquitetura e Bibliotecas (Versões Fixadas)

- **Vite 8.3.4** + **TypeScript 6.0.3** (Strict)
- **chess.js 1.4.0:** Toda a validação de regras, lances legais, xeques, empates e notações FEN/PGN.
- **chessground 9.2.1:** Tabuleiro interativo open source do Lichess (arrastar, clicar, setas e destaques).
- **Stockfish 19.0.1 (WASM Lite Single-Threaded):** Motor rodando em Web Worker no navegador, sem dependência de headers de isolamento de origem.
- **Vitest 3.2.1:** Suíte de testes automatizados com cobertura completa.
