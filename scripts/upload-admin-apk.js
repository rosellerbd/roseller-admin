const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const SECRET = process.env.ADMIN_UPLOAD_SECRET;
if (!SECRET) {
  console.error('❌ Missing ADMIN_UPLOAD_SECRET env var');
  console.error('   Run: export ADMIN_UPLOAD_SECRET="your-secret"');
  process.exit(1);
}

const root     = path.join(__dirname, '..');
const gradle   = path.join(root, 'android', 'app', 'build.gradle');
const notes    = path.join(root, 'release-notes.txt');
const apkPath  = path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');

if (!fs.existsSync(apkPath)) {
  console.error('❌ APK not built:', apkPath);
  console.error('   Run: npm run build:apk');
  process.exit(1);
}

const gContent = fs.readFileSync(gradle, 'utf8');
const vCode = Number(gContent.match(/versionCode\s+(\d+)/)[1]);
const vName = gContent.match(/versionName\s+"([^"]+)"/)[1];
const relNotes = fs.existsSync(notes) ? fs.readFileSync(notes, 'utf8').trim() : '';
const sizeMB = (fs.statSync(apkPath).size / 1024 / 1024).toFixed(2);

console.log('');
console.log('  📦 Release: ' + vName + ' (versionCode ' + vCode + ')');
console.log('  📱 APK:     ' + sizeMB + ' MB');
console.log('');

// Resolve GitHub repo
let repo;
try {
  repo = execSync('gh repo view --json nameWithOwner -q .nameWithOwner', { cwd: root, stdio: 'pipe' }).toString().trim();
} catch (e) {
  console.error('❌ Not a GitHub repo. Run: gh repo create <name> --public --source=. --push');
  process.exit(1);
}
console.log('  🐙 Repo: ' + repo);

const tag = 'v' + vName + '-' + vCode;
console.log('  🏷  Tag:  ' + tag);
console.log('');

// Create/update release
console.log('  ⬆  Uploading APK to GitHub Releases...');
try {
  try {
    execSync('gh release create ' + tag + ' --title "v' + vName + '" --notes "' + relNotes.replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"', { cwd: root, stdio: 'pipe' });
  } catch (e) {
    // Release may exist
  }
  execSync('gh release upload ' + tag + ' "' + apkPath + '" --clobber', { cwd: root, stdio: 'inherit' });
  console.log('  ✅ APK uploaded');
} catch (err) {
  console.error('❌ GitHub upload failed:', err.message);
  process.exit(1);
}

const apkUrl = 'https://github.com/' + repo + '/releases/download/' + tag + '/app-release.apk';
console.log('  🔗 ' + apkUrl);
console.log('');

// Verify the URL is reachable before storing it
console.log('  🔍 Verifying URL is reachable...');
https.get(apkUrl, (res) => {
  // 302 from GitHub is normal (redirects to CDN). Any 2xx or 3xx = good.
  if (res.statusCode >= 200 && res.statusCode < 400) {
    console.log('  ✅ URL responds: HTTP ' + res.statusCode);
    res.destroy();
    publishMetadata(apkUrl);
  } else {
    console.error('  ❌ URL returned HTTP ' + res.statusCode);
    res.resume();
    process.exit(1);
  }
}).on('error', (e) => {
  console.error('  ❌ URL unreachable: ' + e.message);
  process.exit(1);
});

function publishMetadata(apkUrl) {
  console.log('');
  console.log('  📡 Publishing metadata to Worker...');

  const body = JSON.stringify({
    secret: SECRET,
    versionCode: vCode,
    versionName: vName,
    notes: relNotes,
    apkUrl: apkUrl,
  });

  const req = https.request({
    hostname: 'roseller-cdn.rainfowbd-dev.workers.dev',
    path: '/admin/upload',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  }, (res) => {
    let out = '';
    res.on('data', (c) => out += c);
    res.on('end', () => {
      if (res.statusCode === 200) {
        console.log('  ✅ Metadata published');
        console.log('');
        console.log('  ═══════════════════════════════════════════════');
        console.log('   RELEASE LIVE');
        console.log('   Version:  ' + vName + ' (' + vCode + ')');
        console.log('   Metadata: https://roseller-cdn.rainfowbd-dev.workers.dev/admin/version.json');
        console.log('   APK:      https://roseller-cdn.rainfowbd-dev.workers.dev/admin/latest.apk');
        console.log('  ═══════════════════════════════════════════════');
        console.log('');
      } else {
        console.error('  ❌ Publish failed (' + res.statusCode + '): ' + out);
        process.exit(1);
      }
    });
  });
  req.on('error', (e) => { console.error('  ❌ ' + e.message); process.exit(1); });
  req.write(body);
  req.end();
}
