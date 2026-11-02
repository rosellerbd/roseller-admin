// ============================================================
// Roseller — auth.js (native Google Sign-In for APK)
// Uses @codetrix-studio/capacitor-google-auth bundled in /assets/vendor/
// ============================================================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signInWithRedirect,
  getRedirectResult,
  setPersistence,
  browserLocalPersistence,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const app = initializeApp(window.ROSELLER_FIREBASE_CONFIG);
const auth = getAuth(app);

setPersistence(auth, browserLocalPersistence).catch(() => {});

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

let _user = null, _resolve;
const _ready = new Promise(r => { _resolve = r; });

onAuthStateChanged(auth, u => {
  _user = u;
  _resolve(u);
  document.dispatchEvent(new CustomEvent('auth:changed', { detail: { user: u } }));
});

getRedirectResult(auth).catch((err) => {
  console.error('[auth redirect]', err?.code, err?.message);
});

const isCapacitor = () =>
  window.Capacitor ||
  location.protocol === 'capacitor:' ||
  location.protocol === 'ionic:' ||
  /wv|WebView/i.test(navigator.userAgent);

// ============================================================
// Rewrite the plugin imports to local vendor files
// @capacitor/core is imported by both plugin files — we need
// to intercept those imports before loading the plugin.
// ============================================================
async function loadGoogleAuthPlugin() {
  // The plugin files use `import { registerPlugin } from '@capacitor/core'`
  // which won't resolve in the WebView. We use a blob URL shim to rewrite
  // the import path before loading.
  try {
    const coreMod  = await import('/assets/vendor/capacitor-core.js');
    const webMod   = await import('/assets/vendor/capacitor-google-auth-web.js');
    const defMod   = await import('/assets/vendor/capacitor-google-auth-definitions.js');

    // Build a GoogleAuth object manually using the web implementation
    const GoogleAuthWeb = webMod.GoogleAuthWeb;
    if (!GoogleAuthWeb) throw new Error('GoogleAuthWeb class not found');

    // The web implementation needs registerPlugin to be provided
    // In Capacitor APK, window.Capacitor.Plugins.GoogleAuth is already
    // registered natively, so we use that directly instead of the web shim
    if (window.Capacitor?.Plugins?.GoogleAuth) {
      return window.Capacitor.Plugins.GoogleAuth;
    }

    // Fallback: instantiate the web class (works only in browser)
    const instance = new GoogleAuthWeb();
    return instance;
  } catch (e) {
    console.error('[auth] Failed to load plugin files:', e);
    throw e;
  }
}

let nativeGoogleAuth = null;

async function getNativeAuth() {
  if (nativeGoogleAuth !== null) return nativeGoogleAuth;
  if (!isCapacitor()) { nativeGoogleAuth = false; return false; }
  try {
    // Prefer the native bridge if available (Capacitor auto-registers plugins)
    let GoogleAuth = window.Capacitor?.Plugins?.GoogleAuth;

    if (!GoogleAuth) {
      // Load from vendor files
      GoogleAuth = await loadGoogleAuthPlugin();
    }

    if (!GoogleAuth) throw new Error('GoogleAuth plugin not found');

    await GoogleAuth.initialize({
      clientId: window.ROSELLER_FIREBASE_CONFIG.clientId || '',
      scopes: ['profile', 'email'],
      grantOfflineAccess: false,
    });
    nativeGoogleAuth = GoogleAuth;
    console.log('[auth] GoogleAuth plugin initialized');
    return GoogleAuth;
  } catch (e) {
    console.error('[auth] GoogleAuth init failed:', e);
    nativeGoogleAuth = false;
    return false;
  }
}

async function loginNative() {
  const GoogleAuth = await getNativeAuth();
  if (!GoogleAuth) {
    alert('Google Sign-In plugin unavailable. Reinstall the app.');
    return;
  }
  try {
    const googleUser = await GoogleAuth.signIn();
    console.log('[auth] googleUser:', googleUser?.email);

    const idToken     = googleUser?.authentication?.idToken;
    const accessToken = googleUser?.authentication?.accessToken;

    if (!idToken) {
      console.error('[auth] No idToken in response:', googleUser);
      alert('Google sign-in did not return an ID token.');
      return;
    }

    const credential = GoogleAuthProvider.credential(idToken, accessToken);
    const result = await signInWithCredential(auth, credential);
    console.log('[auth] Firebase sign-in OK:', result.user?.email);
  } catch (err) {
    const msg = err?.message || String(err);
    if (/cancel/i.test(msg)) { console.log('[auth] user cancelled'); return; }
    console.error('[auth native]', err);
    alert('Sign in failed: ' + msg);
  }
}

async function login() {
  if (isCapacitor()) {
    await loginNative();
    return;
  }
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    if ([
      'auth/popup-blocked',
      'auth/popup-closed-by-user',
      'auth/operation-not-supported-in-this-environment',
    ].includes(err?.code)) {
      await signInWithRedirect(auth, provider);
    } else {
      console.error('[auth login]', err);
      throw err;
    }
  }
}

window.RosellerAuth = {
  get currentUser() { return _user; },
  login,
  logout: async () => {
    if (isCapacitor()) {
      const GoogleAuth = await getNativeAuth();
      if (GoogleAuth) await GoogleAuth.signOut().catch(() => {});
    }
    await signOut(auth);
  },
  onReady: cb => _ready.then(cb)
};
