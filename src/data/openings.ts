/**
 * Dicionário e identificador de aberturas de xadrez em Português (PT-BR).
 * Ajuda o jogador intermediário a reconhecer a abertura que está jogando.
 */

export interface OpeningInfo {
  eco: string;
  name: string;
  moves: string[]; // Sequência em SAN
  description: string;
}

export const OPENINGS_DATABASE: OpeningInfo[] = [
  // 1. e4 e5
  {
    eco: 'C50',
    name: 'Abertura Italiana (Giuoco Piano)',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'],
    description: 'Desenvolvimento harmonioso das peças leves visando o ponto fraco f7.',
  },
  {
    eco: 'C55',
    name: 'Defesa Dois Cavalos',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'],
    description: 'Contra-ataque dinâmico das pretas pressionando o peão de e4.',
  },
  {
    eco: 'C50',
    name: 'Abertura Italiana',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
    description: 'Uma das aberturas mais clássicas, priorizando desenvolvimento rápido.',
  },
  {
    eco: 'C60',
    name: 'Abertura Espanhola (Ruy Lopez)',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'],
    description: 'Pressiona o cavalo de c6 para exercer controle indireto sobre o centro.',
  },
  {
    eco: 'C45',
    name: 'Abertura Escocesa',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4'],
    description: 'Ruptura central direta logo no terceiro lance das brancas.',
  },
  {
    eco: 'C47',
    name: 'Abertura dos Quatro Cavalos',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Nc3', 'Nf6'],
    description: 'Estrutura simétrica e sólida com desenvolvimento dos 4 cavalos.',
  },
  {
    eco: 'C42',
    name: 'Defesa Petroff (Russa)',
    moves: ['e4', 'e5', 'Nf3', 'Nf6'],
    description: 'As pretas ignoram o peão atacado e contra-atacam e4.',
  },
  {
    eco: 'C40',
    name: 'Gambito do Rei',
    moves: ['e4', 'e5', 'f4'],
    description: 'Sacrifício clássico e agressivo do peão da ala do rei para abrir colunas.',
  },
  {
    eco: 'C41',
    name: 'Defesa Philidor',
    moves: ['e4', 'e5', 'Nf3', 'd6'],
    description: 'Defesa sólida, porém passiva, que limita a saída do bispo de f8.',
  },

  // 1. e4 c5 (Siciliana)
  {
    eco: 'B90',
    name: 'Defesa Siciliana (Variante Najdorf)',
    moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'],
    description: 'Uma das armas mais afiadas e populares de contra-ataque das pretas.',
  },
  {
    eco: 'B70',
    name: 'Defesa Siciliana (Variante Dragão)',
    moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'g6'],
    description: 'Fianchetto do bispo em g7 visando diagonais afiadas.',
  },
  {
    eco: 'B22',
    name: 'Defesa Siciliana (Variante Alapin)',
    moves: ['e4', 'c5', 'c3'],
    description: 'Prepara d4 com apoio de peão, evitando as linhas abertas da Siciliana.',
  },
  {
    eco: 'B20',
    name: 'Defesa Siciliana',
    moves: ['e4', 'c5'],
    description: 'Luta assimétrica pelo centro desde o primeiro lance.',
  },

  // 1. e4 outras
  {
    eco: 'C00',
    name: 'Defesa Francesa',
    moves: ['e4', 'e6'],
    description: 'Estrutura sólida de peões visando a ruptura central em d5.',
  },
  {
    eco: 'B10',
    name: 'Defesa Caro-Kann',
    moves: ['e4', 'c6'],
    description: 'Defesa extremamente sólida que prepara d5 sem bloquear o bispo de c8.',
  },
  {
    eco: 'B01',
    name: 'Defesa Escandinava',
    moves: ['e4', 'd5'],
    description: 'Desafio imediato ao peão de e4 no lance 1.',
  },
  {
    eco: 'B07',
    name: 'Defesa Pirc',
    moves: ['e4', 'd6', 'd4', 'Nf6'],
    description: 'Estratégia hipermoderna: cede o centro para atacá-lo depois.',
  },

  // 1. d4 d5
  {
    eco: 'D30',
    name: 'Gambito da Dama Recusado',
    moves: ['d4', 'd5', 'c4', 'e6'],
    description: 'Firmeza e solidez clássica defendendo o ponto forte em d5.',
  },
  {
    eco: 'D20',
    name: 'Gambito da Dama Aceito',
    moves: ['d4', 'd5', 'c4', 'dxc4'],
    description: 'As pretas cedem o centro temporariamente para buscar contra-jogo nas alas.',
  },
  {
    eco: 'D10',
    name: 'Defesa Eslava',
    moves: ['d4', 'd5', 'c4', 'c6'],
    description: 'Sustenta o centro mantendo livre a diagonal do bispo de casas claras.',
  },
  {
    eco: 'D02',
    name: 'Sistema Londres',
    moves: ['d4', 'd5', 'Bf4'],
    description: 'Esquema de desenvolvimento flexível e seguro com o bispo fora da cadeia de peões.',
  },
  {
    eco: 'D00',
    name: 'Gambito da Dama',
    moves: ['d4', 'd5', 'c4'],
    description: 'Abertura fundamental que busca desviar o peão preto de d5 para dominar o centro.',
  },

  // 1. d4 Nf6
  {
    eco: 'E60',
    name: 'Defesa Índia do Rei',
    moves: ['d4', 'Nf6', 'c4', 'g6'],
    description: 'Contra-ataque hipermoderno com planos dinâmicos na ala do rei.',
  },
  {
    eco: 'E20',
    name: 'Defesa Nimzoíndia',
    moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'],
    description: 'Cravada do cavalo de c3 para controlar a casa central e4.',
  },
  {
    eco: 'A45',
    name: 'Ataque Torre',
    moves: ['d4', 'Nf6', 'Nf3', 'e6', 'Bg5'],
    description: 'Desenvolve o bispo ativamente antes de fechar a cadeia com e3.',
  },

  // Flanco / Outras
  {
    eco: 'A10',
    name: 'Abertura Inglesa',
    moves: ['c4'],
    description: 'Controle posicional da casa d5 através do flanco da dama.',
  },
  {
    eco: 'A04',
    name: 'Abertura Réti',
    moves: ['Nf3'],
    description: 'Desenvolvimento flexível que mantém todas as opções abertas.',
  },
  {
    eco: 'A02',
    name: 'Abertura Bird',
    moves: ['f4'],
    description: 'Tenta controlar e5 diretamente com o peão de f.',
  },
];

/**
 * Detecta a abertura mais específica correspondente à sequência de lances executada.
 * Compara por correspondência de prefixo do histórico SAN.
 */
export function detectOpening(sanMoves: string[]): OpeningInfo | null {
  if (!sanMoves || sanMoves.length === 0) return null;

  // Normaliza SAN (remove anotações como +, #, etc para garantir correspondência robusta)
  const cleanMoves = sanMoves.map(m => m.replace(/[+#?!]/g, ''));

  let bestMatch: OpeningInfo | null = null;
  let maxMatchedLength = 0;

  for (const opening of OPENINGS_DATABASE) {
    if (opening.moves.length > cleanMoves.length) continue;

    let matches = true;
    for (let i = 0; i < opening.moves.length; i++) {
      if (cleanMoves[i] !== opening.moves[i]) {
        matches = false;
        break;
      }
    }

    if (matches && opening.moves.length > maxMatchedLength) {
      maxMatchedLength = opening.moves.length;
      bestMatch = opening;
    }
  }

  return bestMatch;
}
