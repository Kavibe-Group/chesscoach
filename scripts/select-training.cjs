// Development-only selector. Input: public CC0 rows from the official Lichess
// dataset mirror; no network calls are made by the app or this script.
const fs=require('node:fs'); const {Chess}=require('chess.js'); const sf=require('stockfish');
let listener=()=>{};const engine=sf('asm', line=>listener(line));
const command=(cmd,re)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Stockfish timeout')),30000);listener=line=>{if(re.test(line)){clearTimeout(timer);resolve(line)}};engine.processCommand(cmd)});
async function evaluate(fen){let result={};return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('timeout')),30000);listener=line=>{if(line.startsWith('info')&&line.includes(' pv ')){const cp=line.match(/score cp (-?\d+)/);const mate=line.match(/score mate (-?\d+)/);result={score:cp?+cp[1]:0,mate:mate?+mate[1]:null,pv:line.split(' pv ')[1].split(' ')}}if(line.startsWith('bestmove')){clearTimeout(timer);resolve({...result,bestMove:line.split(' ')[1]})}};engine.processCommand('position fen '+fen);engine.processCommand('go depth 12')})}
(async()=>{
 await command('uci',/^uciok$/);await command('isready',/^readyok$/);
 const rows=process.argv.slice(2).flatMap(p=>JSON.parse(fs.readFileSync(p)).rows.map(r=>r.row));
 const themes={mateIn1:'mate_perdido',fork:'garfo',pin:'cravada',discoveredAttack:'ataque_descoberto',hangingPiece:'peca_pendurada',defensiveMove:'defesa'};
 const explanations={mate_perdido:'Encontre o xeque que deixa o rei adversário sem resposta legal.',garfo:'Procure um ataque duplo: uma única peça cria duas ameaças.',cravada:'Observe a peça que não pode se mover sem expor um alvo atrás dela.',ataque_descoberto:'Procure liberar a linha de ataque de uma peça ao mover outra.',peca_pendurada:'Identifique uma peça que pode ser capturada sem compensação suficiente.',defesa:'Encontre a resposta que enfrenta a ameaça e preserva sua posição.'};
 const selected=[]; const used=new Set();
 for(const [tag,category] of Object.entries(themes)){
 let count=0;
 const candidates=rows.filter(r=>r.Themes.includes(tag)&&r.Rating>=700&&r.Rating<=1800&&r.Popularity>=80&&r.Moves.split(' ').length<=6).sort((a,b)=>Math.abs(a.Rating-1200)-Math.abs(b.Rating-1200));
 for(const r of candidates){
 if(count===10)break;if(used.has(r.PuzzleId))continue;
 const chess=new Chess(r.FEN);const moves=r.Moves.split(' ');const play=m=>chess.move({from:m.slice(0,2),to:m.slice(2,4),promotion:m[4]});
 try{play(moves[0]);const fen=chess.fen();let valid=true;const sans=[];
 for(let i=1;i<moves.length;i++){
 if(i%2===1){const e=await evaluate(chess.fen());const test=new Chess(chess.fen());test.move({from:moves[i].slice(0,2),to:moves[i].slice(2,4),promotion:moves[i][4]});if(e.bestMove!==moves[i]&&!test.isCheckmate()){valid=false;break;}}
 sans.push(play(moves[i]).san);
 }
 if(!valid)continue;
 const first=new Chess(fen).move({from:moves[1].slice(0,2),to:moves[1].slice(2,4),promotion:moves[1][4]});
 selected.push({id:'lichess-'+r.PuzzleId,fen,bestMove:moves[1],bestMoveSan:first.san,solution:moves.slice(1),category,rating:r.Rating,explanation:explanations[category]+' Continuação verificada: '+sans.join(' → ')+'.',source:'https://lichess.org/training/'+r.PuzzleId,themes:r.Themes});used.add(r.PuzzleId);count++;console.log(category,count,r.PuzzleId);
 }catch(err){console.log('skip',r.PuzzleId,err.message)}
 }
 if(count!==10)throw Error('Insufficient validated puzzles for '+category+': '+count);
 }
 fs.writeFileSync('src/data/trainingPuzzles.ts','// Lichess database, CC0. Selected and verified with Stockfish 19 at depth 12.\n// https://database.lichess.org/#puzzles\nexport const TRAINING_PUZZLES = '+JSON.stringify(selected,null,2)+' as const;\n');
 engine.terminate?.();process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
