// ============================================================
// copy-static.js — copy web assets into dist/ for Capacitor
// Run: node copy-static.js
// ============================================================
const fs = require('fs');
const path = require('path');

const SRC = __dirname;
const DIST = path.join(__dirname, 'dist');

if (fs.existsSync(DIST)) {
  fs.rmSync(DIST, { recursive: true, force: true });
}
fs.mkdirSync(DIST, { recursive: true });

const files = ['index.html'];
for (const f of files) {
  const src = path.join(SRC, f);
  if (!fs.existsSync(src)) {
    console.error('Missing: ' + f);
    process.exit(1);
  }
  fs.copyFileSync(src, path.join(DIST, f));
  console.log('  ok ' + f);
}

const folders = ['js', 'assets'];
for (const d of folders) {
  const src = path.join(SRC, d);
  if (!fs.existsSync(src)) {
    console.error('Missing folder: ' + d);
    process.exit(1);
  }
  fs.cpSync(src, path.join(DIST, d), { recursive: true });
  console.log('  ok ' + d + '/');
}

let totalBytes = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else totalBytes += fs.statSync(full).size;
  }
}
walk(DIST);

console.log('');
console.log('dist/ built');
console.log('   ' + (totalBytes / 1024).toFixed(1) + ' KB');
console.log('   Output: ' + DIST);
