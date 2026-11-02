// ============================================================
// Roseller Admin — static server + Firebase Admin SDK bridge
// ============================================================
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert(require('./service-account.json'))
});

const PORT = 8001;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const urlPath = (req.url || '/').split('?')[0];

  // ---------- API: list all Firebase users ----------
  if (urlPath === '/api/firebase-users' && req.method === 'GET') {
    try {
      const result = await admin.auth().listUsers(1000);
      const users = result.users.map(u => ({
        uid: u.uid,
        email: u.email || null,
        displayName: u.displayName || null,
        photoURL: u.photoURL || null,
        created: u.metadata.creationTime,
        lastSignIn: u.metadata.lastSignInTime,
        role: (u.customClaims && u.customClaims.role) || null
      }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(users));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ---------- API: set role claim on a Firebase user ----------
  if (urlPath === '/api/set-claim' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { uid } = JSON.parse(body);
        if (!uid) throw new Error('uid required');
        await admin.auth().setCustomUserClaims(uid, { role: 'authenticated' });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // ---------- API: delete a Firebase user ----------
  if (urlPath === '/api/delete-user' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { uid } = JSON.parse(body);
        if (!uid) throw new Error('uid required');
        await admin.auth().deleteUser(uid);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // ---------- Static files ----------
  let servePath = urlPath === '/' ? '/index.html' : urlPath;

  if (servePath.includes('service-account') ||
      servePath.includes('package.json') ||
      servePath.includes('package-lock') ||
      servePath.includes('node_modules')) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  const filePath = path.join(ROOT, servePath);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`✅ Roseller Admin running at http://localhost:${PORT}`);
});