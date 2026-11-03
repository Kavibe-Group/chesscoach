const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
(async()=>{
 const source=readFileSync('dist/sw.js','utf8');const handlers={};let requested=[];let deleted=[];let fail=false;let activated=false;
 const context={URL,Response,console,self:{registration:{scope:'https://example.test/chesscoach/'},addEventListener:(name,cb)=>handlers[name]=cb,skipWaiting:()=>{activated=true},clients:{claim:()=>{}}},caches:{open:async()=>({addAll:async urls=>{requested=urls;if(fail)throw Error('missing shell asset')},put:async()=>{}}),keys:async()=>['other-app','xadrez-coach-v2'],delete:async key=>deleted.push(key),match:async url=>url==='https://example.test/chesscoach/index.html'?new Response('offline app'):undefined},fetch:async()=>{throw Error('offline')}};
 vm.runInNewContext(source,context);
 let pending;handlers.install({waitUntil:p=>pending=p});await pending;
 assert(activated);assert(requested.some(p=>p.endsWith('.wasm')));assert(requested.some(p=>/assets\/index-.*\.js$/.test(p)));assert(requested.some(p=>p.endsWith('.css')));assert(requested.every(p=>p.startsWith('https://example.test/chesscoach/')));
 handlers.activate({waitUntil:p=>pending=p});await pending;assert.deepEqual(deleted,['xadrez-coach-v2']);
 let response;handlers.fetch({request:{url:'https://example.test/chesscoach/#training',mode:'navigate'},respondWith:p=>response=p});assert.equal(await (await response).text(),'offline app');
 activated=false;fail=true;handlers.install({waitUntil:p=>pending=p});await assert.rejects(pending);assert.equal(activated,false);
 console.log('Offline verification passed: versioned shell, scripts, CSS and WASM; subpath fallback; atomic install; scoped cache cleanup.');
})().catch(error=>{console.error(error);process.exitCode=1});
