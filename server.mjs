// Servidor apenas para desenvolvimento, sem bibliotecas externas.
// Serve a pasta public/ e imita a rota /api/time da Vercel (api/time.js).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./public/', import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

// Só estes tipos são servidos; qualquer outro arquivo responde 404.
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) {
    send(res, 405, undefined, { Allow: 'GET, HEAD' });
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    send(res, 400, 'Endereço inválido.');
    return;
  }

  // Mesma resposta de api/time.js: a hora do servidor em milissegundos.
  if (pathname === '/api/time') {
    send(res, 200, JSON.stringify({ timestamp: Date.now() }), { 'Content-Type': 'application/json; charset=utf-8' });
    return;
  }

  if (pathname.includes('\0')) {
    send(res, 400, 'Endereço inválido.');
    return;
  }

  // Resolve dentro de public/ e recusa qualquer caminho que escape dela.
  let target = join(root, normalize(pathname));
  if (target !== root && !target.startsWith(root)) {
    send(res, 404, 'Não encontrado');
    return;
  }

  try {
    const info = await stat(target);
    if (info.isDirectory()) {
      if (!pathname.endsWith('/')) {
        send(res, 308, undefined, { Location: pathname + '/' });
        return;
      }
      target = join(target, 'index.html');
    }
    const type = types[extname(target).toLowerCase()];
    if (!type) {
      send(res, 404, 'Não encontrado');
      return;
    }
    const bytes = await readFile(target);
    send(res, 200, req.method === 'HEAD' ? undefined : bytes, { 'Content-Type': type });
  } catch (error) {
    if (error && error.code === 'ENOENT') send(res, 404, 'Não encontrado');
    else send(res, 500, 'Não foi possível ler o arquivo.');
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Boss Watch: http://127.0.0.1:${PORT} — Ctrl+C para encerrar.`);
});
