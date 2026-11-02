const fs = require('fs');
const path = require('path');
const https = require('https');

// ============================================================
// Reads versionCode/versionName from android/app/build.gradle,
// reads release-notes.txt, base64-encodes the built APK, POSTs
// everything to the Cloudflare Worker's /admin/upload.
// ============================================================

const ADMIN_UPLOAD_SECRET = process.env.ADMIN_UPLOAD_SECRET;
if (!ADMIN_UPLOAD_SECRET) {
  console.error('');
  console.error('❌ Missing ADMIN_UPLOAD_SECRET env var.');
  console.error('');
  console.error('   Run this once in your shell:');
  console.error('     export ADMIN_UPLOAD_SECRET="roseller_admin_upload_..."');
  console.error('   (use the value you set in Cloudflare Worker Secrets)');
  console.error('');
  process.exit(1);
}

const gradlePath = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
const notesPath  = path.join(__dirname, '..', 'release-notes.txt');
const apkPath    = path.join(__dirname, '..', 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');

if (!fs.existsSync(gradlePath)) { console.error('❌ Missing:', gradlePath); process.exit(1); }
if (!fs.existsSync(apkPath))    { console.error('❌ Missing APK at', apkPath, '— run "npm run build:apk" first'); process.exit(1); }

const gradle = fs.readFileSync(gradlePath, 'utf8');
const versionCodeMatch = gradle.match(/versionCode\s+(\d+)/);
const versionNameMatch = gradle.match(/versionName\s+"([^"]+)"/);

if (!versionCodeMatch || !versionNameMatch) {
  console.error('❌ Could not parse versionCode/versionName from build.gradle');
  process.exit(1);
}

const versionCode = Number(versionCodeMatch[1]);
const versionName = versionNameMatch[1];
const notes = fs.existsSync(notesPath) ? fs.readFileSync(notesPath, 'utf8').trim() : '';

const apkSizeMB = (fs.statSync(apkPath).size / 1024 / 1024).toFixed(2);

console.log('');
console.log('  versionName:', versionName);
console.log('  versionCode:', versionCode);
console.log('  APK size:   ', apkSizeMB, 'MB');
console.log('  uploading...');

const apkBase64 = fs.readFileSync(apkPath).toString('base64');
const payload = JSON.stringify({
  secret: ADMIN_UPLOAD_SECRET,
  versionCode,
  versionName,
  notes,
  apkBase64
});

const req = https.request({
  hostname: 'roseller-cdn.rainfowbd-dev.workers.dev',
  path: '/admin/upload',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, res => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('');
      console.log('  ✅ Uploaded successfully');
      console.log('  ', body);
      console.log('');
    } else {
      console.error('');
      console.error('  ❌ Upload failed (' + res.statusCode + '):', body);
      console.error('');
      process.exit(1);
    }
  });
});

req.on('error', e => {
  console.error('❌ Network error:', e.message);
  process.exit(1);
});

req.write(payload);
req.end();