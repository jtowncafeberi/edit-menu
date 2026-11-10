import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname} from 'node:path';
import worker from '../server/worker.js';
import {localDB} from '../server/local-db.js';
const root = resolve('dist/client'), DB = localDB('work/menu.sqlite');
const types = {'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.pdf':'application/pdf'};
const ASSETS = {async fetch(request) {
  const pathname = decodeURIComponent(new URL(request.url).pathname);
  const filename = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!filename.startsWith(root + '/')) return new Response('Forbidden', {status:403});
  try { return new Response(await readFile(filename), {headers:{'Content-Type':types[extname(filename)] || 'application/octet-stream'}}); } catch { return new Response('Not found', {status:404}); }
}};
createServer(async (incoming, outgoing) => {
 try {
  const request = new Request('http://' + incoming.headers.host + incoming.url, {method:incoming.method, headers:incoming.headers, ...(incoming.method === 'GET' || incoming.method === 'HEAD' ? {} : {body:incoming,duplex:'half'})});
  const response = await worker.fetch(request, {DB,ASSETS});
  outgoing.writeHead(response.status, Object.fromEntries(response.headers)); outgoing.end(Buffer.from(await response.arrayBuffer()));
 } catch (error) { outgoing.writeHead(500);outgoing.end('Local preview failed.');console.error(error); }
}).listen(5173,'127.0.0.1',()=>console.log('Menu + local shared storage: http://127.0.0.1:5173'));
