// Tiny zero-dependency Node HTTP server. Serves the freshly built
// `..\build\` directory and reverse-proxies any path that doesn't exist
// as a static file (e.g. /casting/, /<infoHash>/0, /settings, /device-info)
// to Stremio's streaming server on 127.0.0.1:11470. Same-origin keeps CORS
// out of the picture entirely.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', 'build');
const PORT = 11471;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.wasm': 'application/wasm',
    '.map': 'application/octet-stream',
};

function safeUnder(root, candidate) {
    const r = path.resolve(root) + path.sep;
    const c = path.resolve(candidate);
    return (c + path.sep).startsWith(r) || c === path.resolve(root);
}

// Anything that exists as a file under ROOT is served directly. Anything
// that doesn't (e.g. /casting/, /settings, /<infoHash>/<idx>) is reverse-
// proxied to the streaming server on 11470. This keeps web + streaming-
// server APIs on the same origin so CORS isn't needed.
const STREAMING_HOST = '127.0.0.1';
const STREAMING_PORT = 11470;

function proxyToStreamingServer(req, res) {
    const opts = {
        host: STREAMING_HOST, port: STREAMING_PORT,
        method: req.method, path: req.url,
        headers: { ...req.headers, host: `${STREAMING_HOST}:${STREAMING_PORT}` },
    };
    const upstream = http.request(opts, (upRes) => {
        // Copy upstream headers but force a permissive CORS response so any
        // future cross-origin XHR also works without surprise.
        const headers = { ...upRes.headers, 'access-control-allow-origin': '*' };
        res.writeHead(upRes.statusCode || 502, headers);
        upRes.pipe(res);
    });
    upstream.on('error', (e) => {
        res.writeHead(502, { 'content-type': 'text/plain' });
        res.end('upstream error: ' + e.message);
    });
    req.pipe(upstream);
}

const server = http.createServer((req, res) => {
    const method = req.method;
    if (method !== 'GET' && method !== 'HEAD' && method !== 'POST' && method !== 'OPTIONS' && method !== 'PUT' && method !== 'DELETE') {
        res.writeHead(405); res.end('method not allowed'); return;
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');

    // Root → index.html
    if (rel === '') {
        return serveFile(req, res, path.join(ROOT, 'index.html'));
    }

    // If the path corresponds to an actual file under build/, serve it.
    const candidate = path.join(ROOT, rel);
    if (safeUnder(ROOT, candidate) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return serveFile(req, res, candidate);
    }

    // Otherwise, proxy to the streaming server.
    proxyToStreamingServer(req, res);
});

function serveFile(req, res, candidate) {
    const ext = path.extname(candidate).toLowerCase();
    const ct = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {
        'Content-Type': ct,
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
    });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(candidate).pipe(res);
}

server.listen(PORT, '127.0.0.1', () => {
    console.log(`static_serve: http://127.0.0.1:${PORT}/  (root: ${ROOT})`);
});
