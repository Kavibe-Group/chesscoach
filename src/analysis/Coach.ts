import { Chess, type Square } from 'chess.js';
export interface ProgressiveHint { observation: string; idea: string; answer: string; move: string; frames: {fen: string; san: string}[]; }
const names: Record<string,string> = {p:'peão',n:'cavalo',b:'bispo',r:'torre',q:'dama',k:'rei'};
/** Only claims observable in the position or the legal continuation. */
export function explainPosition(fen: string, bestMove: string, pv: string[] = []): ProgressiveHint {
  const chess = new Chess(fen);
  const piece = chess.get(bestMove.slice(0,2) as Square);
  const inCheck = chess.isCheck();
  const before = new Chess(fen);
  const frames = [{fen, san:'Posição inicial'}];
  const legal = chess.move({from:bestMove.slice(0,2),to:bestMove.slice(2,4),promotion:bestMove[4]});
  const name = names[piece?.type || 'p'];
  let observation = inCheck ? 'Seu rei está em xeque. Compare as formas de sair do ataque.' : 'Antes de jogar, procure xeques, capturas e ameaças dos dois lados.';
  let idea = 'Compare a continuação das candidatas, incluindo a melhor resposta do adversário.';
  let reason = 'A preferência do motor depende da continuação. Não há uma justificativa simples comprovada nesta posição.';
  if (chess.isCheckmate()) { observation = 'Procure uma forma de tirar todas as saídas do rei adversário.'; idea = 'Um xeque pode encerrar a partida imediatamente.'; reason = 'É xeque-mate: o adversário não tem resposta legal ao xeque.'; }
  else if (legal.captured) { observation = 'Compare as capturas disponíveis e as possíveis recapturas.'; idea = `Há uma captura com ${name}; confira a resposta antes de decidir.`; reason = `Captura ${names[legal.captured]}. A continuação mostra a resposta calculada; capturar sozinho não garante ganho de material.`; }
  else if (legal.san === 'O-O' || legal.san === 'O-O-O') { observation = 'Confira a segurança do seu rei e a participação das torres.'; idea = 'Considere desenvolver a torre enquanto muda a posição do rei.'; reason = 'O roque desloca rei e torre no mesmo lance. A continuação permite avaliar a segurança resultante.'; }
  else if (legal.san.includes('+')) { idea = 'Considere um xeque que force o adversário a responder à ameaça ao rei.'; reason = 'Dá xeque. O adversário precisa eliminar esse ataque antes de executar outro plano.'; }
  else if (piece && ['n','b'].includes(piece.type) && (legal.from[1] === '1' || legal.from[1] === '8')) { observation = 'Observe quais peças menores ainda estão na primeira fileira.'; idea = 'Considere colocar uma peça menor em atividade.'; reason = `Retira o ${name} da primeira fileira. Esse é um fato da posição; a preferência exata depende da continuação.`; }
  else {
    const opponent = legal.color === 'w' ? 'b' : 'w';
    const targets = chess.board().flat().filter(p => p && p.color === opponent && chess.attackers(p.square, legal.color).includes(legal.to)).map(p => `${names[p!.type]} em ${p!.square}`);
    const center = (['d4','e4','d5','e5'] as Square[]).filter(square=>chess.attackers(square,legal.color).includes(legal.to));
    const gain = chess.board().flat().filter(p => p && p.color === legal.color && ['b','r','q'].includes(p.type) && p.square !== legal.to).flatMap(p => chess.board().flat().filter(t => t && t.color === opponent && chess.attackers(t.square,legal.color).includes(p!.square) && !before.attackers(t.square,legal.color).includes(p!.square)).map(t => `${names[p!.type]} em ${p!.square} passa a atacar ${names[t!.type]} em ${t!.square}`));
    if (gain.length) {
      observation = 'Observe linhas que podem ser abertas ao mover uma peça.';
      idea = 'Uma peça pode sair da frente e liberar o ataque de outra.';
      reason = gain.join('; ') + '. Confira a resposta na continuação.';
    } else if (targets.length) {
      observation = targets.length > 1 ? 'Procure uma peça capaz de criar dois ataques ao mesmo tempo.' : 'Observe os alvos que suas peças podem atacar.';
      idea = `Considere criar ${targets.length > 1 ? 'ameaças simultâneas' : 'um ataque'} com ${name}.`;
      reason = `Depois do lance, o ${name} ataca ${targets.join(' e ')}. Isso não garante captura: confira como o adversário pode responder.`;
    } else if (center.length) {
      observation = 'Compare as casas centrais controladas pelas suas peças e pelas do adversário.';
      idea = `Considere aumentar a presença de ${name} no centro.`;
      reason = `O ${name} passa a atacar ${center.join(' e ')}, no centro. Esse controle é verificável; a preferência exata do motor depende da continuação.`;
    }
  }
  frames.push({fen:chess.fen(),san:legal.san});
  const line = pv[0] === bestMove ? pv.slice(1,6) : [];
  for (const uci of line) {
    try { const m = chess.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]}); frames.push({fen:chess.fen(),san:m.san}); } catch { break; }
  }
  return {observation,idea,answer:`${legal.san}: ${reason}`,move:bestMove,frames};
}
export function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!)); }
