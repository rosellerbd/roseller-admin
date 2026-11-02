// ============================================================
// Roseller Admin — admin.js (v4)
// ============================================================
import { supabase } from './supabase.js';

const app = document.getElementById('app');
const fmtDt = s => s ? new Date(s).toLocaleString('en-BD', { dateStyle:'medium', timeStyle:'short' }) : '—';
const fmt   = n => '৳' + Number(n || 0).toLocaleString('en-BD');
const initials = name => (name || '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
const slugify = s => String(s || '').toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

function shortId(id) {
  if (!id) return '—';
  return String(id).slice(0, 8);
}

function payClass(method) {
  const m = String(method || 'cod').toLowerCase();
  if (m.includes('bkash') || m.includes('nagad')) return 'bkash';
  if (m.includes('card') || m.includes('stripe')) return 'card';
  return 'cod';
}

async function copyToClipboard(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch { return false; }
}

let currentTab = 'dashboard';
let me = null;
let productsSubView = 'list';
let editingProduct = null;
let viewingOrderId = null;      // order detail view
let viewingProductId = null;    // product detail view

const NAV = [
  {
    id: 'dashboard', label: 'Dashboard',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>`,
  },
  {
    id: 'users', label: 'Users',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  },
  {
    id: 'orders', label: 'Orders',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 12h6"/><path d="M9 16h6"/><path d="M9 8h6"/></svg>`,
  },
  {
    id: 'products', label: 'Products',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
  },
  {
    id: 'vendors', label: 'Vendors',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  },
  {
    id: 'brands', label: 'Brands',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  },
  {
    id: 'categories', label: 'Categories',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h18M3 12h18M3 17h18"/><circle cx="6" cy="7" r="1.2" fill="currentColor" stroke="none"/><circle cx="6" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="6" cy="17" r="1.2" fill="currentColor" stroke="none"/></svg>`,
  },
  {
    id: 'help', label: 'Help',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  },
];
const NAV_LABEL = Object.fromEntries(NAV.map(n => [n.id, n.label]));

const canPromote = () => !!(me && me.is_super_admin);

async function init() {
  await window.RosellerAuth.onReady();
  const fbUser = window.RosellerAuth.currentUser;
  if (!fbUser) return renderLogin();

  const { data, error } = await supabase
    .from('profiles')
    .select('id,is_admin,is_super_admin,full_name,email')
    .eq('email', fbUser.email)
    .maybeSingle();

  if (error || !data || !data.is_admin) return renderDenied();
  me = { ...data, firebase_uid: fbUser.uid };
  renderShell();
}






function renderLogin() {
  const alreadyAuthed = !!window.RosellerAuth?.currentUser;

  app.innerHTML = `
    <div class="lp-shell">

      <div class="lp-orb lp-orb-1"></div>
      <div class="lp-orb lp-orb-2"></div>
      <div class="lp-orb lp-orb-3"></div>
      <div class="lp-grid-overlay"></div>

      <main class="lp-center">
        <div class="lp-card">

          <div class="lp-brand">
            <div class="lp-brand-glow"></div>
            <img class="lp-brand-logo" src="assets/img/roseller-logo-400x400-transparent.png" alt="Roseller">
            <h1 class="lp-brand-name">Roseller</h1>
          </div>

          <div class="lp-title-block">
            <h2 class="lp-title">Admin Console</h2>
            <p class="lp-subtitle">${alreadyAuthed ? 'Your session is active' : 'Sign in to manage your store'}</p>
          </div>

          <div class="lp-actions">
            ${alreadyAuthed
              ? `<button id="continue-btn" class="lp-btn lp-btn-primary">
                   Continue to Dashboard
                 </button>
                 <button id="logout-btn" class="lp-btn lp-btn-ghost">
                   Sign out
                 </button>`
              : `<button id="login-btn" class="lp-btn lp-btn-google">
                   <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                     <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                     <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                     <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                     <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                   </svg>
                   Continue with Google
                 </button>`}

            <button id="refresh-auth-btn" class="lp-refresh">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 4 23 10 17 10"/>
                <polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              <span>Refresh session</span>
            </button>
          </div>

        </div>

        <div class="lp-footer">
          <span>Powered by</span>
          <strong>RainFow Software Systems</strong>
        </div>
      </main>

    </div>`;

  const loginBtn = document.getElementById('login-btn');
  if (loginBtn) {
    loginBtn.onclick = async () => {
      loginBtn.disabled = true;
      loginBtn.innerHTML = `<span class="lp-spinner"></span> Opening Google…`;
      try {
        await window.RosellerAuth.login();
      } catch (err) {
        console.error('[login]', err);
        loginBtn.disabled = false;
        loginBtn.innerHTML = `Continue with Google`;
        alert('Login failed: ' + (err?.message || err));
      }
    };
  }

  const continueBtn = document.getElementById('continue-btn');
  if (continueBtn) {
    continueBtn.onclick = () => {
      me = null;
      init();
    };
  }

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.onclick = () => window.RosellerAuth.logout().then(() => location.reload());
  }

  document.getElementById('refresh-auth-btn').onclick = async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.classList.add('is-spinning');
    try {
      if (window.RosellerAuth.currentUser) {
        me = null;
        init();
      } else {
        await new Promise(r => setTimeout(r, 800));
        if (window.RosellerAuth.currentUser) {
          me = null;
          init();
        } else {
          alert('Not signed in. Please tap "Continue with Google".');
        }
      }
    } finally {
      btn.disabled = false;
      btn.classList.remove('is-spinning');
    }
  };
}

function renderDenied() {
  app.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <h1>🔒 Access Denied</h1>
        <p>${window.RosellerAuth.currentUser.email} is not an admin.</p>
        <button id="logout-btn" style="width:100%;padding:12px;background:#e53935;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;">Sign out</button>
      </div>
    </div>`;
  document.getElementById('logout-btn').onclick = () => window.RosellerAuth.logout().then(() => location.reload());
}



function renderShell() {
  const collapsed = localStorage.getItem('roseller.sidebarCollapsed') === '1';
  if (collapsed) app.classList.add('sidebar-collapsed');
  else app.classList.remove('sidebar-collapsed');

  const pageTitle = NAV_LABEL[currentTab] || 'Admin';
  const pageSub = {
    dashboard: 'Overview of your store',
    users:     'Pending, approved, and admin accounts',
    orders:    'All orders, newest first',
    products:  'Manage all products',
    vendors:   'Approve applications, manage active shops',
    brands:    'Approve vendor brand applications',
    categories:'Manage product categories',
    help:      'Admin workflows',
  }[currentTab] || '';

  app.innerHTML = `
    <div class="layout">
      <aside class="sidebar">
        <div class="sidebar-logo">
          <img
            class="sidebar-logo-mark"
            src="assets/img/roseller-logo-400x400-transparent.png"
            alt="Roseller"
          >
          <div class="sidebar-logo-text">
            <span class="sidebar-logo-name">Roseller</span>
            <span class="sidebar-logo-tag">Admin</span>
          </div>
        </div>
        <div id="nav-list"></div>
      </aside>
      <div class="content-col">
        <header class="topbar">
          <div class="topbar-left">
            <button class="tb-toggle" id="tb-toggle" title="Toggle sidebar" aria-label="Toggle sidebar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div style="min-width:0;">
              <div class="tb-title">${pageTitle}</div>
              <div class="tb-sub">${pageSub}</div>
            </div>
          </div>
          <div class="topbar-right">
            <button class="tb-icon-btn" id="tb-theme" title="Toggle theme" aria-label="Toggle theme">
              <svg id="tb-theme-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>
            </button>
            <button class="tb-icon-btn" id="tb-refresh" title="Refresh data" aria-label="Refresh">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 4 23 10 17 10"/>
                <polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
            </button>
            <div class="tb-user" id="tb-user">
              <button class="tb-user-btn" id="tb-user-btn" aria-haspopup="true">
                <div class="tb-user-avatar">${initials(me.full_name || me.email || 'A')}</div>
                <div class="tb-user-meta">
                  <span class="tb-user-name">${esc(me.full_name || 'Admin')}</span>
                  <span class="tb-user-email">${esc(me.email || '')}</span>
                </div>
                <svg class="tb-user-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              <div class="tb-menu" role="menu">
                <div class="tb-menu-header">
                  <strong>${esc(me.full_name || 'Admin')}</strong>
                  <span>${esc(me.email || '')}</span>
                </div>
                <button class="tb-menu-item danger" id="tb-signout" role="menuitem">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </header>
        <main class="main"><div id="content"></div></main>
      </div>
    </div>`;

  const nav = document.getElementById('nav-list');
  nav.innerHTML = NAV.map(n => `
    <button class="nav-item ${currentTab===n.id?'active':''}" data-tab="${n.id}" title="${n.label}">
      <span class="nav-icon">${n.icon}</span>
      <span class="nav-label">${n.label}</span>
    </button>`).join('');

  nav.querySelectorAll('[data-tab]').forEach(b => {
    b.onclick = () => {
      currentTab = b.dataset.tab;
      productsSubView = 'list';
      editingProduct = null;
      viewingOrderId = null;      // reset order detail
      viewingProductId = null;    // reset product detail
      app.classList.remove('sidebar-open');
      renderShell();
    };
  });

  document.getElementById('tb-toggle').onclick = () => {
    const isMobile = window.matchMedia('(max-width: 900px)').matches;
    if (isMobile) {
      app.classList.toggle('sidebar-open');
    } else {
      const next = !app.classList.contains('sidebar-collapsed');
      app.classList.toggle('sidebar-collapsed', next);
      localStorage.setItem('roseller.sidebarCollapsed', next ? '1' : '0');
    }
  };

  app.onclick = (e) => {
    if (e.target === app && app.classList.contains('sidebar-open')) {
      app.classList.remove('sidebar-open');
    }
  };

  const refreshBtn = document.getElementById('tb-refresh');
  refreshBtn.onclick = async () => {
    refreshBtn.disabled = true;
    refreshBtn.classList.add('is-spinning');
    try { await window.RosellerAuth.currentUser?.getIdToken(true); } catch {}
    renderTab();
    setTimeout(() => {
      refreshBtn.disabled = false;
      refreshBtn.classList.remove('is-spinning');
    }, 600);
  };

  // ---- theme toggle ----
  const THEME_ICONS = {
    light: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
    dark:  '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  };
  function paintThemeIcon(theme) {
    const iconEl = document.getElementById('tb-theme-icon');
    if (iconEl) iconEl.innerHTML = THEME_ICONS[theme] || THEME_ICONS.light;
  }
  paintThemeIcon(document.documentElement.getAttribute('data-theme') || 'light');

  document.getElementById('tb-theme').onclick = () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('roseller.theme', next);
    paintThemeIcon(next);
  };

  const userEl = document.getElementById('tb-user');
  const userBtn = document.getElementById('tb-user-btn');
  userBtn.onclick = (e) => {
    e.stopPropagation();
    userEl.classList.toggle('open');
  };
  document.addEventListener('click', () => userEl.classList.remove('open'), { once: true });

  document.getElementById('tb-signout').onclick = () =>
    window.RosellerAuth.logout().then(() => location.reload());

  renderTab();
}

function renderTab() {
  const el = document.getElementById('content');
  if (!el) return;
  if (currentTab === 'dashboard') return renderDashboard(el);
  if (currentTab === 'users')     return renderUsers(el);
  if (currentTab === 'orders') {
    if (viewingOrderId) return renderOrderDetail(el, viewingOrderId);
    return renderOrders(el);
  }
  if (currentTab === 'products') {
    if (viewingProductId) return renderProductDetail(el, viewingProductId);
    return renderProducts(el);
  }
  if (currentTab === 'vendors')   return renderVendors(el);
  if (currentTab === 'brands')     return renderBrands(el);
  if (currentTab === 'categories') return renderCategories(el);
  if (currentTab === 'help')       return renderHelp(el);
}




/* ---------------- Dashboard ---------------- */
async function renderDashboard(el) {
  el.innerHTML = `
    <div class="main-head">
      <div>
        <h1>Dashboard</h1>
        <p>Welcome back, ${esc(me?.full_name || 'Admin')}</p>
      </div>
      <div class="dash-greeting">
        <span class="dash-date">${new Date().toLocaleDateString('en-BD', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}</span>
      </div>
    </div>

    <!-- KPI row: high-level metrics -->
    <div class="dash-kpi-row" id="dash-kpis">
      <div class="dash-kpi dash-kpi-blue">
        <div class="dash-kpi-label">Total Orders</div>
        <div class="dash-kpi-value" id="kpi-orders">—</div>
        <div class="dash-kpi-sub" id="kpi-orders-sub">—</div>
      </div>
      <div class="dash-kpi dash-kpi-amber">
        <div class="dash-kpi-label">Pending</div>
        <div class="dash-kpi-value" id="kpi-pending">—</div>
        <div class="dash-kpi-sub" id="kpi-pending-sub">—</div>
      </div>
      <div class="dash-kpi dash-kpi-purple">
        <div class="dash-kpi-label">Revenue</div>
        <div class="dash-kpi-value" id="kpi-revenue">—</div>
        <div class="dash-kpi-sub" id="kpi-revenue-sub">—</div>
      </div>
      <div class="dash-kpi dash-kpi-green">
        <div class="dash-kpi-label">Live Products</div>
        <div class="dash-kpi-value" id="kpi-live-products">—</div>
        <div class="dash-kpi-sub" id="kpi-live-products-sub">—</div>
      </div>
    </div>

    <!-- Full Store & Users breakdown -->
    <div class="dash-section-title">Store</div>
    <div class="stats-grid" id="stats-store"><div class="card muted">Loading…</div></div>

    <div class="dash-section-title">Users</div>
    <div class="stats-grid" id="stats-users"><div class="card muted">Loading…</div></div>

    <!-- Main grid: quick actions + recent activity -->
    <div class="dash-grid">

      <!-- Quick Actions -->
      <div class="dash-card">
        <div class="dash-card-head">
          <div class="dash-card-title">Quick Actions</div>
        </div>
        <div class="dash-quick-actions">
          <button class="dash-quick-btn" data-quick="new-product">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Add Product</span>
          </button>
          <button class="dash-quick-btn" data-quick="pending-products">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>Review Products</span>
            <span class="dash-quick-badge" id="qa-pending-products" style="display:none;">0</span>
          </button>
          <button class="dash-quick-btn" data-quick="pending-users">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
            <span>Approve Users</span>
            <span class="dash-quick-badge" id="qa-pending-users" style="display:none;">0</span>
          </button>
          <button class="dash-quick-btn" data-quick="pending-vendors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span>Approve Vendors</span>
            <span class="dash-quick-badge" id="qa-pending-vendors" style="display:none;">0</span>
          </button>
          <button class="dash-quick-btn" data-quick="publish">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span>Publish CDN</span>
          </button>
        </div>
      </div>

      <!-- Activity summary -->
      <div class="dash-card">
        <div class="dash-card-head">
          <div class="dash-card-title">Activity</div>
        </div>
        <div class="dash-activity">
          <div class="dash-activity-row">
            <div class="dash-activity-dot" style="background:#10b981;"></div>
            <div class="dash-activity-text">
              <strong id="act-live-products">0</strong> products live on the site
            </div>
          </div>
          <div class="dash-activity-row">
            <div class="dash-activity-dot" style="background:#f59e0b;"></div>
            <div class="dash-activity-text">
              <strong id="act-pending-products">0</strong> products awaiting review
            </div>
          </div>
          <div class="dash-activity-row">
            <div class="dash-activity-dot" style="background:#3b82f6;"></div>
            <div class="dash-activity-text">
              <strong id="act-total-users">0</strong> registered users
            </div>
          </div>
          <div class="dash-activity-row">
            <div class="dash-activity-dot" style="background:#8b5cf6;"></div>
            <div class="dash-activity-text">
              <strong id="act-active-vendors">0</strong> active vendors
            </div>
          </div>
          <div class="dash-activity-row">
            <div class="dash-activity-dot" style="background:#e53935;"></div>
            <div class="dash-activity-text">
              <strong id="act-total-brands">0</strong> registered brands
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- Recent Orders -->
    <div class="dash-section-title">Recent Orders</div>
    <div id="recent-orders"><div class="card muted">Loading…</div></div>`;

  // ---- fetch everything in parallel ----
  const [
    ordersRes, productsRes, vendorsRes, profilesRes, brandsRes
  ] = await Promise.all([
    supabase.from('orders').select('total,status,created_at,order_number,shipping_name').order('created_at', { ascending: false }),
    supabase.from('products').select('status'),
    supabase.from('vendors').select('is_active,is_suspended'),
    supabase.from('profiles').select('is_admin,is_approved,created_at'),
    supabase.from('brands').select('status'),
  ]);

  const orders   = ordersRes.data   || [];
  const products = productsRes.data || [];
  const vendors  = vendorsRes.data  || [];
  const users    = profilesRes.data || [];
  const brands   = brandsRes.data   || [];

  const revenue    = orders.reduce((s, o) => s + Number(o.total || 0), 0);
  const pendingO   = orders.filter(o => o.status === 'pending').length;
  const deliveredO = orders.filter(o => o.status === 'delivered').length;
  const liveP      = products.filter(p => p.status === 'live').length;
  const pendingP   = products.filter(p => p.status === 'pending').length;
  const activeV    = vendors.filter(v => v.is_active && !v.is_suspended).length;
  const pendingV   = vendors.filter(v => !v.is_active).length;
  const totalUsers = users.length;
  const pendingU   = users.filter(u => !u.is_approved).length;
  const totalBrands = brands.filter(b => b.status === 'active').length;

  // ---- KPIs ----
  document.getElementById('kpi-orders').textContent    = orders.length;
  document.getElementById('kpi-orders-sub').textContent = `${deliveredO} delivered · ${pendingO} pending`;

  document.getElementById('kpi-pending').textContent   = pendingO;
  document.getElementById('kpi-pending-sub').textContent = pendingO ? 'Needs attention' : 'All clear';

  document.getElementById('kpi-revenue').textContent   = fmt(revenue);
  document.getElementById('kpi-revenue-sub').textContent = `From ${orders.length} order${orders.length === 1 ? '' : 's'}`;

  document.getElementById('kpi-live-products').textContent = liveP;
  document.getElementById('kpi-live-products-sub').textContent = pendingP ? `${pendingP} pending` : 'All published';

  // ---- activity summary ----
  document.getElementById('act-live-products').textContent    = liveP;
  document.getElementById('act-pending-products').textContent = pendingP;
  document.getElementById('act-total-users').textContent      = totalUsers;
  document.getElementById('act-active-vendors').textContent   = activeV;
  document.getElementById('act-total-brands').textContent     = totalBrands;

  // ---- Store stats (6 cards) ----
  const pendingProducts   = pendingP;
  const rejectedProducts  = products.filter(p => p.status === 'rejected').length;
  const draftProducts     = products.filter(p => p.status === 'draft').length;
  const heldProducts      = products.filter(p => ['held','pending_hold'].includes(p.status)).length;
  const suspendedVendors  = vendors.filter(v => v.is_suspended).length;

  document.getElementById('stats-store').innerHTML = `
    <div class="stat-card blue">
      <div class="stat-label">Total Orders</div>
      <div class="stat-value">${orders.length}</div>
    </div>
    <div class="stat-card amber">
      <div class="stat-label">Pending Orders</div>
      <div class="stat-value">${pendingO}</div>
    </div>
    <div class="stat-card purple">
      <div class="stat-label">Revenue</div>
      <div class="stat-value" style="font-size:22px;">${fmt(revenue)}</div>
    </div>
    <div class="stat-card green">
      <div class="stat-label">Live Products</div>
      <div class="stat-value">${liveP}</div>
    </div>
    <div class="stat-card amber">
      <div class="stat-label">Pending Products</div>
      <div class="stat-value">${pendingP}</div>
    </div>
    <div class="stat-card blue">
      <div class="stat-label">Active Vendors</div>
      <div class="stat-value">${activeV}</div>
    </div>
  `;

  // ---- Users stats (4 cards) ----
  document.getElementById('stats-users').innerHTML = `
    <div class="stat-card blue">
      <div class="stat-label">Total Users</div>
      <div class="stat-value">${totalUsers}</div>
      <div class="stat-sub">All registered accounts</div>
    </div>
    <div class="stat-card green">
      <div class="stat-label">Approved Users</div>
      <div class="stat-value">${users.filter(u => u.is_approved).length}</div>
      <div class="stat-sub">Active customers</div>
    </div>
    <div class="stat-card amber">
      <div class="stat-label">Pending Approval</div>
      <div class="stat-value">${pendingU}</div>
      <div class="stat-sub">Awaiting review</div>
    </div>
    <div class="stat-card purple">
      <div class="stat-label">Admin Accounts</div>
      <div class="stat-value">${users.filter(u => u.is_admin).length}</div>
      <div class="stat-sub">Full access</div>
    </div>
  `;

  // ---- quick action badges ----
  const setBadge = (id, count) => {
    const el2 = document.getElementById(id);
    if (!el2) return;
    if (count > 0) { el2.textContent = count; el2.style.display = 'inline-flex'; }
    else { el2.style.display = 'none'; }
  };
  setBadge('qa-pending-products', pendingP);
  setBadge('qa-pending-users',    pendingU);
  setBadge('qa-pending-vendors',  pendingV);

  // ---- quick action handlers ----
  document.querySelectorAll('[data-quick]').forEach(b => {
    b.onclick = () => {
      const q = b.dataset.quick;
      if (q === 'new-product') { currentTab = 'products'; productsSubView = 'new'; editingProduct = null; }
      else if (q === 'pending-products') { currentTab = 'products'; productsSubView = 'list'; editingProduct = null; }
      else if (q === 'pending-users')    { currentTab = 'users'; }
      else if (q === 'pending-vendors')  { currentTab = 'vendors'; }
      else if (q === 'publish') {
        if (window.RosellerPublish) window.RosellerPublish.publishProducts();
        return;
      }
      renderShell();
    };
  });

  // ---- recent orders as cards ----
  const recent = orders.slice(0, 6);
  const recentBox = document.getElementById('recent-orders');

  if (!recent.length) {
    recentBox.innerHTML = `<div class="card empty"><div class="empty-icon">📦</div>No orders yet.</div>`;
    return;
  }

  recentBox.innerHTML = `
    <div class="dash-orders-cards">
      ${recent.map(o => `
        <div class="dash-order-card">
          <div class="dash-order-card-head">
            <div class="dash-order-card-id">${esc(o.order_number || '—')}</div>
            <span class="badge badge-${esc(o.status)}">${esc(o.status)}</span>
          </div>
          <div class="dash-order-card-body">
            <div class="dash-order-card-row">
              <span class="dash-order-card-label">Customer</span>
              <span class="dash-order-card-value">${esc(o.shipping_name || 'Guest')}</span>
            </div>
            <div class="dash-order-card-row">
              <span class="dash-order-card-label">Date</span>
              <span class="dash-order-card-value muted">${fmtDt(o.created_at)}</span>
            </div>
            <div class="dash-order-card-row">
              <span class="dash-order-card-label">Total</span>
              <span class="dash-order-card-value mono dash-order-card-total">${fmt(o.total)}</span>
            </div>
          </div>
        </div>`).join('')}
    </div>`;
}



/* ---------------- Orders ---------------- */
async function renderOrders(el) {
  const STATUSES = ['pending','confirmed','shipped','delivered','cancelled'];

  el.innerHTML = `
    <div class="orders-page">
      <div class="orders-head">
        <div>
          <h1>Orders</h1>
          <p>All orders, newest first</p>
        </div>
        <div class="orders-head-meta" id="orders-meta"></div>
      </div>
      <div class="ob-scroll">
        <div class="ob-wrap">
          <table class="ob-table">
            <thead>
              <tr>
                <th class="col-order">Order</th>
                <th class="col-cname">Customer Name</th>
                <th class="col-cid">Customer ID</th>
                <th class="col-email">Email</th>
                <th class="col-products">Products</th>
                <th class="col-total">Total</th>
                <th class="col-payment">Payment</th>
                <th class="col-contact">Contact</th>
                <th class="col-address">Address</th>
                <th class="col-status">Status</th>
                <th class="col-actions"></th>
              </tr>
            </thead>
            <tbody id="order-rows">
              ${Array.from({ length: 5 }).map(() => `
                <tr class="ob-skeleton">
                  ${Array.from({ length: 11 }).map(() => `
                    <td><div class="ob-sk-bar" style="width:${60 + Math.random() * 30}%"></div></td>
                  `).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;

  const [{ data, error }, { data: profiles }] = await Promise.all([
    supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('profiles')
      .select('id, email, full_name, phone')
  ]);

  // orders.user_id === profiles.id === Firebase UID — direct lookup
  const profileById = new Map();
  (profiles || []).forEach(p => profileById.set(p.id, p));

  function resolveCustomer(o) {
    if (!o.user_id) return null;
    const p = profileById.get(o.user_id);
    if (!p) return { uid: o.user_id, email: null, fullName: null, source: 'none' };
    return { uid: p.id, email: p.email, fullName: p.full_name, phone: p.phone, source: 'sb' };
  }

  const tbody = document.getElementById('order-rows');
  const meta  = document.getElementById('orders-meta');

  if (error) {
    tbody.innerHTML = `
      <tr><td colspan="11">
        <div class="ob-empty">
          <div class="ob-empty-icon">⚠️</div>
          <h3>Could not load orders</h3>
          <p>${esc(error.message)}</p>
        </div>
      </td></tr>`;
    return;
  }

  if (!data?.length) {
    meta.innerHTML = '';
    tbody.innerHTML = `
      <tr><td colspan="11">
        <div class="ob-empty">
          <div class="ob-empty-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
          </div>
          <h3>No orders yet</h3>
          <p>Orders will appear here as customers check out.</p>
        </div>
      </td></tr>`;
    return;
  }

  const pending   = data.filter(o => o.status === 'pending').length;
  const shipped   = data.filter(o => o.status === 'shipped').length;
  const delivered = data.filter(o => o.status === 'delivered').length;
  const total     = data.reduce((s, o) => s + Number(o.total || 0), 0);

  meta.innerHTML = `
    <span class="ob-pill blue"><strong>${data.length}</strong> total</span>
    <span class="ob-pill amber"><strong>${pending}</strong> pending</span>
    <span class="ob-pill"><strong>${shipped}</strong> shipped</span>
    <span class="ob-pill green"><strong>${delivered}</strong> delivered</span>
    <span class="ob-pill"><strong>${fmt(total)}</strong> revenue</span>
  `;

  tbody.innerHTML = data.map(o => {
    const items = o.order_items || [];

    const productCell = items.length
      ? `<div class="ob-prod-list">
           ${items.map(i => `
             <div class="ob-prod-item" title="${esc(i.product_name)}">
               <span class="name">${esc(i.product_name)}</span>
               <span class="qty">× ${i.qty}</span>
             </div>`).join('')}
         </div>`
      : `<span style="color:var(--ob-dim);font-size:11px;">No items</span>`;

    const customerName = o.shipping_name || 'Guest';
    const resolved     = resolveCustomer(o);
    const resolvedUid  = o.user_id || null;
    const resolvedEmail = resolved ? resolved.email : null;
    const customerId   = resolvedUid ? shortId(resolvedUid) : '—';
    const phone   = o.shipping_phone || '';
    const address = o.shipping_address || '';
    const cityRaw = o.shipping_city || '';

    const emailCell = resolvedEmail
      ? `<div class="ob-email" title="${esc(resolvedEmail)}">${esc(resolvedEmail)}</div>
         ${resolved ? `<div class="ob-email-src ${resolved.source}">${resolved.source === 'sb' ? 'Supabase' : 'Firebase'}</div>` : ''}`
      : `<span class="ob-email-none">—</span>`;

    return `
      <tr data-order-id="${o.id}">
        <td class="col-order" data-label="Order">
          <div class="ob-order-id" title="${esc(o.order_number || '')}">${esc(o.order_number || '—')}</div>
          <div class="ob-order-date">${fmtDt(o.created_at)}</div>
        </td>

        <td class="col-cname" data-label="Customer">
          <div class="ob-customer">
            <div class="ob-avatar">${initials(customerName)}</div>
            <div class="ob-cust-info">
              <div class="ob-cust-name" title="${esc(customerName)}">${esc(customerName)}</div>
            </div>
          </div>
        </td>

        <td class="col-cid" data-label="Customer ID">
          <div class="ob-cust-id" title="${resolvedUid ? esc(resolvedUid) : 'No user_id on order'}">#${esc(customerId)}</div>
        </td>

        <td class="col-email" data-label="Email">${emailCell}</td>

        <td class="col-products" data-label="Products">${productCell}</td>

        <td class="col-total" data-label="Total">
          <div class="ob-cost">${fmt(o.total)}</div>
        </td>

        <td class="col-payment" data-label="Payment">
          <span class="ob-pay ${payClass(o.payment_method)}">${esc((o.payment_method || 'cod').toUpperCase())}</span>
        </td>

        <td class="col-contact" data-label="Contact">
          <div class="ob-contact-phone">
            <span title="${esc(phone)}">${esc(phone || '—')}</span>
            ${phone ? `<button class="ob-copy" data-copy="${esc(phone)}" title="Copy">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>` : ''}
          </div>
        </td>

        <td class="col-address" data-label="Address">
          ${address ? `<div class="ob-address">${esc(address)}</div>` : ''}
          ${cityRaw ? `<div class="ob-address-city">${esc(cityRaw)}</div>` : ''}
          ${!address && !cityRaw ? `<span style="color:var(--ob-dim);font-size:11px;">—</span>` : ''}
        </td>

        <td class="col-status" data-label="Status">
          <div class="ob-status-wrap">
            <span class="ob-status-dot ${esc(o.status)}"></span>
            <select class="ob-status-select" data-status="${o.id}">
              ${STATUSES.map(s => `<option value="${s}" ${o.status===s?'selected':''}>${s}</option>`).join('')}
            </select>
          </div>
        </td>

        <td class="col-actions" data-label="">
          <button class="ob-icon-btn" data-view="${o.id}" title="View order">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </td>
      </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-status]').forEach(sel => {
    sel.onchange = async () => {
      const id = sel.dataset.status;
      const st = sel.value;
      const dot = sel.closest('.ob-status-wrap')?.querySelector('.ob-status-dot');
      const prevStatus = dot?.className.match(/ob-status-dot\s+(\w+)/)?.[1];

      sel.disabled = true;
      if (dot) dot.className = 'ob-status-dot ' + st;

      const { error: uErr } = await supabase.from('orders').update({ status: st }).eq('id', id);
      if (uErr) {
        alert('Failed: ' + uErr.message);
        sel.value = prevStatus || '';
        if (dot && prevStatus) dot.className = 'ob-status-dot ' + prevStatus;
        sel.disabled = false;
        return;
      }

      await supabase.from('tracking_events').insert({
        order_id: id, status: st, message: `Status changed to ${st} by admin.`
      });
      sel.disabled = false;
    };
  });

  tbody.querySelectorAll('[data-copy]').forEach(btn => {
    btn.onclick = async () => {
      const ok = await copyToClipboard(btn.dataset.copy);
      const original = btn.innerHTML;
      btn.innerHTML = ok
        ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
        : `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
      setTimeout(() => { btn.innerHTML = original; }, 1200);
    };
  });

  tbody.querySelectorAll('[data-view]').forEach(btn => {
    btn.onclick = () => {
      viewingOrderId = btn.dataset.view;
      renderTab();
      // scroll to top so the detail page is visible
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
  });
}




/* ---------------- Users (merged: pending + approved + admins) ---------------- */
async function renderUsers(el) {
  el.innerHTML = `
    <div class="main-head"><div><h1>Users</h1><p>Pending, approved, and admin accounts</p></div></div>

    <div class="users-toolbar">
      <div class="users-tabs" id="users-tabs">
        <button class="users-tab" data-filter="pending">Pending <span class="users-tab-count" id="cnt-pending">—</span></button>
        <button class="users-tab" data-filter="approved">Approved <span class="users-tab-count" id="cnt-approved">—</span></button>
        <button class="users-tab" data-filter="admins">Admins <span class="users-tab-count" id="cnt-admins">—</span></button>
        <button class="users-tab" data-filter="all">All <span class="users-tab-count" id="cnt-all">—</span></button>
      </div>
      <div class="users-search">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input id="users-search" type="text" placeholder="Search name, email, or UID…" autocomplete="off">
      </div>
    </div>

    <div id="users-table-wrap"><div class="card muted">Loading…</div></div>`;

  const [sbRes, fbRes] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    fetch('/api/firebase-users').then(r => r.json()).catch(err => ({ error: err.message })),
  ]);

  const sbUsers = sbRes.data || [];
  const fbUsers = Array.isArray(fbRes) ? fbRes : [];
  const sbIds = new Set(sbUsers.map(u => u.id));

  const cPending  = sbUsers.filter(u => !u.is_approved).length;
  const cApproved = sbUsers.filter(u => u.is_approved && !u.is_admin).length;
  const cAdmins   = sbUsers.filter(u => u.is_admin).length;
  const cAll      = sbUsers.length + fbUsers.filter(f => !sbIds.has(f.uid)).length;

  document.getElementById('cnt-pending').textContent  = cPending;
  document.getElementById('cnt-approved').textContent = cApproved;
  document.getElementById('cnt-admins').textContent   = cAdmins;
  document.getElementById('cnt-all').textContent      = cAll;

  let activeFilter = 'pending';
  let searchQuery  = '';

  function setActiveTab() {
    document.querySelectorAll('#users-tabs .users-tab').forEach(b => {
      b.classList.toggle('active', b.dataset.filter === activeFilter);
    });
  }

  function filteredSupabase() {
    const q = searchQuery.toLowerCase().trim();
    let list = sbUsers;
    if (activeFilter === 'pending')       list = list.filter(u => !u.is_approved);
    else if (activeFilter === 'approved') list = list.filter(u => u.is_approved && !u.is_admin);
    else if (activeFilter === 'admins')   list = list.filter(u => u.is_admin);

    if (q) {
      list = list.filter(u =>
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.id || '').toLowerCase().includes(q)
      );
    }
    return list;
  }

  function filteredFirebaseOnly() {
    const q = searchQuery.toLowerCase().trim();
    let list = fbUsers.filter(f => !sbIds.has(f.uid));
    if (q) {
      list = list.filter(f =>
        (f.displayName || '').toLowerCase().includes(q) ||
        (f.email || '').toLowerCase().includes(q) ||
        (f.uid || '').toLowerCase().includes(q)
      );
    }
    return list;
  }

  function renderRows() {
    const box = document.getElementById('users-table-wrap');
    const rows = filteredSupabase();
    const fbOnly = filteredFirebaseOnly();

    if (!rows.length && !fbOnly.length) {
      box.innerHTML = `
        <div class="card empty">
          <div class="empty-icon">👥</div>
          ${searchQuery ? 'No users match your search.' : 'No users in this section.'}
        </div>`;
      return;
    }

    const sbTable = rows.length ? `
      <div class="users-section">
        <div class="users-section-head">
          <div class="users-section-title">Supabase Profiles</div>
          <div class="users-section-count">${rows.length} user${rows.length === 1 ? '' : 's'}</div>
        </div>
        <table class="users-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>UID</th>
              <th>Role</th>
              <th>Status</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(u => {
              const role = u.is_super_admin
                ? '<span class="users-role admin" style="background:linear-gradient(135deg,#e53935,#7c2d12);">Super Admin</span>'
                : u.is_admin
                  ? '<span class="users-role admin">Admin</span>'
                  : '<span class="users-role user">User</span>';
              const status = u.is_approved
                ? '<span class="users-status approved">Approved</span>'
                : '<span class="users-status pending">Pending</span>';
              const isSelf = window.RosellerAuth.currentUser?.uid === (u.firebase_uid || u.id);
              const superAdmin = canPromote();

              const actions = u.is_admin
                ? (isSelf
                    ? '<span class="muted" style="font-size:11px;">You (protected)</span>'
                    : (superAdmin
                        ? `<button class="btn-secondary" data-demote="${u.id}" data-name="${esc(u.full_name || u.email || 'this admin')}" style="color:var(--red);border-color:var(--red);">Demote</button>`
                        : '<span class="muted" style="font-size:11px;">Admin</span>'))
                : (u.is_approved
                    ? `<button class="btn-secondary" data-unapprove="${u.id}">Revoke</button>
                       ${superAdmin
                         ? `<button class="btn-secondary" data-promote="${u.id}" data-name="${esc(u.full_name || u.email || 'this user')}" style="color:var(--primary);border-color:var(--primary);">Make Admin</button>`
                         : ''}`
                    : `<button class="btn-primary" data-approve="${u.id}">Approve</button>
                       <button class="btn-secondary" data-reject="${u.id}">Reject</button>`);
              return `
                <tr>
                  <td>
                    <div class="users-user">
                      <div class="user-avatar">${initials(u.full_name || u.email)}</div>
                      <div class="users-user-name">${esc(u.full_name || '(no name)')}</div>
                    </div>
                  </td>
                  <td class="mono">${esc(u.email || '—')}</td>
                  <td class="mono" title="${esc(u.id)}">${esc(shortId(u.id))}</td>
                  <td>${role}</td>
                  <td>${status}</td>
                  <td style="text-align:right;white-space:nowrap;">${actions}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>` : '';

    const showFb = fbOnly.length && (activeFilter === 'all' || activeFilter === 'pending');
    const fbTable = showFb ? `
      <div class="users-section">
        <div class="users-section-head">
          <div class="users-section-title" style="color:#fbbf24;">Firebase — Not in Supabase</div>
          <div class="users-section-count">${fbOnly.length} orphan${fbOnly.length === 1 ? '' : 's'}</div>
        </div>
        <table class="users-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>UID</th>
              <th>Claim</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${fbOnly.map(u => {
              const hasClaim = u.role === 'authenticated';
              return `
                <tr>
                  <td>
                    <div class="users-user">
                      <div class="user-avatar" style="background:linear-gradient(135deg,#f59e0b,#b45309);">${initials(u.displayName || u.email)}</div>
                      <div class="users-user-name">${esc(u.displayName || '(no name)')}</div>
                    </div>
                  </td>
                  <td class="mono">${esc(u.email || '—')}</td>
                  <td class="mono" title="${esc(u.uid)}">${esc(shortId(u.uid))}</td>
                  <td>${hasClaim
                    ? '<span class="users-status approved">Claim OK</span>'
                    : '<span class="users-status pending">No Claim</span>'}</td>
                  <td style="text-align:right;white-space:nowrap;">
                    ${!hasClaim ? `<button class="btn-secondary" data-claim="${u.uid}">Set Claim</button>` : ''}
                    <button class="btn-primary" data-insert="${u.uid}" data-email="${esc(u.email||'')}" data-name="${esc(u.displayName||'')}">Insert to Supabase</button>
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>` : '';

    box.innerHTML = sbTable + fbTable;

    box.querySelectorAll('[data-approve]').forEach(b => b.onclick = () => approveUser(b.dataset.approve));
    box.querySelectorAll('[data-reject]').forEach(b => b.onclick = () => rejectUser(b.dataset.reject));
    box.querySelectorAll('[data-unapprove]').forEach(b => b.onclick = () => unapproveUser(b.dataset.unapprove));
    box.querySelectorAll('[data-promote]').forEach(b => b.onclick = () => promoteUser(b.dataset.promote, b.dataset.name));
    box.querySelectorAll('[data-demote]').forEach(b => b.onclick = () => demoteUser(b.dataset.demote, b.dataset.name));
    box.querySelectorAll('[data-claim]').forEach(b => {
      b.onclick = async () => {
        b.disabled = true; b.textContent = 'Setting…';
        try {
          const res = await fetch('/api/set-claim', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: b.dataset.claim })
          });
          const out = await res.json();
          if (out.error) throw new Error(out.error);
          alert('Claim set! User must sign out and back in.');
          renderTab();
        } catch (err) {
          alert('Failed: ' + err.message);
          b.disabled = false; b.textContent = 'Set Claim';
        }
      };
    });
    box.querySelectorAll('[data-insert]').forEach(b => {
      b.onclick = async () => {
        b.disabled = true; b.textContent = 'Inserting…';
        const { error } = await supabase.from('profiles').insert({
          id: b.dataset.insert,
          email: b.dataset.email || null,
          full_name: b.dataset.name || null,
          is_approved: false, is_admin: false,
        });
        if (error) {
          alert('Insert failed: ' + error.message);
          b.disabled = false; b.textContent = 'Insert to Supabase';
          return;
        }
        alert('Inserted. Now set claim, then approve.');
        renderTab();
      };
    });
  }

  document.querySelectorAll('#users-tabs .users-tab').forEach(b => {
    b.onclick = () => {
      activeFilter = b.dataset.filter;
      setActiveTab();
      renderRows();
    };
  });

  const searchEl = document.getElementById('users-search');
  let searchTimer;
  searchEl.oninput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchQuery = searchEl.value;
      renderRows();
    }, 150);
  };

  setActiveTab();
  renderRows();
}

async function approveUser(uid) {
  const { error } = await supabase.from('profiles')
    .update({ is_approved: true, approved_at: new Date().toISOString() }).eq('id', uid);
  if (error) return alert('Failed: ' + error.message);
  renderTab();
}
async function rejectUser(uid) {
  if (!confirm('Delete this pending account?')) return;
  const { error } = await supabase.from('profiles').delete().eq('id', uid);
  if (error) return alert('Failed: ' + error.message);
  renderTab();
}
async function unapproveUser(uid) {
  if (!confirm('Revoke approval?')) return;
  const { error } = await supabase.from('profiles').update({ is_approved: false }).eq('id', uid);
  if (error) return alert('Failed: ' + error.message);
  renderTab();
}

async function promoteUser(uid, name) {
  if (!canPromote()) {
    return alert('Only a Super Admin can promote users. You do not have permission.');
  }

  const label = name || 'this user';
  if (!confirm(
    `Make "${label}" an admin?\n\n` +
    `Full access granted:\n` +
    `• All orders, users, products, vendors, brands\n` +
    `• Ability to promote/demote other admins\n` +
    `• Publishing to the storefront CDN\n\n` +
    `This cannot be undone from the UI — only via SQL.`
  )) return;

  const { error } = await supabase
    .from('profiles')
    .update({ is_admin: true })
    .eq('id', uid);

  if (error) return alert('Failed to promote: ' + error.message);
  renderTab();
}

async function demoteUser(uid, name) {
  if (!canPromote()) {
    return alert('Only a Super Admin can demote admins. You do not have permission.');
  }

  const label = name || 'this admin';

  if (window.RosellerAuth.currentUser && window.RosellerAuth.currentUser.uid === uid) {
    return alert('You cannot demote yourself from the UI. Use the SQL editor if you are certain.');
  }

  if (!confirm(
    `Remove admin access from "${label}"?\n\n` +
    `They will still be an approved user but lose access to the admin panel.`
  )) return;

  const { error } = await supabase
    .from('profiles')
    .update({ is_admin: false })
    .eq('id', uid);

  if (error) return alert('Failed to demote: ' + error.message);
  renderTab();
}

// ✂️ Duplicate promoteUser/demoteUser blocks removed here — original pair above is kept.



/* ---------------- Order Detail Page ---------------- */
async function renderOrderDetail(el, orderId) {
  el.innerHTML = `<div class="od-page"><div class="od-body"><div class="card muted">Loading order…</div></div></div>`;

  const [{ data: orders, error }, { data: profiles }] = await Promise.all([
    supabase.from('orders').select('*, order_items(*)').eq('id', orderId).limit(1),
    supabase.from('profiles').select('id, email, full_name, phone'),
  ]);

  const o = orders?.[0];
  const wrap = el.querySelector('.od-page');

  if (error || !o) {
    wrap.innerHTML = `
      <div class="od-head">
        <div class="od-head-left">
          <button class="od-back" id="od-back">Back to Orders</button>
        </div>
      </div>
      <div class="od-error">
        <h2>Order not found</h2>
        <p>${error ? esc(error.message) : 'This order may have been deleted.'}</p>
      </div>`;
    document.getElementById('od-back').onclick = () => {
      viewingOrderId = null;
      renderTab();
    };
    return;
  }

  // ---- resolve customer via orders.user_id → profiles.id ----
  const customer = (() => {
    if (!o.user_id) return null;
    const p = (profiles || []).find(pr => pr.id === o.user_id);
    if (!p) return { uid: o.user_id, email: null, fullName: null, source: 'none' };
    return { uid: p.id, email: p.email, fullName: p.full_name, phone: p.phone, source: 'sb' };
  })();

  const items = o.order_items || [];
  const totalQty = items.reduce((s, i) => s + Number(i.qty || 0), 0);
  const subtotal = items.reduce((s, i) => s + Number(i.price || 0) * Number(i.qty || 0), 0);
  const shipping = Math.max(0, Number(o.total || 0) - subtotal);

  const fullAddress = [o.shipping_address, o.shipping_city].filter(Boolean).join(', ') || '—';

  wrap.innerHTML = `
    <div class="od-head">
      <div class="od-head-left">
        <button class="od-back" id="od-back">Back to Orders</button>
        <div class="od-title-block">
          <div class="od-title">${esc(o.order_number || '—')}</div>
          <div class="od-subtitle">
            <span>${fmtDt(o.created_at)}</span>
            <span style="color:var(--od-dim);">·</span>
            <span class="od-status-chip ${esc(o.status)}">${esc(o.status)}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="od-body">

      <!-- Customer + Shipping -->
      <div class="od-grid">
        <div class="od-card">
          <div class="od-card-title">Customer</div>
          <div class="od-card-row">
            <div class="od-field">
              <div class="od-field-label">Name</div>
              <div class="od-field-value">${esc(o.shipping_name || '—')}</div>
            </div>
            <div class="od-field">
              <div class="od-field-label">Email</div>
              <div class="od-field-value mono">${
                customer?.email
                  ? `<a class="od-field-value link" href="mailto:${esc(customer.email)}">${esc(customer.email)}</a>`
                  : '<span class="empty">—</span>'
              }</div>
            </div>
            <div class="od-field">
              <div class="od-field-label">Customer UID</div>
              <div class="od-field-value mono">${
                customer?.uid
                  ? `<span title="${esc(customer.uid)}">${esc(customer.uid)}</span>`
                  : '<span class="empty">No matching profile</span>'
              }</div>
            </div>
            <div class="od-field">
              <div class="od-field-label">Source</div>
              <div class="od-field-value">${
                customer
                  ? (customer.source === 'sb' ? 'Supabase' : 'Firebase')
                  : '<span class="empty">Unresolved</span>'
              }</div>
            </div>
          </div>
        </div>

        <div class="od-card">
          <div class="od-card-title">Shipping</div>
          <div class="od-card-row">
            <div class="od-field">
              <div class="od-field-label">Phone</div>
              <div class="od-field-value mono">${esc(o.shipping_phone || '—')}</div>
            </div>
            <div class="od-field">
              <div class="od-field-label">Address</div>
              <div class="od-field-value">${esc(fullAddress)}</div>
            </div>
            <div class="od-field">
              <div class="od-field-label">Payment Method</div>
              <div class="od-field-value">${esc((o.payment_method || 'COD').toUpperCase())}</div>
            </div>
            <div class="od-field">
              <div class="od-field-label">Total</div>
              <div class="od-field-value mono">${fmt(o.total)}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Items -->
      <div class="od-items-card">
        <div class="od-items-head">
          <div class="od-items-title">Order Items</div>
          <div class="od-items-count">${items.length} item${items.length === 1 ? '' : 's'} · ${totalQty} unit${totalQty === 1 ? '' : 's'}</div>
        </div>
        <table class="od-items-table">
          <thead>
            <tr>
              <th style="width:56px;"></th>
              <th>Product</th>
              <th class="num">Qty</th>
              <th class="num">Unit Price</th>
              <th class="num">Line Total</th>
            </tr>
          </thead>
          <tbody>
            ${items.length ? items.map(i => {
              const line = Number(i.price || 0) * Number(i.qty || 0);
              const sku  = i.product_id || i.sku || null;   // product_id IS the SKU
              return `
                <tr>
                  <td style="width:56px;padding-right:0;">
                    ${i.image
                      ? `<img class="od-item-thumb" src="${esc(i.image)}" alt="" loading="lazy"
                              onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                         <div class="od-item-thumb-fallback" style="display:none;">
                           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                         </div>`
                      : `<div class="od-item-thumb-fallback">
                           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                         </div>`}
                  </td>
                  <td>
                    <div class="od-item-name">${esc(i.product_name || '—')}</div>
                    <div class="od-item-meta">
                      ${sku
                        ? `<span class="od-item-sku" title="SKU"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>${esc(sku)}</span>`
                        : `<span style="color:var(--od-dim);font-style:italic;">SKU unavailable</span>`}
                      ${i.variant ? `<span>${esc(i.variant)}</span>` : ''}
                    </div>
                  </td>
                  <td class="num">${Number(i.qty || 0)}</td>
                  <td class="num">${fmt(i.price || 0)}</td>
                  <td class="num">${fmt(line)}</td>
                </tr>`;
            }).join('') : `
              <tr><td colspan="5" style="text-align:center;padding:32px;color:var(--od-muted);">
                No items recorded for this order.
              </td></tr>`}
          </tbody>
        </table>
        ${items.length ? `
          <div class="od-totals">
            <div class="od-total-row"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
            <div class="od-total-row"><span>Shipping</span><span>${fmt(shipping)}</span></div>
            <div class="od-total-row grand"><span>Total</span><span>${fmt(o.total)}</span></div>
          </div>` : ''}
      </div>

    </div>`;

  document.getElementById('od-back').onclick = () => {
    viewingOrderId = null;
    renderTab();
  };
}

/* ---------------- Products ---------------- */
async function renderProducts(el) {
  if (productsSubView === 'edit' || productsSubView === 'new') {
    return renderProductForm(el);
  }

  const STATUS_TABS = [
    { id:'all',      label:'All' },
    { id:'pending',  label:'Pending' },
    { id:'live',     label:'Live' },
    { id:'draft',    label:'Draft' },
    { id:'held',     label:'Held' },
    { id:'rejected', label:'Rejected' },
  ];

  el.innerHTML = `
    <div class="main-head">
      <div><h1>Products</h1><p>Manage all products</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn-secondary" id="new-btn" style="font-size:13.5px;">+ Add Product</button>
        <button class="btn-primary" id="publish-btn" style="font-size:13.5px;">Publish to CDN</button>
      </div>
    </div>

    <div class="products-toolbar">
      <div class="products-tabs" id="products-tabs">
        ${STATUS_TABS.map(t => `<button class="products-tab" data-filter="${t.id}">${t.label} <span class="products-tab-count" id="pcnt-${t.id}">—</span></button>`).join('')}
      </div>
      <div class="products-search">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input id="products-search" type="text" placeholder="Search name, SKU, or vendor…" autocomplete="off">
      </div>
    </div>

    <div class="products-filters" id="products-filters">
      <div class="products-filter-group">
        <label>Sort</label>
        <select id="sort-select">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name-asc">Name A → Z</option>
          <option value="name-desc">Name Z → A</option>
          <option value="price-asc">Price: low → high</option>
          <option value="price-desc">Price: high → low</option>
          <option value="stock-asc">Stock: low → high</option>
          <option value="stock-desc">Stock: high → low</option>
        </select>
      </div>

      <div class="products-filter-group">
        <label>Brand</label>
        <select id="brand-select">
          <option value="">All brands</option>
        </select>
      </div>

      <div class="products-filter-group">
        <label>Category</label>
        <select id="category-select">
          <option value="">All categories</option>
        </select>
      </div>

      <div class="products-filter-group">
        <label>Vendor</label>
        <select id="vendor-select">
          <option value="">All vendors</option>
          <option value="__official__">Roseller Official</option>
        </select>
      </div>

      <div class="products-filter-group">
        <label>Flags</label>
        <select id="flags-select">
          <option value="">Any</option>
          <option value="featured">Featured</option>
          <option value="bestseller">Bestseller</option>
          <option value="both">Featured + Bestseller</option>
          <option value="none">Neither</option>
        </select>
      </div>

      <div class="products-filter-group">
        <label>Stock</label>
        <select id="stock-select">
          <option value="">Any</option>
          <option value="in">In stock (&gt; 0)</option>
          <option value="out">Out of stock (= 0)</option>
        </select>
      </div>

      <button class="products-filter-clear" id="clear-filters" style="display:none;">
        Clear all
      </button>
    </div>

    <div id="products-table-wrap"><div class="card muted">Loading…</div></div>`;

  document.getElementById('new-btn').onclick = () => {
    editingProduct = null;
    productsSubView = 'new';
    renderTab();
  };
  const pub = document.getElementById('publish-btn');
  if (pub && window.RosellerPublish) pub.onclick = () => window.RosellerPublish.publishProducts();

  const { data, error } = await supabase
    .from('products')
    .select('*, vendors(shop_name)')
    .order('created_at', { ascending: false });

  const wrap = document.getElementById('products-table-wrap');
  if (error) {
    wrap.innerHTML = `<div class="card">${esc(error.message)}</div>`;
    return;
  }
  if (!data?.length) {
    wrap.innerHTML = `<div class="card empty">No products yet. Click "+ Add Product" to create one.</div>`;
    return;
  }

  const counts = {
    all:      data.length,
    pending:  data.filter(p => p.status === 'pending').length,
    live:     data.filter(p => p.status === 'live').length,
    draft:    data.filter(p => p.status === 'draft').length,
    held:     data.filter(p => ['held','pending_hold'].includes(p.status)).length,
    rejected: data.filter(p => p.status === 'rejected').length,
  };

  Object.entries(counts).forEach(([k, v]) => {
    const el2 = document.getElementById(`pcnt-${k}`);
    if (el2) el2.textContent = v;
  });

  // ---- Populate filter dropdowns from the loaded data ----
  const brandsSet = new Set();
  const categoriesSet = new Set();
  const vendorsSet = new Map(); // id → shop_name

  data.forEach(p => {
    if (p.brand && String(p.brand).trim()) brandsSet.add(String(p.brand).trim());
    if (p.category && String(p.category).trim()) categoriesSet.add(String(p.category).trim());
    if (p.vendor_id && p.vendors?.shop_name) {
      vendorsSet.set(p.vendor_id, p.vendors.shop_name);
    }
  });

  const brandSelect    = document.getElementById('brand-select');
  const categorySelect = document.getElementById('category-select');
  const vendorSelect   = document.getElementById('vendor-select');

  [...brandsSet].sort().forEach(b => {
    brandSelect.insertAdjacentHTML('beforeend', `<option value="${esc(b)}">${esc(b)}</option>`);
  });

  [...categoriesSet].sort().forEach(c => {
    categorySelect.insertAdjacentHTML('beforeend', `<option value="${esc(c)}">${esc(c)}</option>`);
  });

  [...vendorsSet.entries()].sort((a,b) => a[1].localeCompare(b[1])).forEach(([id, name]) => {
    vendorSelect.insertAdjacentHTML('beforeend', `<option value="${esc(id)}">${esc(name)}</option>`);
  });

  let activeFilter = 'all';
  let searchQuery  = '';

  // ---- Filter/sort state ----
  let sortBy       = 'newest';
  let brandFilter   = '';
  let categoryFilter= '';
  let vendorFilter  = '';
  let flagsFilter   = '';
  let stockFilter   = '';

  const sortSelect    = document.getElementById('sort-select');
  const flagsSelect   = document.getElementById('flags-select');
  const stockSelect   = document.getElementById('stock-select');
  const clearBtn      = document.getElementById('clear-filters');

  function updateClearVisibility() {
    const anyActive =
      sortBy !== 'newest' ||
      brandFilter || categoryFilter || vendorFilter || flagsFilter || stockFilter;
    clearBtn.style.display = anyActive ? 'inline-flex' : 'none';
  }

  function setActiveTab() {
    document.querySelectorAll('#products-tabs .products-tab').forEach(b => {
      b.classList.toggle('active', b.dataset.filter === activeFilter);
    });
  }

  function filtered() {
    const q = searchQuery.toLowerCase().trim();
    let list = data;

    // Status tab filter
    if (activeFilter === 'pending')  list = list.filter(p => p.status === 'pending');
    else if (activeFilter === 'live')     list = list.filter(p => p.status === 'live');
    else if (activeFilter === 'draft')    list = list.filter(p => p.status === 'draft');
    else if (activeFilter === 'held')     list = list.filter(p => ['held','pending_hold'].includes(p.status));
    else if (activeFilter === 'rejected') list = list.filter(p => p.status === 'rejected');

    // Brand filter
    if (brandFilter) {
      list = list.filter(p => String(p.brand || '').trim() === brandFilter);
    }

    // Category filter
    if (categoryFilter) {
      list = list.filter(p => String(p.category || '').trim() === categoryFilter);
    }

    // Vendor filter
    if (vendorFilter === '__official__') {
      list = list.filter(p => !p.vendor_id);
    } else if (vendorFilter) {
      list = list.filter(p => p.vendor_id === vendorFilter);
    }

    // Flags filter
    if (flagsFilter === 'featured')     list = list.filter(p => p.featured === true);
    else if (flagsFilter === 'bestseller') list = list.filter(p => p.bestseller === true);
    else if (flagsFilter === 'both')       list = list.filter(p => p.featured && p.bestseller);
    else if (flagsFilter === 'none')       list = list.filter(p => !p.featured && !p.bestseller);

    // Stock filter
    if (stockFilter === 'in')  list = list.filter(p => Number(p.stock || 0) > 0);
    else if (stockFilter === 'out') list = list.filter(p => Number(p.stock || 0) === 0);

    // Search query
    if (q) {
      list = list.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        ((p.vendors?.shop_name) || '').toLowerCase().includes(q)
      );
    }

    // Sort
    const sorted = [...list];
    switch (sortBy) {
      case 'newest':
        sorted.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        break;
      case 'oldest':
        sorted.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
        break;
      case 'name-asc':
        sorted.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
        break;
      case 'name-desc':
        sorted.sort((a, b) => String(b.name || '').localeCompare(String(a.name || '')));
        break;
      case 'price-asc':
        sorted.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
        break;
      case 'price-desc':
        sorted.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
        break;
      case 'stock-asc':
        sorted.sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0));
        break;
      case 'stock-desc':
        sorted.sort((a, b) => Number(b.stock || 0) - Number(a.stock || 0));
        break;
    }
    return sorted;
  }

  function renderTable() {
    const box = document.getElementById('products-table-wrap');
    const rows = filtered();

    if (!rows.length) {
      box.innerHTML = `
        <div class="card empty">
          <div class="empty-icon">🏷️</div>
          ${searchQuery ? 'No products match your search.' : 'No products in this section.'}
        </div>`;
      return;
    }

    const statusColors = {
      live: 'badge-delivered', pending: 'badge-pending',
      draft: 'badge-confirmed', rejected: 'badge-cancelled',
      held: 'badge-shipped', pending_hold: 'badge-shipped',
    };

    box.innerHTML = `
      <div class="products-section">
        <div class="products-section-head">
          <div class="products-section-title">Products</div>
          <div class="products-section-count">${rows.length} item${rows.length === 1 ? '' : 's'}</div>
        </div>
        <div class="products-scroll">
          <table class="products-table">
            <thead>
              <tr>
                <th style="width:88px;">Image</th>
                <th>Product</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Vendor</th>
                <th class="num">Price</th>
                <th class="num">Stock</th>
                <th>Flags</th>
                <th>Status</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(p => {
                const vendorName = p.vendors?.shop_name || 'Roseller Official';
                const primaryActions = (() => {
                  if (p.status === 'pending') {
                    return `<button class="btn-primary" data-action="approve" data-id="${p.id}">Approve</button>
                            <button class="btn-secondary" data-action="reject" data-id="${p.id}">Reject</button>`;
                  }
                  if (p.status === 'live') {
                    return `<button class="btn-secondary" data-action="unlist" data-id="${p.id}">Unlist</button>
                            <button class="btn-secondary" data-action="draft" data-id="${p.id}">Draft</button>`;
                  }
                  if (['draft','rejected','held','pending_hold'].includes(p.status)) {
                    return `<button class="btn-primary" data-action="approve" data-id="${p.id}">Approve → Live</button>`;
                  }
                  return '';
                })();

                return `
                  <tr data-id="${p.id}" style="cursor:pointer;">
                    <td style="padding:8px 8px 8px 12px;width:88px;">
                      ${p.image
                        ? `<div class="product-thumb-wrap">
                             <img class="product-thumb" src="${esc(p.image)}" alt="" loading="lazy" onerror="this.parentElement.style.display='none';this.parentElement.nextElementSibling.style.display='flex';">
                           </div>
                           <div class="product-thumb-fallback" style="display:none;">
                             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                           </div>`
                        : `<div class="product-thumb-fallback">
                             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                           </div>`}
                    </td>
                    <td>
                      <div class="product-name" title="${esc(p.name || '')}">${esc(p.name || '—')}</div>
                      ${p.rejection_reason ? `<div class="product-rejection" title="${esc(p.rejection_reason)}">Rejected: ${esc(p.rejection_reason)}</div>` : ''}
                    </td>
                    <td class="mono" title="${esc(p.sku || '')}">${esc(p.sku || '—')}</td>
                    <td>${esc(p.category || '—')}</td>
                    <td class="vendor-cell" title="${esc(vendorName)}">${esc(vendorName)}</td>
                    <td class="num mono">${fmt(p.price)}</td>
                    <td class="num mono">${p.stock ?? 0}</td>
                    <td>
                      <div class="product-flags">
                        ${p.featured ? `<span class="pflag pflag-featured" title="Featured">★ Featured</span>` : ''}
                        ${p.bestseller ? `<span class="pflag pflag-bestseller" title="Bestseller">🔥 Bestseller</span>` : ''}
                        ${!p.featured && !p.bestseller ? `<span class="pflag-empty">—</span>` : ''}
                      </div>
                    </td>
                    <td><span class="badge ${statusColors[p.status] || ''}">${esc(p.status)}</span></td>
                    <td style="text-align:right;white-space:nowrap;">
                      <div class="product-actions">
                        ${primaryActions}
                        <button class="btn-secondary" data-action="view" data-id="${p.id}" title="View details">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                        <button class="btn-secondary" data-action="edit" data-id="${p.id}">Edit</button>
                        <button class="btn-danger" data-action="delete" data-id="${p.id}">Delete</button>
                      </div>
                    </td>
                  </tr>`;
              }).join('')}

            </tbody>
          </table>
        </div>
      </div>`;

    box.querySelectorAll('[data-action]').forEach(b => {
      b.onclick = async () => {
        const action = b.dataset.action;
        const id = b.dataset.id;

        if (action === 'view') {
          viewingProductId = id;
          renderTab();
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }

        if (action === 'edit') {
          const prod = data.find(x => x.id === id);
          if (prod) {
            editingProduct = prod;
            productsSubView = 'edit';
            renderTab();
          }
          return;
        }

        if (action === 'approve') {
          b.disabled = true; b.textContent = 'Approving…';
          const { error } = await supabase.rpc('approve_product', { p_product_id: id });
          if (error) { alert('Failed: ' + error.message); b.disabled = false; b.textContent = 'Approve'; return; }
          renderTab();
          return;
        }

        if (action === 'reject') {
          const reason = prompt('Rejection reason:');
          if (!reason) return;
          const { error } = await supabase.rpc('reject_product', { p_product_id: id, p_reason: reason });
          if (error) return alert('Failed: ' + error.message);
          renderTab();
          return;
        }

        if (action === 'draft') {
          if (!confirm('Move this product to draft? It will be hidden from the site on next publish.')) return;
          const { error } = await supabase.from('products').update({ status: 'draft' }).eq('id', id);
          if (error) return alert('Failed: ' + error.message);
          renderTab();
          return;
        }

        if (action === 'unlist') {
          if (!confirm('Unlist this product? Status → held (hidden from site on next publish).')) return;
          const { error } = await supabase.from('products').update({ status: 'held' }).eq('id', id);
          if (error) return alert('Failed: ' + error.message);
          renderTab();
          return;
        }

        if (action === 'delete') {
          if (!confirm('Delete this product permanently?')) return;
          const { error } = await supabase.from('products').delete().eq('id', id);
          if (error) return alert('Failed: ' + error.message);
          renderTab();
        }
      };
    });

    box.querySelectorAll('tbody tr[data-id]').forEach(tr => {
      tr.onclick = (e) => {
        if (e.target.closest('button, a, input, select, textarea')) return;
        viewingProductId = tr.dataset.id;
        renderTab();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
    });
  }

  document.querySelectorAll('#products-tabs .products-tab').forEach(b => {
    b.onclick = () => {
      activeFilter = b.dataset.filter;
      setActiveTab();
      renderTable();
    };
  });

  const searchEl = document.getElementById('products-search');
  let searchTimer;
  searchEl.oninput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchQuery = searchEl.value;
      renderTable();
    }, 150);
  };

  // ---- Filter/sort change handlers ----
  sortSelect.onchange = () => {
    sortBy = sortSelect.value;
    updateClearVisibility();
    renderTable();
  };

  brandSelect.onchange = () => {
    brandFilter = brandSelect.value;
    updateClearVisibility();
    renderTable();
  };

  categorySelect.onchange = () => {
    categoryFilter = categorySelect.value;
    updateClearVisibility();
    renderTable();
  };

  vendorSelect.onchange = () => {
    vendorFilter = vendorSelect.value;
    updateClearVisibility();
    renderTable();
  };

  flagsSelect.onchange = () => {
    flagsFilter = flagsSelect.value;
    updateClearVisibility();
    renderTable();
  };

  stockSelect.onchange = () => {
    stockFilter = stockSelect.value;
    updateClearVisibility();
    renderTable();
  };

  clearBtn.onclick = () => {
    sortBy = 'newest';
    brandFilter = '';
    categoryFilter = '';
    vendorFilter = '';
    flagsFilter = '';
    stockFilter = '';
    sortSelect.value = 'newest';
    brandSelect.value = '';
    categorySelect.value = '';
    vendorSelect.value = '';
    flagsSelect.value = '';
    stockSelect.value = '';
    searchEl.value = '';
    searchQuery = '';
    activeFilter = 'all';
    setActiveTab();
    updateClearVisibility();
    renderTable();
  };

  setActiveTab();
  updateClearVisibility();
  renderTable();
}


/* ---------------- Product Detail Page ---------------- */
async function renderProductDetail(el, productId) {
  el.innerHTML = `<div class="od-page"><div class="od-body"><div class="card muted">Loading product…</div></div></div>`;

  const { data: rows, error } = await supabase
    .from('products')
    .select('*, vendors(shop_name)')
    .eq('id', productId)
    .limit(1);

  const p = rows?.[0];
  const wrap = el.querySelector('.od-page');

  if (error || !p) {
    wrap.innerHTML = `
      <div class="od-head">
        <div class="od-head-left">
          <button class="od-back" id="pd-back">Back to Products</button>
        </div>
      </div>
      <div class="od-error">
        <h2>Product not found</h2>
        <p>${error ? esc(error.message) : 'This product may have been deleted.'}</p>
      </div>`;
    document.getElementById('pd-back').onclick = () => {
      viewingProductId = null;
      renderTab();
    };
    return;
  }

  const vendorName = p.vendors?.shop_name || 'Roseller Official';
  const tags   = Array.isArray(p.tags)   ? p.tags   : [];
  const images = Array.isArray(p.images) && p.images.length
    ? p.images
    : (p.image ? [p.image] : []);
  const sizes  = Array.isArray(p.sizes)  ? p.sizes  : [];
  const colors = Array.isArray(p.colors) ? p.colors : [];


  const statusClass = ['pending','confirmed','shipped','delivered','cancelled','live','draft','held','rejected']
    .includes(p.status) ? p.status : 'pending';

  wrap.innerHTML = `
    <div class="od-head">
      <div class="od-head-left">
        <button class="od-back" id="pd-back">Back to Products</button>
        <div class="od-title-block">
          <div class="od-title">${esc(p.name || '—')}</div>
          <div class="od-subtitle">
            <span class="mono">${esc(p.sku || '')}</span>
            <span style="color:var(--od-dim);">·</span>
            <span>${fmtDt(p.created_at)}</span>
            <span style="color:var(--od-dim);">·</span>
            <span class="od-status-chip ${statusClass}">${esc(p.status)}</span>
          </div>
        </div>
      </div>
      <div class="od-head-right" style="display:flex;gap:8px;flex-wrap:wrap;">
        ${p.status === 'pending'
          ? `<button class="btn-primary" id="pd-approve">Approve → Live</button>
             <button class="btn-secondary" id="pd-reject">Reject</button>`
          : p.status === 'live'
            ? `<button class="btn-secondary" id="pd-unlist">Unlist</button>`
            : `<button class="btn-primary" id="pd-approve">Approve → Live</button>`}
        <button class="btn-secondary" id="pd-edit">Edit</button>
        <button class="btn-danger" id="pd-delete">Delete</button>
      </div>
    </div>

    <div class="od-body">
      <div class="pd-layout">

        <div class="pd-image-col">
          <div class="pd-image-main">
            ${images.length && images[0]
              ? `<img src="${esc(images[0])}" alt="${esc(p.name || '')}"
                      onerror="this.style.display='none';this.nextElementSibling.style.display='flex';this.nextElementSibling.dataset.brokenUrl='${esc(images[0])}';">
                 <div class="pd-image-main-fallback" style="display:none;">
                   <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                   <span>Image failed to load</span>
                   <code style="font-size:10px;opacity:0.6;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;"></code>
                 </div>`
              : `<div class="pd-image-main-fallback" style="display:flex;">
                   <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                   <span>No image on this product</span>
                 </div>`
            }
          </div>
          ${images.length > 1 ? `
            <div class="pd-image-thumbs">
              ${images.slice(1, 6).map(u => `<img src="${esc(u)}" alt="">`).join('')}
            </div>` : ''}
        </div>

        <div class="pd-details-col">
          <div class="pd-price-row">
            <div class="pd-price">${fmt(p.price)}</div>
            ${p.old_price ? `<div class="pd-price-old">${fmt(p.old_price)}</div>` : ''}
          </div>

          ${p.featured || p.bestseller ? `
            <div class="product-flags" style="margin-top:8px;">
              ${p.featured ? '<span class="pflag pflag-featured">★ Featured</span>' : ''}
              ${p.bestseller ? '<span class="pflag pflag-bestseller">🔥 Bestseller</span>' : ''}
            </div>` : ''}

          <div class="pd-info-grid">
            <div class="pd-info-item">
              <span class="pd-info-label">SKU</span>
              <span class="pd-info-value mono">${esc(p.sku || '—')}</span>
            </div>
            <div class="pd-info-item">
              <span class="pd-info-label">Stock</span>
              <span class="pd-info-value mono">${p.stock ?? 0}</span>
            </div>
            <div class="pd-info-item">
              <span class="pd-info-label">Category</span>
              <span class="pd-info-value">${esc(p.category || '—')}</span>
            </div>
            <div class="pd-info-item">
              <span class="pd-info-label">Brand</span>
              <span class="pd-info-value">${esc(p.brand || '—')}</span>
            </div>
            <div class="pd-info-item">
              <span class="pd-info-label">Vendor</span>
              <span class="pd-info-value">${esc(vendorName)}</span>
            </div>
            <div class="pd-info-item">
              <span class="pd-info-label">Status</span>
              <span class="pd-info-value">${esc(p.status || '—')}</span>
            </div>
          </div>

          ${p.description ? `
            <div class="pd-section">
              <div class="pd-section-title">Description</div>
              <div class="pd-description">${esc(p.description)}</div>
            </div>` : ''}

          ${(tags.length || sizes.length || colors.length) ? `
            <div class="pd-section">
              <div class="pd-section-title">Attributes</div>
              ${tags.length ? `<div class="pd-chips-row"><span class="pd-chips-label">Tags</span><div class="pd-chips">${tags.map(t => `<span class="pd-chip">${esc(t)}</span>`).join('')}</div></div>` : ''}
              ${sizes.length ? `<div class="pd-chips-row"><span class="pd-chips-label">Sizes</span><div class="pd-chips">${sizes.map(t => `<span class="pd-chip">${esc(t)}</span>`).join('')}</div></div>` : ''}
              ${colors.length ? `<div class="pd-chips-row"><span class="pd-chips-label">Colors</span><div class="pd-chips">${colors.map(t => `<span class="pd-chip">${esc(t)}</span>`).join('')}</div></div>` : ''}
            </div>` : ''}
        </div>
      </div>
    </div>`;

  // If image failed to load, surface the URL so you know what's wrong
  const brokenFallback = wrap.querySelector('.pd-image-main-fallback[data-broken-url]');
  if (brokenFallback) {
    const codeEl = brokenFallback.querySelector('code');
    if (codeEl) codeEl.textContent = brokenFallback.dataset.brokenUrl;
  }

  document.getElementById('pd-back').onclick = () => {
    viewingProductId = null;
    renderTab();
  };

  document.getElementById('pd-edit').onclick = () => {
    viewingProductId = null;
    editingProduct = p;
    productsSubView = 'edit';
    renderTab();
  };

  document.getElementById('pd-delete').onclick = async () => {
    if (!confirm('Delete this product permanently?')) return;
    const { error: delErr } = await supabase.from('products').delete().eq('id', p.id);
    if (delErr) return alert('Failed: ' + delErr.message);
    viewingProductId = null;
    renderTab();
  };

  const approveBtn = document.getElementById('pd-approve');
  if (approveBtn) {
    approveBtn.onclick = async () => {
      approveBtn.disabled = true; approveBtn.textContent = 'Approving…';
      const { error: apErr } = await supabase.rpc('approve_product', { p_product_id: p.id });
      if (apErr) { alert('Failed: ' + apErr.message); approveBtn.disabled = false; approveBtn.textContent = 'Approve → Live'; return; }
      renderTab();
    };
  }

  const rejectBtn = document.getElementById('pd-reject');
  if (rejectBtn) {
    rejectBtn.onclick = async () => {
      const reason = prompt('Rejection reason:');
      if (!reason) return;
      rejectBtn.disabled = true; rejectBtn.textContent = 'Rejecting…';
      const { error: rejErr } = await supabase.rpc('reject_product', { p_product_id: p.id, p_reason: reason });
      if (rejErr) { alert('Failed: ' + rejErr.message); rejectBtn.disabled = false; rejectBtn.textContent = 'Reject'; return; }
      renderTab();
    };
  }

  const unlistBtn = document.getElementById('pd-unlist');
  if (unlistBtn) {
    unlistBtn.onclick = async () => {
      if (!confirm('Unlist this product? Status → held (hidden from site on next publish).')) return;
      unlistBtn.disabled = true; unlistBtn.textContent = 'Unlisting…';
      const { error: ulErr } = await supabase.from('products').update({ status: 'held' }).eq('id', p.id);
      if (ulErr) { alert('Failed: ' + ulErr.message); unlistBtn.disabled = false; unlistBtn.textContent = 'Unlist'; return; }
      renderTab();
    };
  }
}


/* ---------------- Product create/edit form ---------------- */
async function renderProductForm(el) {
  const isEdit = productsSubView === 'edit' && editingProduct;
  const p = isEdit ? editingProduct : {};

  el.innerHTML = `<div class="product-form-dark"><div class="card muted">Loading form…</div></div>`;

  // ---- fetch dropdown sources in parallel ----
  const [brandsRes, vendorsRes, categoriesRes, skuRes] = await Promise.all([
    supabase.from('brands').select('id,name,status').eq('status', 'active').order('name'),
    supabase.from('vendors').select('id,shop_name,is_active,is_suspended').eq('is_active', true).order('shop_name'),
    supabase.from('categories').select('id,name,slug,status').eq('status', 'active').order('name'),
    // For SKU auto-suggest: fetch the max numeric suffix per prefix from existing products
    supabase.from('products').select('sku').order('created_at', { ascending: false }).limit(1000),
  ]);

  const brandList   = brandsRes.data   || [];
  const vendorList  = (vendorsRes.data || []).filter(v => !v.is_suspended);
  const categoryList = categoriesRes.data || [];
  const existingSkus = (skuRes.data || []).map(x => x.sku).filter(Boolean);

  // ---- auto-SKU generator ----
  function suggestSku() {
    // Prefix: first 2 letters of product name (uppercase) + dash + category initial + dash
    // Suffix: highest existing number + 1
    const namePart = (document.getElementById('pf-name')?.value || '').trim();
    const catPart  = (document.getElementById('pf-category')?.selectedOptions?.[0]?.text || '').trim();
    const prefix   = (namePart.slice(0,2).toUpperCase() || 'PR')
                   + '-' + (catPart.slice(0,2).toUpperCase() || 'XX') + '-';
    const nums = existingSkus
      .filter(s => s.startsWith(prefix))
      .map(s => parseInt(s.slice(prefix.length), 10))
      .filter(n => !isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return prefix + String(next).padStart(3, '0');
  }

  // ---- brand value resolver: supports both `brand text` and `brand_id uuid` ----
  const currentBrandId   = p.brand_id   || null;
  const currentBrandName = p.brand      || null;
  // Match by id if present, else by name
  const selectedBrandId = currentBrandId
    || (currentBrandName ? (brandList.find(b => b.name === currentBrandName)?.id || '') : '');

  const currentCategoryId   = p.category_id || null;
  const currentCategoryName = p.category    || null;
  const selectedCategoryId = currentCategoryId
    || (currentCategoryName ? (categoryList.find(c => c.name === currentCategoryName)?.id || '') : '');

  el.innerHTML = `
    <div class="main-head">
      <div>
        <h1>${isEdit ? 'Edit Product' : 'New Product'}</h1>
        <p>${isEdit ? esc(p.name || '') : 'Create a new product for the store'}</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn-secondary" id="pf-cancel" style="font-size:13.5px;">Cancel</button>
        <button class="btn-primary" id="pf-save" style="font-size:13.5px;">${isEdit ? 'Save Changes' : 'Create Product'}</button>
      </div>
    </div>

    <div class="product-form-dark">
      <div class="pf-grid">
        <div class="pf-image-card">
          <div class="pf-image-frame" id="pf-image-frame">
            ${p.image
              ? `<img src="${esc(p.image)}" alt="" onerror="this.style.display='none';document.getElementById('pf-image-empty').style.display='flex';">`
              : ''}
            <div class="pf-image-empty" id="pf-image-empty" style="display:${p.image ? 'none' : 'flex'};">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <span>No image</span>
              <small>Paste a URL below</small>
            </div>
          </div>
          <div class="pf-image-controls">
            <div class="pf-image-label">Image URL</div>
            <input id="pf-image" type="url" value="${esc(p.image || '')}" placeholder="https://…">
            <button class="pf-image-clear" id="pf-image-clear" type="button">Clear image</button>
          </div>
          <div class="pf-image-hint">Square image recommended (1000×1000)</div>
        </div>

        <div class="pf-fields-col">
          <div class="pf-section-title">Basic</div>

          <div class="pf-field">
            <label>Product Name *</label>
            <input id="pf-name" type="text" value="${esc(p.name || '')}" placeholder="e.g. Classic Leather Wallet">
          </div>

          <div class="pf-row-2">
            <div class="pf-field">
              <label>SKU * <span class="pf-hint-inline">(auto)</span></label>
              <div class="pf-sku-row">
                <input id="pf-sku" type="text" value="${esc(p.sku || '')}" placeholder="e.g. WA-AC-001">
                <button class="pf-sku-suggest" id="pf-sku-suggest" type="button" title="Suggest SKU">↻</button>
              </div>
            </div>
            <div class="pf-field">
              <label>Category</label>
              <select id="pf-category">
                <option value="">— Select category —</option>
                ${categoryList.map(c =>
                  `<option value="${esc(c.id)}" ${selectedCategoryId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`
                ).join('')}
              </select>
            </div>
          </div>

          <div class="pf-row-2">
            <div class="pf-field">
              <label>Brand</label>
              <select id="pf-brand">
                <option value="">— Select brand —</option>
                ${brandList.map(b =>
                  `<option value="${esc(b.id)}" ${selectedBrandId === b.id ? 'selected' : ''}>${esc(b.name)}</option>`
                ).join('')}
              </select>
            </div>
            <div class="pf-field">
              <label>Vendor</label>
              <select id="pf-vendor">
                <option value="">Roseller Official (no vendor)</option>
                ${vendorList.map(v =>
                  `<option value="${esc(v.id)}" ${p.vendor_id === v.id ? 'selected' : ''}>${esc(v.shop_name)}</option>`
                ).join('')}
              </select>
            </div>
          </div>

          <div class="pf-section-title">Pricing &amp; Stock</div>

          <div class="pf-row-2">
            <div class="pf-field">
              <label>Price (৳) *</label>
              <input id="pf-price" type="number" min="0" step="0.01" value="${p.price ?? ''}" placeholder="0.00">
            </div>
            <div class="pf-field">
              <label>Old Price (৳)</label>
              <input id="pf-old-price" type="number" min="0" step="0.01" value="${p.old_price ?? ''}" placeholder="optional">
            </div>
          </div>

          <div class="pf-row-2">
            <div class="pf-field">
              <label>Stock</label>
              <input id="pf-stock" type="number" min="0" step="1" value="${p.stock ?? 0}" placeholder="0">
            </div>
            <div class="pf-field">
              <label>Status</label>
              <select id="pf-status">
                ${['draft','pending','live','held','rejected'].map(s =>
                  `<option value="${s}" ${p.status === s ? 'selected' : ''}>${s}</option>`
                ).join('')}
              </select>
            </div>
          </div>

          <div class="pf-section-title">Details</div>

          <div class="pf-field">
            <label>Description</label>
            <textarea id="pf-description" rows="4" placeholder="Short description shown on the product page">${esc(p.description || '')}</textarea>
          </div>

          <div class="pf-row-2">
            <div class="pf-field">
              <label>Tags (comma separated)</label>
              <input id="pf-tags" type="text" value="${esc((p.tags || []).join(', '))}" placeholder="e.g. new, bestseller">
            </div>
            <div class="pf-field">
              <label>Featured / Bestseller</label>
              <select id="pf-flags">
                <option value="">Neither</option>
                <option value="featured" ${p.featured ? 'selected' : ''}>Featured</option>
                <option value="bestseller" ${p.bestseller ? 'selected' : ''}>Bestseller</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  // ---- image preview ----
  const imageInput = document.getElementById('pf-image');
  const imageFrame = document.getElementById('pf-image-frame');
  const imageEmpty = document.getElementById('pf-image-empty');

  function refreshImagePreview() {
    const url = imageInput.value.trim();
    imageFrame.querySelectorAll('img').forEach(n => n.remove());
    if (!url) { imageEmpty.style.display = 'flex'; return; }
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    img.onerror = () => { img.remove(); imageEmpty.style.display = 'flex'; };
    img.onload = () => { imageEmpty.style.display = 'none'; };
    imageFrame.insertBefore(img, imageEmpty);
  }
  imageInput.addEventListener('input', refreshImagePreview);

  document.getElementById('pf-image-clear').onclick = () => {
    imageInput.value = '';
    refreshImagePreview();
  };

  // ---- SKU auto-suggest ----
  document.getElementById('pf-sku-suggest').onclick = () => {
    document.getElementById('pf-sku').value = suggestSku();
  };

  // Auto-fill SKU when creating AND the field is empty
  if (!isEdit) {
    const nameEl = document.getElementById('pf-name');
    const catSel = document.getElementById('pf-category');
    const skuEl  = document.getElementById('pf-sku');
    const refreshSku = () => { if (!skuEl.dataset.touched) skuEl.value = suggestSku(); };
    nameEl.addEventListener('input', refreshSku);
    catSel.addEventListener('change', refreshSku);
    skuEl.addEventListener('input', () => { skuEl.dataset.touched = '1'; });
    refreshSku();
  }

  // ---- cancel ----
  document.getElementById('pf-cancel').onclick = () => {
    if (!confirm('Discard changes?')) return;
    editingProduct = null;
    productsSubView = 'list';
    renderTab();
  };

  // ---- save ----
  document.getElementById('pf-save').onclick = async () => {
    const btn = document.getElementById('pf-save');
    const name = document.getElementById('pf-name').value.trim();
    const sku  = document.getElementById('pf-sku').value.trim();
    const priceRaw = document.getElementById('pf-price').value;

    if (!name) { alert('Product name is required'); return; }
    if (!sku)  { alert('SKU is required'); return; }
    if (!priceRaw || isNaN(Number(priceRaw))) { alert('Valid price is required'); return; }

    const tagsRaw = document.getElementById('pf-tags').value.trim();
    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
    const flag = document.getElementById('pf-flags').value;

    const brandId    = document.getElementById('pf-brand').value || null;
    const vendorId   = document.getElementById('pf-vendor').value || null;
    const categoryId = document.getElementById('pf-category').value || null;
    const categoryName = categoryId
      ? (categoryList.find(c => c.id === categoryId)?.name || null)
      : null;
    const brandName = brandId
      ? (brandList.find(b => b.id === brandId)?.name || null)
      : null;

    const payload = {
      name,
      sku,
      // Always set both representations so the DB works whether it has text or FK columns
      category:    categoryName,
      category_id: categoryId,
      brand:       brandName,
      brand_id:    brandId,
      vendor_id:   vendorId,
      price: Number(priceRaw),
      old_price: document.getElementById('pf-old-price').value
        ? Number(document.getElementById('pf-old-price').value)
        : null,
      stock: Number(document.getElementById('pf-stock').value || 0),
      status: document.getElementById('pf-status').value,
      description: document.getElementById('pf-description').value.trim() || null,
      image: imageInput.value.trim() || null,
      tags,
      featured: flag === 'featured',
      bestseller: flag === 'bestseller',
      updated_at: new Date().toISOString(),
    };

    // Trim keys the table doesn't have (safe for either schema)
    // We try INSERT first; if it fails on an unknown column, retry without the extras.
    btn.disabled = true;
    btn.textContent = isEdit ? 'Saving…' : 'Creating…';

    try {
      if (isEdit) {
        const { error } = await supabase.from('products').update(payload).eq('id', editingProduct.id);
        if (error) throw error;
      } else {
        payload.created_at = new Date().toISOString();
        const { error } = await supabase.from('products').insert(payload);
        if (error) throw error;
      }

      editingProduct = null;
      productsSubView = 'list';
      renderTab();
    } catch (err) {
      alert('Save failed: ' + (err?.message || err));
      btn.disabled = false;
      btn.textContent = isEdit ? 'Save Changes' : 'Create Product';
    }
  };
}

/* ---------------- Vendors ---------------- */
async function renderVendors(el) {
  el.innerHTML = `
    <div class="main-head">
      <div><h1>Vendors</h1><p>Approve applications, manage active shops</p></div>
    </div>

    <div class="vendors-toolbar">
      <div class="vendors-tabs" id="vendors-tabs">
        <button class="vendors-tab" data-filter="pending">Pending <span class="vendors-tab-count" id="vcnt-pending">—</span></button>
        <button class="vendors-tab" data-filter="active">Active <span class="vendors-tab-count" id="vcnt-active">—</span></button>
        <button class="vendors-tab" data-filter="suspended">Suspended <span class="vendors-tab-count" id="vcnt-suspended">—</span></button>
        <button class="vendors-tab" data-filter="all">All <span class="vendors-tab-count" id="vcnt-all">—</span></button>
      </div>
      <div class="vendors-search">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input id="vendors-search" type="text" placeholder="Search shop, owner, email…" autocomplete="off">
      </div>
    </div>

    <div id="vendors-table-wrap"><div class="card muted">Loading…</div></div>`;

  const [{ data: vendors, error }, { data: profiles }, { data: products }] = await Promise.all([
    supabase.from('vendors').select('*').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, email'),
    supabase.from('products').select('vendor_id, status'),
  ]);

  const wrap = document.getElementById('vendors-table-wrap');
  if (error) {
    wrap.innerHTML = `<div class="card">${esc(error.message)}</div>`;
    return;
  }

  // lookup maps
  const profileById = new Map();
  (profiles || []).forEach(p => profileById.set(p.id, p));

  const productStats = new Map();
  (products || []).forEach(prod => {
    if (!prod.vendor_id) return;
    const s = productStats.get(prod.vendor_id) || { total: 0, live: 0, pending: 0 };
    s.total++;
    if (prod.status === 'live') s.live++;
    if (prod.status === 'pending') s.pending++;
    productStats.set(prod.vendor_id, s);
  });

  const list = vendors || [];

  // counts
  const cPending   = list.filter(v => !v.is_active).length;
  const cActive    = list.filter(v => v.is_active && !v.is_suspended).length;
  const cSuspended = list.filter(v => v.is_suspended).length;
  document.getElementById('vcnt-pending').textContent   = cPending;
  document.getElementById('vcnt-active').textContent    = cActive;
  document.getElementById('vcnt-suspended').textContent = cSuspended;
  document.getElementById('vcnt-all').textContent       = list.length;

  let activeFilter = 'all';
  let searchQuery  = '';

  function setActiveTab() {
    document.querySelectorAll('#vendors-tabs .vendors-tab').forEach(b => {
      b.classList.toggle('active', b.dataset.filter === activeFilter);
    });
  }

  function filtered() {
    const q = searchQuery.toLowerCase().trim();
    let rows = list;
    if (activeFilter === 'pending')        rows = rows.filter(v => !v.is_active);
    else if (activeFilter === 'active')    rows = rows.filter(v => v.is_active && !v.is_suspended);
    else if (activeFilter === 'suspended') rows = rows.filter(v => v.is_suspended);

    if (q) {
      rows = rows.filter(v => {
        const owner = profileById.get(v.user_id);
        return (
          (v.shop_name || '').toLowerCase().includes(q) ||
          (v.shop_slug || '').toLowerCase().includes(q) ||
          (v.email || '').toLowerCase().includes(q) ||
          (owner?.full_name || '').toLowerCase().includes(q) ||
          (owner?.email || '').toLowerCase().includes(q)
        );
      });
    }
    return rows;
  }

  function statusBadge(v) {
    if (v.is_suspended) return '<span class="vendors-status suspended">Suspended</span>';
    if (v.is_active)    return '<span class="vendors-status active">Active</span>';
    return '<span class="vendors-status pending">Pending</span>';
  }

  function actionButtons(v) {
    if (!v.is_active) {
      return `
        <button class="btn-primary" data-vendor-action="approve" data-id="${v.id}">Approve</button>
        <button class="btn-secondary" data-vendor-action="reject" data-id="${v.id}">Reject</button>`;
    }
    if (v.is_suspended) {
      return `<button class="btn-secondary" data-vendor-action="unsuspend" data-id="${v.id}">Unsuspend</button>`;
    }
    return `<button class="btn-secondary" data-vendor-action="suspend" data-id="${v.id}" style="color:var(--red);border-color:var(--red);">Suspend</button>`;
  }

  function renderTable() {
    const box = document.getElementById('vendors-table-wrap');
    const rows = filtered();

    if (!rows.length) {
      box.innerHTML = `
        <div class="card empty">
          <div class="empty-icon">🏪</div>
          ${searchQuery ? 'No vendors match your search.' : 'No vendors in this section.'}
        </div>`;
      return;
    }

    box.innerHTML = `
      <div class="vendors-section">
        <div class="vendors-section-head">
          <div class="vendors-section-title">Vendors</div>
          <div class="vendors-section-count">${rows.length} vendor${rows.length === 1 ? '' : 's'}</div>
        </div>
        <div class="vendors-scroll">
          <table class="vendors-table">
            <thead>
              <tr>
                <th>Shop</th>
                <th>Owner</th>
                <th>Contact</th>
                <th>Applied</th>
                <th>Approved</th>
                <th>Status</th>
                <th class="num">Products</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(v => {
                const owner = profileById.get(v.user_id);
                const ownerName = owner?.full_name || '(no profile)';
                const ownerEmail = owner?.email || '';
                const stats = productStats.get(v.id) || { total: 0, live: 0, pending: 0 };
                const initials2 = initials(v.shop_name || '?');

                return `
                  <tr data-vendor-id="${v.id}">
                    <td>
                      <div class="vendors-shop">
                        ${v.logo_url
                          ? `<img class="vendors-logo" src="${esc(v.logo_url)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                             <div class="vendors-logo-fallback" style="display:none;">${initials2}</div>`
                          : `<div class="vendors-logo-fallback">${initials2}</div>`}
                        <div class="vendors-shop-info">
                          <div class="vendors-shop-name" title="${esc(v.shop_name)}">${esc(v.shop_name || '—')}</div>
                          <div class="vendors-shop-slug" title="${esc(v.shop_slug || '')}">/${esc(v.shop_slug || '—')}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div class="vendors-owner">${esc(ownerName)}</div>
                      ${ownerEmail ? `<div class="vendors-owner-email">${esc(ownerEmail)}</div>` : ''}
                    </td>
                    <td>
                      ${v.phone ? `<div class="vendors-phone">${esc(v.phone)}</div>` : ''}
                      ${v.email ? `<div class="vendors-email">${esc(v.email)}</div>` : ''}
                      ${!v.phone && !v.email ? '<span style="color:var(--muted);">—</span>' : ''}
                    </td>
                    <td class="muted">${fmtDt(v.created_at)}</td>
                    <td class="muted">${v.approved_at ? fmtDt(v.approved_at) : '—'}</td>
                    <td>${statusBadge(v)}</td>
                    <td class="num mono">${stats.total}${stats.live ? ` <span style="color:#10b981;font-size:10px;">(${stats.live} live)</span>` : ''}</td>
                    <td style="text-align:right;white-space:nowrap;">
                      <div class="vendors-actions">
                        ${actionButtons(v)}
                      </div>
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;

    box.querySelectorAll('[data-vendor-action]').forEach(b => {
      b.onclick = async () => {
        const action = b.dataset.vendorAction;
        const id = b.dataset.id;

        if (action === 'approve') {
          b.disabled = true; b.textContent = 'Approving…';
          const { error } = await supabase.rpc('approve_vendor', { p_vendor_id: id });
          if (error) { alert('Failed: ' + error.message); b.disabled = false; b.textContent = 'Approve'; return; }
          renderTab();
        } else if (action === 'reject') {
          if (!confirm('Reject this vendor application? The vendor row will be deleted permanently.')) return;
          b.disabled = true; b.textContent = 'Rejecting…';
          const { error } = await supabase.rpc('reject_vendor', { p_vendor_id: id });
          if (error) { alert('Failed: ' + error.message); b.disabled = false; b.textContent = 'Reject'; return; }
          renderTab();
        } else if (action === 'suspend') {
          if (!confirm('Suspend this vendor? All their live products will be held.')) return;
          const { error } = await supabase.rpc('suspend_vendor', { p_vendor_id: id });
          if (error) return alert('Failed: ' + error.message);
          renderTab();
        } else if (action === 'unsuspend') {
          const { error } = await supabase.rpc('unsuspend_vendor', { p_vendor_id: id });
          if (error) return alert('Failed: ' + error.message);
          renderTab();
        }
      };
    });
  }

  document.querySelectorAll('#vendors-tabs .vendors-tab').forEach(b => {
    b.onclick = () => {
      activeFilter = b.dataset.filter;
      setActiveTab();
      renderTable();
    };
  });

  const searchEl = document.getElementById('vendors-search');
  let searchTimer;
  searchEl.oninput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchQuery = searchEl.value;
      renderTable();
    }, 150);
  };

  setActiveTab();
  renderTable();
}

/* ---------------- Brands ---------------- */
async function renderBrands(el) {
  el.innerHTML = `
    <div class="main-head">
      <div><h1>Brands</h1><p>Manage product brands</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn-primary" id="new-brand-btn" style="font-size:13.5px;">+ Add Brand</button>
      </div>
    </div>

    <div class="brands-toolbar">
      <div class="brands-tabs" id="brands-tabs">
        <button class="brands-tab" data-filter="active">Active <span class="brands-tab-count" id="bcnt-active">—</span></button>
        <button class="brands-tab" data-filter="suspended">Suspended <span class="brands-tab-count" id="bcnt-suspended">—</span></button>
        <button class="brands-tab" data-filter="all">All <span class="brands-tab-count" id="bcnt-all">—</span></button>
      </div>
      <div class="brands-search">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input id="brands-search" type="text" placeholder="Search brand name or slug…" autocomplete="off">
      </div>
    </div>

    <div id="brands-table-wrap"><div class="card muted">Loading…</div></div>`;

  document.getElementById('new-brand-btn').onclick = () => openBrandModal();

  const [{ data: brands, error }, { data: products }] = await Promise.all([
    supabase.from('brands').select('*').order('name'),
    supabase.from('products').select('brand_id'),
  ]);

  const wrap = document.getElementById('brands-table-wrap');
  if (error) {
    wrap.innerHTML = `<div class="card">${esc(error.message)}</div>`;
    return;
  }

  // count products per brand
  const productCount = new Map();
  (products || []).forEach(p => {
    if (!p.brand_id) return;
    productCount.set(p.brand_id, (productCount.get(p.brand_id) || 0) + 1);
  });

  const list = brands || [];

  // counts
  const cActive    = list.filter(b => b.status === 'active').length;
  const cSuspended = list.filter(b => b.status === 'suspended').length;
  document.getElementById('bcnt-active').textContent    = cActive;
  document.getElementById('bcnt-suspended').textContent = cSuspended;
  document.getElementById('bcnt-all').textContent       = list.length;

  let activeFilter = 'active';
  let searchQuery  = '';

  function setActiveTab() {
    document.querySelectorAll('#brands-tabs .brands-tab').forEach(b => {
      b.classList.toggle('active', b.dataset.filter === activeFilter);
    });
  }

  function filtered() {
    const q = searchQuery.toLowerCase().trim();
    let rows = list;
    if (activeFilter === 'active')         rows = rows.filter(b => b.status === 'active');
    else if (activeFilter === 'suspended') rows = rows.filter(b => b.status === 'suspended');

    if (q) {
      rows = rows.filter(b =>
        (b.name || '').toLowerCase().includes(q) ||
        (b.slug || '').toLowerCase().includes(q)
      );
    }
    return rows;
  }

  function statusBadge(b) {
    if (b.status === 'suspended') return '<span class="brands-status suspended">Suspended</span>';
    return '<span class="brands-status active">Active</span>';
  }

  function renderTable() {
    const box = document.getElementById('brands-table-wrap');
    const rows = filtered();

    if (!rows.length) {
      box.innerHTML = `
        <div class="card empty">
          <div class="empty-icon">🎨</div>
          ${searchQuery ? 'No brands match your search.' : 'No brands in this section.'}
        </div>`;
      return;
    }

    box.innerHTML = `
      <div class="brands-section">
        <div class="brands-section-head">
          <div class="brands-section-title">Brands</div>
          <div class="brands-section-count">${rows.length} brand${rows.length === 1 ? '' : 's'}</div>
        </div>
        <div class="brands-scroll">
          <table class="brands-table">
            <thead>
              <tr>
                <th>Brand</th>
                <th>Slug</th>
                <th class="num">Products</th>
                <th>Created</th>
                <th>Status</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(b => {
                const count = productCount.get(b.id) || 0;
                const initials2 = initials(b.name || '?');
                return `
                  <tr data-brand-id="${b.id}">
                    <td>
                      <div class="brands-brand">
                        ${b.logo_url
                          ? `<img class="brands-logo" src="${esc(b.logo_url)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                             <div class="brands-logo-fallback" style="display:none;">${initials2}</div>`
                          : `<div class="brands-logo-fallback">${initials2}</div>`}
                        <div class="brands-brand-info">
                          <div class="brands-brand-name" title="${esc(b.name)}">${esc(b.name || '—')}</div>
                          ${b.description ? `<div class="brands-brand-desc" title="${esc(b.description)}">${esc(b.description)}</div>` : ''}
                        </div>
                      </div>
                    </td>
                    <td class="mono" title="${esc(b.slug || '')}">${esc(b.slug || '—')}</td>
                    <td class="num mono">${count}</td>
                    <td class="muted">${fmtDt(b.created_at)}</td>
                    <td>${statusBadge(b)}</td>
                    <td style="text-align:right;white-space:nowrap;">
                      <div class="brands-actions">
                        <button class="btn-secondary" data-brand-action="edit" data-id="${b.id}">Edit</button>
                        ${b.status === 'suspended'
                          ? `<button class="btn-primary" data-brand-action="unsuspend" data-id="${b.id}">Activate</button>`
                          : `<button class="btn-secondary" data-brand-action="suspend" data-id="${b.id}">Suspend</button>`}
                        <button class="btn-danger" data-brand-action="delete" data-id="${b.id}">Delete</button>
                      </div>
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;

    box.querySelectorAll('[data-brand-action]').forEach(btn => {
      btn.onclick = async () => {
        const action = btn.dataset.brandAction;
        const id = btn.dataset.id;
        const brand = list.find(b => b.id === id);

        if (action === 'edit') {
          openBrandModal(brand);
          return;
        }

        if (action === 'suspend') {
          if (!confirm(`Suspend "${brand.name}"? Products using this brand will stay but the brand becomes unavailable for new products.`)) return;
          btn.disabled = true; btn.textContent = 'Suspending…';
          const { error } = await supabase.rpc('update_brand', {
            p_brand_id: id,
            p_status: 'suspended',
          });
          if (error) { alert('Failed: ' + error.message); btn.disabled = false; btn.textContent = 'Suspend'; return; }
          renderTab();
          return;
        }

        if (action === 'unsuspend') {
          btn.disabled = true; btn.textContent = 'Activating…';
          const { error } = await supabase.rpc('update_brand', {
            p_brand_id: id,
            p_status: 'active',
          });
          if (error) { alert('Failed: ' + error.message); btn.disabled = false; btn.textContent = 'Activate'; return; }
          renderTab();
          return;
        }

        if (action === 'delete') {
          const brandCount = productCount.get(id) || 0;
          if (brandCount > 0 && !confirm(`"${brand.name}" has ${brandCount} product(s). Deleting will unlink them. Continue?`)) return;
          if (brandCount === 0 && !confirm(`Delete "${brand.name}"?`)) return;
          btn.disabled = true; btn.textContent = 'Deleting…';
          const { error } = await supabase.rpc('delete_brand', { p_brand_id: id });
          if (error) { alert('Failed: ' + error.message); btn.disabled = false; btn.textContent = 'Delete'; return; }
          renderTab();
        }
      };
    });
  }

  document.querySelectorAll('#brands-tabs .brands-tab').forEach(b => {
    b.onclick = () => {
      activeFilter = b.dataset.filter;
      setActiveTab();
      renderTable();
    };
  });

  const searchEl = document.getElementById('brands-search');
  let searchTimer;
  searchEl.oninput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchQuery = searchEl.value;
      renderTable();
    }, 150);
  };

  setActiveTab();
  renderTable();
}


/* ---------------- Categories ---------------- */
async function renderCategories(el) {
  el.innerHTML = `
    <div class="main-head">
      <div><h1>Categories</h1><p>Manage product categories</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn-primary" id="new-category-btn" style="font-size:13.5px;">+ Add Category</button>
      </div>
    </div>

    <div class="brands-toolbar">
      <div class="brands-tabs" id="categories-tabs">
        <button class="brands-tab" data-filter="active">Active <span class="brands-tab-count" id="ccnt-active">—</span></button>
        <button class="brands-tab" data-filter="suspended">Suspended <span class="brands-tab-count" id="ccnt-suspended">—</span></button>
        <button class="brands-tab" data-filter="all">All <span class="brands-tab-count" id="ccnt-all">—</span></button>
      </div>
      <div class="brands-search">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input id="categories-search" type="text" placeholder="Search category name or slug…" autocomplete="off">
      </div>
    </div>

    <div id="categories-table-wrap"><div class="card muted">Loading…</div></div>`;

  document.getElementById('new-category-btn').onclick = () => openCategoryModal();

  const [{ data: categories, error }, { data: products }] = await Promise.all([
    supabase.from('categories').select('*').order('name'),
    supabase.from('products').select('category_id,category'),
  ]);

  const wrap = document.getElementById('categories-table-wrap');
  if (error) {
    wrap.innerHTML = `<div class="card">${esc(error.message)}</div>`;
    return;
  }

  const countById = new Map();
  const countByName = new Map();
  (products || []).forEach(p => {
    if (p.category_id) countById.set(p.category_id, (countById.get(p.category_id) || 0) + 1);
    if (p.category)    countByName.set(p.category, (countByName.get(p.category) || 0) + 1);
  });

  const list = categories || [];

  const cActive    = list.filter(c => c.status === 'active').length;
  const cSuspended = list.filter(c => c.status === 'suspended').length;
  document.getElementById('ccnt-active').textContent    = cActive;
  document.getElementById('ccnt-suspended').textContent = cSuspended;
  document.getElementById('ccnt-all').textContent       = list.length;

  let activeFilter = 'active';
  let searchQuery  = '';

  function setActiveTab() {
    document.querySelectorAll('#categories-tabs .brands-tab').forEach(b => {
      b.classList.toggle('active', b.dataset.filter === activeFilter);
    });
  }

  function filtered() {
    const q = searchQuery.toLowerCase().trim();
    let rows = list;
    if (activeFilter === 'active')         rows = rows.filter(c => c.status === 'active');
    else if (activeFilter === 'suspended') rows = rows.filter(c => c.status === 'suspended');
    if (q) {
      rows = rows.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.slug || '').toLowerCase().includes(q)
      );
    }
    return rows;
  }

  function statusBadge(c) {
    if (c.status === 'suspended') return '<span class="brands-status suspended">Suspended</span>';
    return '<span class="brands-status active">Active</span>';
  }

  function renderTable() {
    const box = document.getElementById('categories-table-wrap');
    const rows = filtered();

    if (!rows.length) {
      box.innerHTML = `
        <div class="card empty">
          <div class="empty-icon">📂</div>
          ${searchQuery ? 'No categories match your search.' : 'No categories in this section.'}
        </div>`;
      return;
    }

    box.innerHTML = `
      <div class="brands-section">
        <div class="brands-section-head">
          <div class="brands-section-title">Categories</div>
          <div class="brands-section-count">${rows.length} categor${rows.length === 1 ? 'y' : 'ies'}</div>
        </div>
        <div class="brands-scroll">
          <table class="brands-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Slug</th>
                <th class="num">Products</th>
                <th>Created</th>
                <th>Status</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(c => {
                const count = (countById.get(c.id) || 0) || (countByName.get(c.name) || 0);
                const initials2 = initials(c.name || '?');
                return `
                  <tr data-category-id="${c.id}">
                    <td>
                      <div class="brands-brand">
                        <div class="brands-logo-fallback">${initials2}</div>
                        <div class="brands-brand-info">
                          <div class="brands-brand-name" title="${esc(c.name)}">${esc(c.name || '—')}</div>
                          ${c.description ? `<div class="brands-brand-desc" title="${esc(c.description)}">${esc(c.description)}</div>` : ''}
                        </div>
                      </div>
                    </td>
                    <td class="mono" title="${esc(c.slug || '')}">${esc(c.slug || '—')}</td>
                    <td class="num mono">${count}</td>
                    <td class="muted">${fmtDt(c.created_at)}</td>
                    <td>${statusBadge(c)}</td>
                    <td style="text-align:right;white-space:nowrap;">
                      <div class="brands-actions">
                        <button class="btn-secondary" data-category-action="edit" data-id="${c.id}">Edit</button>
                        ${c.status === 'suspended'
                          ? `<button class="btn-primary" data-category-action="activate" data-id="${c.id}">Activate</button>`
                          : `<button class="btn-secondary" data-category-action="suspend" data-id="${c.id}">Suspend</button>`}
                        <button class="btn-danger" data-category-action="delete" data-id="${c.id}">Delete</button>
                      </div>
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;

    box.querySelectorAll('[data-category-action]').forEach(btn => {
      btn.onclick = async () => {
        const action = btn.dataset.categoryAction;
        const id = btn.dataset.id;
        const cat = list.find(c => c.id === id);

        if (action === 'edit') {
          openCategoryModal(cat);
          return;
        }
        if (action === 'suspend') {
          if (!confirm(`Suspend "${cat.name}"?`)) return;
          btn.disabled = true; btn.textContent = 'Suspending…';
          const { error } = await supabase.from('categories')
            .update({ status: 'suspended', updated_at: new Date().toISOString() })
            .eq('id', id);
          if (error) { alert('Failed: ' + error.message); btn.disabled = false; btn.textContent = 'Suspend'; return; }
          renderTab();
          return;
        }
        if (action === 'activate') {
          btn.disabled = true; btn.textContent = 'Activating…';
          const { error } = await supabase.from('categories')
            .update({ status: 'active', updated_at: new Date().toISOString() })
            .eq('id', id);
          if (error) { alert('Failed: ' + error.message); btn.disabled = false; btn.textContent = 'Activate'; return; }
          renderTab();
          return;
        }
        if (action === 'delete') {
          const used = countById.get(id) || 0;
          if (used > 0 && !confirm(`"${cat.name}" is used by ${used} product(s). Delete anyway? Products keep their text category.`)) return;
          if (used === 0 && !confirm(`Delete "${cat.name}"?`)) return;
          btn.disabled = true; btn.textContent = 'Deleting…';
          const { error } = await supabase.from('categories').delete().eq('id', id);
          if (error) { alert('Failed: ' + error.message); btn.disabled = false; btn.textContent = 'Delete'; return; }
          renderTab();
        }
      };
    });
  }

  document.querySelectorAll('#categories-tabs .brands-tab').forEach(b => {
    b.onclick = () => {
      activeFilter = b.dataset.filter;
      setActiveTab();
      renderTable();
    };
  });

  const searchEl = document.getElementById('categories-search');
  let searchTimer;
  searchEl.oninput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchQuery = searchEl.value;
      renderTable();
    }, 150);
  };

  setActiveTab();
  renderTable();
}

/* ---------------- Category create/edit modal ---------------- */
function openCategoryModal(category = null) {
  const isEdit = !!category;
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-head">
        <h2>${isEdit ? 'Edit Category' : 'New Category'}</h2>
        <button class="modal-close" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="form-field">
          <label>Category Name *</label>
          <input id="cm-name" type="text" value="${esc(category?.name || '')}" placeholder="e.g. Accessories" required>
        </div>
        <div class="form-field">
          <label>Slug (URL) *</label>
          <input id="cm-slug" type="text" value="${esc(category?.slug || '')}" placeholder="e.g. accessories">
        </div>
        <div class="form-field">
          <label>Description</label>
          <textarea id="cm-desc" rows="3" placeholder="Optional">${esc(category?.description || '')}</textarea>
        </div>
        <div class="modal-error" id="cm-error" style="display:none;"></div>
      </div>
      <div class="modal-foot">
        <button class="btn-secondary" id="cm-cancel">Cancel</button>
        <button class="btn-primary" id="cm-save">${isEdit ? 'Save Changes' : 'Create Category'}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const nameEl = overlay.querySelector('#cm-name');
  const slugEl = overlay.querySelector('#cm-slug');
  if (!isEdit) {
    let slugTouched = false;
    slugEl.addEventListener('input', () => { slugTouched = true; });
    nameEl.addEventListener('input', () => {
      if (!slugTouched) slugEl.value = slugify(nameEl.value);
    });
  }

  const close = () => overlay.remove();
  overlay.querySelector('.modal-close').onclick = close;
  overlay.querySelector('#cm-cancel').onclick = close;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });

  const errEl = overlay.querySelector('#cm-error');
  const showErr = (msg) => { errEl.textContent = msg; errEl.style.display = 'block'; };

  overlay.querySelector('#cm-save').onclick = async () => {
    const name = nameEl.value.trim();
    const slug = slugEl.value.trim();
    const desc = overlay.querySelector('#cm-desc').value.trim();

    if (!name) { showErr('Category name is required'); return; }
    if (!slug) { showErr('Slug is required'); return; }

    errEl.style.display = 'none';
    const btn = overlay.querySelector('#cm-save');
    btn.disabled = true;
    btn.textContent = isEdit ? 'Saving…' : 'Creating…';

    try {
      if (isEdit) {
        const { error } = await supabase.from('categories').update({
          name,
          slug,
          description: desc || null,
          updated_at: new Date().toISOString(),
        }).eq('id', category.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('categories').insert({
          name,
          slug,
          description: desc || null,
        });
        if (error) throw error;
      }

      close();
      renderTab();
    } catch (err) {
      showErr(err.message || 'Save failed');
      btn.disabled = false;
      btn.textContent = isEdit ? 'Save Changes' : 'Create Category';
    }
  };
}

/* ---------------- Brand create/edit modal ---------------- */
function openBrandModal(brand = null) {
  const isEdit = !!brand;
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-head">
        <h2>${isEdit ? 'Edit Brand' : 'New Brand'}</h2>
        <button class="modal-close" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="form-field">
          <label>Brand Name *</label>
          <input id="bm-name" type="text" value="${esc(brand?.name || '')}" placeholder="e.g. Roseller" required>
        </div>
        <div class="form-field">
          <label>Slug (URL) *</label>
          <input id="bm-slug" type="text" value="${esc(brand?.slug || '')}" placeholder="e.g. roseller">
        </div>
        <div class="form-field">
          <label>Logo URL</label>
          <input id="bm-logo" type="url" value="${esc(brand?.logo_url || '')}" placeholder="https://res.cloudinary.com/…">
        </div>
        <div class="form-field">
          <label>Description</label>
          <textarea id="bm-desc" rows="3" placeholder="Optional">${esc(brand?.description || '')}</textarea>
        </div>
        <div class="modal-error" id="bm-error" style="display:none;"></div>
      </div>
      <div class="modal-foot">
        <button class="btn-secondary" id="bm-cancel">Cancel</button>
        <button class="btn-primary" id="bm-save">${isEdit ? 'Save Changes' : 'Create Brand'}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  // Auto-generate slug from name if creating
  const nameEl = overlay.querySelector('#bm-name');
  const slugEl = overlay.querySelector('#bm-slug');
  if (!isEdit) {
    let slugTouched = false;
    slugEl.addEventListener('input', () => { slugTouched = true; });
    nameEl.addEventListener('input', () => {
      if (!slugTouched) slugEl.value = slugify(nameEl.value);
    });
  }

  const close = () => overlay.remove();
  overlay.querySelector('.modal-close').onclick = close;
  overlay.querySelector('#bm-cancel').onclick = close;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });

  const errEl = overlay.querySelector('#bm-error');
  const showErr = (msg) => { errEl.textContent = msg; errEl.style.display = 'block'; };

  overlay.querySelector('#bm-save').onclick = async () => {
    const name = nameEl.value.trim();
    const slug = slugEl.value.trim();
    const logo = overlay.querySelector('#bm-logo').value.trim();
    const desc = overlay.querySelector('#bm-desc').value.trim();

    if (!name) { showErr('Brand name is required'); return; }
    if (!slug) { showErr('Slug is required'); return; }

    errEl.style.display = 'none';
    const btn = overlay.querySelector('#bm-save');
    btn.disabled = true;
    btn.textContent = isEdit ? 'Saving…' : 'Creating…';

    try {
      if (isEdit) {
        const { error } = await supabase.rpc('update_brand', {
          p_brand_id: brand.id,
          p_name: name,
          p_logo_url: logo || null,
          p_description: desc || null,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc('create_brand', {
          p_name: name,
          p_slug: slug,
          p_logo_url: logo || null,
          p_description: desc || null,
        });
        if (error) throw error;
      }

      close();
      renderTab();
    } catch (err) {
      showErr(err.message || 'Save failed');
      btn.disabled = false;
      btn.textContent = isEdit ? 'Save Changes' : 'Create Brand';
    }
  };
}

/* ---------------- Help ---------------- */
function renderHelp(el) {
  el.innerHTML = `
    <div class="main-head"><div><h1>Help</h1><p>Admin workflows</p></div></div>

    <div class="card">
      <h3>Approving vendors</h3>
      <ol style="margin:8px 0 0;padding-left:20px;font-size:13px;line-height:1.8;">
        <li>Open <strong>Vendors</strong> tab</li>
        <li>Review the <em>Pending Applications</em> section</li>
        <li>Click <strong>Approve</strong> to activate, or <strong>Reject</strong> to delete the application</li>
      </ol>
    </div>

    <div class="card">
      <h3>Managing products</h3>
      <ol style="margin:8px 0 0;padding-left:20px;font-size:13px;line-height:1.8;">
        <li>Open <strong>Products</strong> tab</li>
        <li>Click <strong>+ Add Product</strong> to create new</li>
        <li>Click <strong>Edit</strong> on any product to modify</li>
        <li><strong>Unlist</strong> hides a live product (status → held)</li>
        <li><strong>Draft</strong> moves a live product back to draft for major edits</li>
        <li><strong>Approve → Live</strong> publishes a draft/held/rejected product</li>
      </ol>
    </div>

    <div class="card">
      <h3>Publishing to CDN</h3>
      <p class="muted" style="margin-top:6px;">
        Clicking <strong>Publish to CDN</strong> sends all <code>live</code> products to Cloudflare KV.
        The customer site fetches them on next page load (~5 min CDN cache).
      </p>
    </div>

    <div class="card">
      <h3>Bridge endpoint</h3>
      <p class="muted">Status check: <a href="/api/firebase-users" target="_blank" style="color:var(--primary);">/api/firebase-users</a></p>
    </div>`;
}

/* ---------------- BOOT ---------------- */
document.addEventListener('DOMContentLoaded', init);

// Auto-redirect to dashboard when auth state changes (login, logout, OAuth return)
document.addEventListener('auth:changed', (e) => {
  const u = e.detail?.user;
  if (u && !me) {
    init();
  } else if (!u && me) {
    me = null;
    renderLogin();
  }
});

// Expose manual reload for external scripts / dev console
window.RosellerReload = () => {
  me = null;
  init();
};
