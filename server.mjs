// Servidor apenas para desenvolvimento, sem bibliotecas externas.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/bosses.js', ['bosses.js', 'text/javascript; charset=utf-8']],
  ['/sw.js', ['sw.js', 'text/javascript; charset=utf-8']],
  ['/manifest.webmanifest', ['manifest.webmanifest', 'application/manifest+json']],
  ['/icons/portal.svg', ['icons/portal.svg', 'image/svg+xml']],
  ['/icons/portal-192.png', ['icons/portal-192.png', 'image/png']],
  ['/icons/portal-512.png', ['icons/portal-512.png', 'image/png']]
]);
createServer(async (req, res) => {
  // Lista explícita: nunca expor outros arquivos do computador.
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return;
  }
  const file = files.get(new URL(req.url, 'http://localhost').pathname);
  if (!file) { res.writeHead(404); res.end('Não encontrado'); return; }
  try {
    const bytes = await readFile(new URL('./public/' + file[0], import.meta.url));
    res.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch { res.writeHead(500); res.end('Não foi possível ler o arquivo.'); }
}).listen(3000, '127.0.0.1', () => {
  console.log('Boss Watch: http://127.0.0.1:3000 — Ctrl+C para encerrar.');
});
