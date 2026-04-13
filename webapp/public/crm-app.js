// ─── STATE ───────────────────────────────────────────────────────────────────
let db = {
  klanten: [], projecten: [], taken: [], facturen: [],
  apis: [], afspraken: [], todoLists: [], meetings: [],
  uitgaven: [], inkomsten: [], peppolInbox: [],
  artikelen: [],
};

let currentPage = 'dashboard';
let editId = null;
let projectFilter = 'alle';
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let selectedDay = null;
let autoFollowupTriggeredToday = false;

// ─── ADMIN (offline, localStorage) ─────────────────────────────────────────
// Deze app gebruikt momenteel localStorage als database.
// Admin is dus ook per apparaat/browser: voor iPhone sync doen we via export/import.
const ADMIN_PASSWORD_KEY = 'hohoh_admin_password';
const ADMIN_AUTH_KEY = 'hohoh_admin_authed';
const ADMIN_USERNAME = 'admin';
const CLOUD_SYNC_AUTH_KEY = 'hohoh_cloud_sync_auth';

// Gebruik dit vaste wachtwoord voor admin.
// (Offline: per toestel/browser lokaal opgeslagen.)
const ADMIN_DEFAULT_PASSWORD = 'Admin123';
let cloudSaveTimer = null;
let currentAdminPassword = null;

function isAdminAuthed() {
  try { return localStorage.getItem(ADMIN_AUTH_KEY) === '1'; } catch { return false; }
}

function cloudSyncEnabled() {
  // Werkt op Netlify deploy of localhost met `netlify dev`.
  const host = (typeof location !== 'undefined' && location.host) ? location.host : '';
  return host.includes('netlify') || host.includes('localhost');
}

async function cloudPost(path, payload) {
  if (!cloudSyncEnabled()) return { ok: false, skipped: true };
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e?.message || 'Network error' };
  }
}

async function cloudLoginAndPull(username, password) {
  if (!cloudSyncEnabled()) return;
  const auth = await cloudPost('/.netlify/functions/crm-auth', { username, password });
  if (!auth.ok) {
    toast(`❌ Cloud login mislukt: ${auth.error || 'onbekend'}`);
    return;
  }

  const loaded = await cloudPost('/.netlify/functions/crm-load', { username, password });
  if (!loaded.ok) {
    toast(`⚠ Cloud load mislukt: ${loaded.error || 'onbekend'}`);
    return;
  }

  const remoteDb = loaded.data?.db;
  if (remoteDb && typeof remoteDb === 'object') {
    db = remoteDb;
    normalizeDbShape();
    syncInvoiceDbRef();
    localStorage.setItem('mijncrm', JSON.stringify(db));
    render();
    toast('✓ Cloud data geladen');
  } else {
    // Eerste keer: push lokale db naar cloud.
    await cloudPost('/.netlify/functions/crm-save', { username, password, db });
    toast('✓ Cloud account klaar');
  }
}

function scheduleCloudSave() {
  if (!cloudSyncEnabled()) return;
  if (!isAdminAuthed() || !currentAdminPassword) return;
  if (cloudSaveTimer) clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(async () => {
    const username = ADMIN_USERNAME;
    const password = currentAdminPassword;
    await cloudPost('/.netlify/functions/crm-save', { username, password, db });
  }, 700);
}

function ensureAdminExistsAndAuthed(showPasswordOnce = true) {
  const existing = (() => {
    try { return localStorage.getItem(ADMIN_PASSWORD_KEY); } catch { return null; }
  })();

  if (existing) {
    return;
  }

  // Maak admin wachtwoord aan (vast).
  const pw = ADMIN_DEFAULT_PASSWORD;
  try {
    localStorage.setItem(ADMIN_PASSWORD_KEY, pw);
    localStorage.setItem('hohoh_admin_created_at', new Date().toISOString());
  } catch {}
}

function ensureLoginScreen() {
  if (document.getElementById('admin-login-screen')) return;
  const style = document.createElement('style');
  style.textContent = `
    #admin-login-screen{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#0b1020,#151a2f);}
    #admin-login-screen.hidden{display:none;}
    .admin-login-card{width:min(92vw,380px);background:#ffffff;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.35);padding:22px;}
    .admin-login-title{font-size:20px;font-weight:800;margin:0 0 6px;color:#111827;}
    .admin-login-sub{font-size:13px;color:#4b5563;margin:0 0 16px;}
    .admin-login-label{display:block;font-size:12px;font-weight:700;color:#374151;margin:10px 0 6px;}
    .admin-login-input{width:100%;padding:10px 11px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none;box-sizing:border-box;}
    .admin-login-input:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.15);}
    .admin-login-btn{width:100%;margin-top:14px;padding:10px 12px;border:0;border-radius:8px;background:#4f46e5;color:#fff;font-weight:700;cursor:pointer;}
    .admin-login-btn:hover{filter:brightness(1.04);}
    .admin-login-msg{min-height:18px;margin-top:8px;font-size:12px;color:#dc2626;}
    .admin-login-hint{font-size:11px;color:#6b7280;margin-top:8px;}
  `;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.id = 'admin-login-screen';
  el.innerHTML = `
    <div class="admin-login-card">
      <h1 class="admin-login-title">Orion</h1>
      <p class="admin-login-sub">by HohoSolutions — log in als admin om verder te gaan.</p>
      <label class="admin-login-label" for="admin-login-user">Gebruiker</label>
      <input id="admin-login-user" class="admin-login-input" value="${ADMIN_USERNAME}" autocomplete="username" />
      <label class="admin-login-label" for="admin-login-pass">Wachtwoord</label>
      <input id="admin-login-pass" class="admin-login-input" type="password" autocomplete="current-password" />
      <button id="admin-login-btn" class="admin-login-btn" type="button">Inloggen</button>
      <div id="admin-login-msg" class="admin-login-msg"></div>
      <div class="admin-login-hint">Tip: gebruiker <b>${ADMIN_USERNAME}</b></div>
    </div>
  `;
  document.body.appendChild(el);
  const btn = document.getElementById('admin-login-btn');
  const pass = document.getElementById('admin-login-pass');
  if (btn) btn.addEventListener('click', attemptAdminLogin);
  if (pass) pass.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') attemptAdminLogin();
  });
}

function showLoginScreen(msg = '') {
  ensureLoginScreen();
  const root = document.getElementById('admin-login-screen');
  const msgEl = document.getElementById('admin-login-msg');
  if (msgEl) msgEl.textContent = msg;
  if (root) root.classList.remove('hidden');
  const pass = document.getElementById('admin-login-pass');
  if (pass) pass.focus();
}

function hideLoginScreen() {
  const root = document.getElementById('admin-login-screen');
  if (root) root.classList.add('hidden');
}

function attemptAdminLogin() {
  ensureAdminExistsAndAuthed(false);
  const user = ((document.getElementById('admin-login-user') || {}).value || '').trim();
  const pass = ((document.getElementById('admin-login-pass') || {}).value || '');
  const pwSaved = (() => {
    try { return localStorage.getItem(ADMIN_PASSWORD_KEY); } catch { return null; }
  })();
  if (user === ADMIN_USERNAME && pwSaved && pass === pwSaved) {
    try { localStorage.setItem(ADMIN_AUTH_KEY, '1'); } catch {}
    currentAdminPassword = pass;
    try { localStorage.setItem(CLOUD_SYNC_AUTH_KEY, JSON.stringify({ u: user, p: pass })); } catch {}
    hideLoginScreen();
    toast('✓ Admin geauthenticeerd');
    cloudLoginAndPull(user, pass);
    return true;
  }
  showLoginScreen('Onjuiste gebruikersnaam of wachtwoord.');
  return false;
}

function requireAdmin() {
  ensureAdminExistsAndAuthed(false);
  if (isAdminAuthed()) return true;
  showLoginScreen('Admin login vereist om op te slaan.');
  return false;
}

function normalizeDbShape() {
  if (!db || typeof db !== 'object') db = {};
  ['klanten','projecten','taken','facturen','apis','afspraken','todoLists','meetings','uitgaven','inkomsten','peppolInbox','artikelen'].forEach(k => {
    if (!Array.isArray(db[k])) db[k] = [];
  });
  if (!db.roadmaps || typeof db.roadmaps !== 'object') db.roadmaps = {};
  if (!db.arch || typeof db.arch !== 'object') db.arch = {};
}

// ─── PERSISTENCE ─────────────────────────────────────────────────────────────
function save() {
  normalizeDbShape();
  // Zonder admin mogen we niet persistenten naar localStorage.
  if (!requireAdmin()) return;
  localStorage.setItem('mijncrm', JSON.stringify(db));
  scheduleCloudSave();
}

function syncInvoiceDbRef() {
  if (typeof window !== 'undefined') {
    window.__ORION_DB__ = db;
    window.__HOHOH_DB__ = db;
  }
}

function load() {
  const raw = localStorage.getItem('mijncrm');
  if (raw) {
    try { db = JSON.parse(raw); } catch(e) {}
  }
  normalizeDbShape();
  syncInvoiceDbRef();
}

// ─── ID + DATE ────────────────────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function today() { return new Date().toISOString().slice(0,10); }
function fmt(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('nl-BE', {day:'2-digit', month:'short', year:'numeric'});
}

// ─── NAVIGATION ──────────────────────────────────────────────────────────────
const PAGE_TITLES = {
  dashboard: 'Dashboard',
  klanten: 'Klanten',
  projecten: 'Projecten',
  taken: 'Taken',
  facturen: 'Facturen',
  financieel: 'Financieel overzicht',
  apilog: 'API & Tools',
  tijdlijn: 'Tijdlijn',
  roadmap: 'Roadmap',
  agenda: 'Agenda & Afspraken',
  todo: 'To-Do Lijsten',
  meetings: 'Meeting Notities',
  onderneming: 'Mijn bedrijf',
  peppol: 'Peppol e-facturatie',
  artikelen: 'Artikelen & voorraad',
};

function syncBottomNav(pageName) {
  const tabs = ['dashboard', 'klanten', 'projecten', 'todo'];
  const match = tabs.includes(pageName);
  document.querySelectorAll('.bottom-nav-item[data-page]').forEach((btn) => {
    const p = btn.getAttribute('data-page');
    btn.classList.toggle('active', match && p === pageName);
  });
}

function updateTopbarForPage() {
  const wrap = document.getElementById('topbar-actions');
  if (wrap) wrap.classList.remove('search-open');
  const st = document.getElementById('search-toggle');
  if (st) st.setAttribute('aria-expanded', 'false');
}

function updateAddButtonVisibility() {
  const addBtn = document.getElementById('add-btn');
  if (addBtn) addBtn.style.display = currentPage === 'onderneming' ? 'none' : '';
}

function showPage(name) {
  closeSidebar();
  const pageEl = document.getElementById('page-' + name);
  if (!pageEl) {
    toast(`❌ Pagina niet gevonden: ${name}`);
    return;
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  pageEl.classList.add('active');
  document.querySelectorAll('.nav-item[data-page]').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-page') === name);
  });
  currentPage = name;
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = PAGE_TITLES[name] || name;
  if (name === 'onderneming') loadBrandingForm();
  updateTopbarForPage();
  syncBottomNav(name);
  render();
  closeDetail();
}

function toggleMobileSearch() {
  const wrap = document.getElementById('topbar-actions');
  const btn = document.getElementById('search-toggle');
  const input = document.getElementById('global-search');
  if (!wrap || !btn) return;
  const open = wrap.classList.toggle('search-open');
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open && input) {
    setTimeout(() => input.focus(), 50);
  }
}

const BRANDING_KEYS = ['companyName', 'addressLine', 'vat', 'accountHolder', 'iban', 'ibanCompact', 'email', 'phone', 'logoPath', 'legalNote0Btw'];

function invoiceBrandingRaw() {
  return (
    localStorage.getItem('orion_invoice_branding') ||
    localStorage.getItem('nebula_invoice_branding') ||
    localStorage.getItem('hohoh_invoice_branding') ||
    '{}'
  );
}

function loadBrandingForm() {
  let stored = {};
  try {
    stored = JSON.parse(invoiceBrandingRaw());
  } catch { /* ignore */ }
  BRANDING_KEYS.forEach((key) => {
    const el = document.getElementById('br-' + key);
    if (el) el.value = stored[key] != null ? String(stored[key]) : '';
  });
}

function saveBranding() {
  if (!requireAdmin()) return;
  const obj = {};
  BRANDING_KEYS.forEach((key) => {
    const el = document.getElementById('br-' + key);
    if (el) obj[key] = el.value.trim();
  });
  if (!obj.ibanCompact && obj.iban) obj.ibanCompact = obj.iban.replace(/\s/g, '');
  try {
    const prev = JSON.parse(invoiceBrandingRaw());
    const merged = { ...prev, ...obj };
    localStorage.setItem('orion_invoice_branding', JSON.stringify(merged));
    try { localStorage.setItem('hohoh_invoice_branding', JSON.stringify(merged)); } catch { /* ignore */ }
    toast('✓ Bedrijfs- en factuurgegevens opgeslagen (PDF-facturen)');
  } catch {
    toast('❌ Opslaan mislukt');
  }
}

// ─── OPEN MODAL ──────────────────────────────────────────────────────────────
function openAddModal() {
  editId = null;
  if (currentPage === 'todo') {
    addTodoList();
    return;
  }
  if (currentPage === 'meetings') {
    addMeeting();
    return;
  }
  if (currentPage === 'agenda') {
    openAddAfspraakModal();
    return;
  }
  if (currentPage === 'financieel') {
    openFinKeuzeModal();
    return;
  }
  const map = {
    dashboard: 'klant', klanten: 'klant', projecten: 'project',
    taken: 'taak', facturen: 'factuur', apilog: 'api',
    tijdlijn: 'project', roadmap: 'project'
  };
  const type = map[currentPage] || 'klant';
  openModal('modal-' + type);
}

function openModal(id) {
  if (id === 'modal-project' || id === 'modal-taak' || id === 'modal-factuur' || id === 'modal-api') {
    populateKlantSelects();
  }
  if (id === 'modal-afspraak') {
    clearForm('modal-afspraak');
    populateAfSelects();
    set('af-datum', selectedDay || today());
  }
  if (id === 'modal-taak') populateProjectSelect();
  if (id === 'modal-factuur') openFacModal();
  if (id === 'modal-artikel') {
    const t = document.getElementById('modal-artikel-title');
    if (t) t.textContent = editId ? 'Artikel bewerken' : 'Nieuw artikel';
    if (!editId) clearForm('modal-artikel');
  }
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  clearForm(id);
  editId = null;
}

function clearForm(id) {
  document.querySelectorAll('#' + id + ' input, #' + id + ' textarea, #' + id + ' select').forEach(el => {
    if (el.tagName === 'SELECT') el.selectedIndex = 0;
    else el.value = '';
  });
  // Reset BTW default
  const btwEl = document.getElementById('f-btw');
  if (btwEl) btwEl.value = '21';
}

// ─── ARCH MODALS (i.p.v. prompt/confirm — WKWebView) ─────────────────────────
let _archInputResolve = null;
let _archInputFields = [];
function escapeArchAttr(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
function openArchInputModal(title, fields) {
  return new Promise((resolve) => {
    _archInputResolve = resolve;
    _archInputFields = fields;
    const titleEl = document.getElementById('arch-input-title');
    if (titleEl) titleEl.textContent = title;
    const container = document.getElementById('arch-input-fields');
    if (!container) { resolve(null); return; }
    container.innerHTML = fields.map((f) => {
      const fid = 'arch-in-' + f.id;
      if (f.type === 'select') {
        const opts = (f.options || []).map((o) => {
          const sel = String(o.v) === String(f.value) ? ' selected' : '';
          return `<option value="${escapeArchAttr(o.v)}"${sel}>${escapeArchAttr(o.label)}</option>`;
        }).join('');
        return `<div class="form-group full"><label>${escapeArchAttr(f.label)}</label><select id="${fid}">${opts}</select></div>`;
      }
      const inputType = f.type === 'date' ? 'date' : 'text';
      const ph = escapeArchAttr(f.placeholder || '');
      const val = escapeArchAttr(f.value != null ? f.value : '');
      return `<div class="form-group full"><label>${escapeArchAttr(f.label)}</label><input id="${fid}" type="${inputType}" placeholder="${ph}" value="${val}"></div>`;
    }).join('');
    document.getElementById('modal-arch-input').classList.add('open');
    setTimeout(() => {
      const first = container.querySelector('input,select,textarea');
      if (first) first.focus();
    }, 50);
  });
}
function closeArchInputModal(submit) {
  document.getElementById('modal-arch-input').classList.remove('open');
  if (!submit && _archInputResolve) {
    _archInputResolve(null);
    _archInputResolve = null;
  }
}
function submitArchInputModal() {
  const out = {};
  for (const f of _archInputFields) {
    const el = document.getElementById('arch-in-' + f.id);
    out[f.id] = el ? el.value : '';
  }
  document.getElementById('modal-arch-input').classList.remove('open');
  if (_archInputResolve) {
    _archInputResolve(out);
    _archInputResolve = null;
  }
}

let _archConfirmResolve = null;
function openArchConfirmModal(message) {
  return new Promise((resolve) => {
    _archConfirmResolve = resolve;
    const msgEl = document.getElementById('arch-confirm-message');
    if (msgEl) msgEl.textContent = message;
    document.getElementById('modal-arch-confirm').classList.add('open');
  });
}
function closeArchConfirmModal(ok) {
  document.getElementById('modal-arch-confirm').classList.remove('open');
  if (_archConfirmResolve) {
    _archConfirmResolve(!!ok);
    _archConfirmResolve = null;
  }
}

function populateKlantSelects() {
  ['p-klant','t-klant','f-klant','a-klant'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const first = id === 't-klant' || id === 'a-klant' ? '<option value="">— Geen —</option>' : '';
    el.innerHTML = first + db.klanten.map(k =>
      `<option value="${k.id}">${k.voornaam} ${k.achternaam}${k.bedrijf ? ' — ' + k.bedrijf : ''}</option>`
    ).join('');
  });
}

function populateProjectSelect() {
  const el = document.getElementById('t-project');
  el.innerHTML = '<option value="">— Geen —</option>' + db.projecten.map(p =>
    `<option value="${p.id}">${p.naam}</option>`
  ).join('');
}

function populateFactuurProjectSelect() {
  const el = document.getElementById('f-project');
  if (!el) return;
  const klantId = (document.getElementById('f-klant') || {}).value || '';
  let list = db.projecten;
  if (klantId) list = list.filter((p) => p.klantId === klantId);
  const cur = el.value;
  el.innerHTML = '<option value="">— Geen —</option>' + list.map((p) =>
    `<option value="${p.id}">${p.naam}</option>`
  ).join('');
  if (cur && list.some((p) => p.id === cur)) el.value = cur;
}

// ─── SAVE RECORDS ─────────────────────────────────────────────────────────────
function saveKlant() {
  const obj = {
    id: editId || uid(),
    voornaam: v('k-voornaam'), achternaam: v('k-achternaam'),
    bedrijf: v('k-bedrijf'), btw: v('k-btw'),
    email: v('k-email'), tel: v('k-tel'),
    sector: v('k-sector'), status: v('k-status'),
    adres: v('k-adres'), website: v('k-website'),
    notities: v('k-notities'),
    datum: editId ? (db.klanten.find(k=>k.id===editId)||{}).datum : today()
  };
  if (!obj.voornaam && !obj.achternaam && !obj.bedrijf) { toast('❌ Vul minstens een naam in'); return; }
  upsert('klanten', obj);
  closeModal('modal-klant');
  render();
  toast('✓ Klant opgeslagen');
  setTimeout(() => {
    const client = getPeppolClient();
    if (client) refreshKlantPeppolStatus(obj.id, true).then(() => { render(); }).catch(() => {});
  }, 0);
}

function saveProject() {
  const repoNorm = normalizeGithubRepo(v('p-github'));
  const prev = editId ? (db.projecten.find(p=>p.id===editId) || {}) : {};
  const cadence = v('p-followup-cadence') || prev.followupCadence || 'uit';
  const obj = {
    id: editId || uid(),
    naam: v('p-naam'), klantId: v('p-klant'),
    status: v('p-status'), budget: v('p-budget'),
    start: v('p-start'), deadline: v('p-deadline'),
    progress: parseInt(v('p-progress')) || 0,
    desc: v('p-desc'),
    tags: v('p-tags').split(',').map(t=>t.trim()).filter(Boolean),
    githubRepo: repoNorm || '',
    githubUrl: repoNorm ? `https://github.com/${repoNorm}` : '',
    githubSyncedAt: prev.githubSyncedAt || '',
    githubStats: prev.githubStats || null,
    followupCadence: cadence,
    followupLastSent: prev.followupLastSent || '',
    followupNextDue: cadence !== 'uit'
      ? (prev.followupNextDue || computeNextFollowupDate(cadence, today()))
      : '',
    datum: today()
  };
  if (!obj.naam) { toast('❌ Vul een projectnaam in'); return; }
  upsert('projecten', obj);
  closeModal('modal-project');
  render();
  toast('✓ Project opgeslagen');
}

function saveTaak() {
  const obj = {
    id: editId || uid(),
    naam: v('t-naam'), klantId: v('t-klant'),
    projectId: v('t-project'), prio: v('t-prio'),
    deadline: v('t-deadline'), note: v('t-note'),
    done: false, datum: today()
  };
  if (!obj.naam) { toast('❌ Vul een taaknaam in'); return; }
  upsert('taken', obj);
  closeModal('modal-taak');
  render();
  toast('✓ Taak opgeslagen');
}

function saveFactuur() {
  const lines = getFacLines();
  const excl = lines.reduce((s,l) => s + l.subtotaal, 0);
  const btwPct = parseFloat(v('f-btw')) || 0;
  const btwBedrag = excl * btwPct / 100;
  const totaal = excl + btwBedrag;
  const type = v('f-type') || 'factuur';
  const voorschotPct = type === 'voorschot' ? (parseFloat(v('f-voorschot-pct')) || 30) : null;
  const voorschotBedrag = voorschotPct ? totaal * voorschotPct / 100 : null;
  const voorschotType = type === 'voorschot' ? (v('f-voorschot-type') || 'algemeen') : null;

  const obj = {
    id: editId || uid(),
    type, num: v('f-num'), klantId: v('f-klant'),
    projectId: v('f-project'), desc: v('f-desc'),
    lines, excl, btwPct, btwBedrag, totaal,
    voorschotPct, voorschotBedrag, voorschotType,
    datum: v('f-datum') || today(),
    verval: v('f-verval'), termijn: v('f-termijn'),
    status: v('f-status'),
    ref: v('f-ref'), betaalwijze: v('f-betaalwijze'),
    note: v('f-note'),
    attachments: facAttachments.map((a) => ({ ...a }))
  };
  if (!obj.num || !obj.klantId) { toast('❌ Vul nummer en klant in'); return; }
  const block = validateFactuurForDefinitiveStatus(obj);
  if (block && obj.status !== 'concept') { toast('❌ ' + block); return; }
  upsert('facturen', obj);
  closeModal('modal-factuur');
  render();
  toast('✓ Factuur opgeslagen');
}

function saveApi() {
  const obj = {
    id: editId || uid(),
    naam: v('a-naam'), klantId: v('a-klant'),
    env: v('a-env'), versie: v('a-versie'),
    key: v('a-key'), url: v('a-url'),
    note: v('a-note'), datum: today()
  };
  if (!obj.naam) { toast('❌ Vul een naam in'); return; }
  upsert('apis', obj);
  closeModal('modal-api');
  render();
  toast('✓ Opgeslagen');
}

function parseNumLoose(s) {
  const n = parseFloat(String(s || '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function saveArtikel() {
  const naam = v('art-naam').trim();
  if (!naam) { toast('❌ Vul artikelnaam in'); return; }
  const prev = editId ? db.artikelen.find((a) => a.id === editId) : null;
  const obj = {
    id: editId || uid(),
    sku: v('art-sku').trim(),
    naam,
    eenheid: v('art-eenheid').trim() || 'st',
    voorraad: parseNumLoose(v('art-voorraad')),
    minVoorraad: parseNumLoose(v('art-min')),
    verkoopprijs: parseNumLoose(v('art-prijs')),
    btwPct: parseFloat(v('art-btw')) || 21,
    omschrijving: v('art-omsch'),
    datum: prev?.datum || today(),
  };
  upsert('artikelen', obj);
  closeModal('modal-artikel');
  render();
  toast('✓ Artikel opgeslagen');
}

function editArtikel(id) {
  const a = db.artikelen.find((x) => x.id === id);
  if (!a) return;
  editId = id;
  set('art-sku', a.sku);
  set('art-naam', a.naam);
  set('art-eenheid', a.eenheid);
  set('art-voorraad', a.voorraad);
  set('art-min', a.minVoorraad);
  set('art-prijs', a.verkoopprijs);
  set('art-btw', a.btwPct);
  set('art-omsch', a.omschrijving);
  openModal('modal-artikel');
}

async function delArtikel(id) {
  await del('artikelen', id);
}

function v(id) { return (document.getElementById(id)||{}).value || ''; }

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function upsert(col, obj) {
  const idx = db[col].findIndex(r => r.id === obj.id);
  if (idx >= 0) db[col][idx] = obj;
  else db[col].unshift(obj);
  save();
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
async function del(col, id) {
  if (!(await openArchConfirmModal('Verwijderen?'))) return;
  db[col] = db[col].filter(r => r.id !== id);
  save();
  closeDetail();
  render();
  toast('✓ Verwijderd');
}

// ─── LOOKUP ───────────────────────────────────────────────────────────────────
function klantNaam(id) {
  const k = db.klanten.find(k => k.id === id);
  return k ? `${k.voornaam} ${k.achternaam}` : '—';
}

function klantInitials(id) {
  const k = db.klanten.find(k => k.id === id);
  if (!k) return '?';
  return ((k.voornaam||'')[0]||'') + ((k.achternaam||'')[0]||'');
}

// ─── BADGES ───────────────────────────────────────────────────────────────────
function statusBadge(s) {
  const map = {
    actief: 'badge-green', prospect: 'badge-amber', inactief: 'badge-gray',
    voltooid: 'badge-blue', pauze: 'badge-amber', concept: 'badge-gray',
    openstaand: 'badge-amber', betaald: 'badge-green', vervallen: 'badge-red',
    productie: 'badge-accent', staging: 'badge-amber', development: 'badge-blue',
    hoog: 'badge-red', normaal: 'badge-gray', laag: 'badge-blue',
    peppol_sent: 'badge-peppol-sent', peppol_failed: 'badge-peppol-failed', peppol_none: 'badge-gray', peppol_registered: 'badge-peppol-ok'
  };
  return `<span class="badge ${map[s]||'badge-gray'}">${s}</span>`;
}

// ─── RENDER ───────────────────────────────────────────────────────────────────
function render() {
  normalizeDbShape();
  updateBadges();
  if (currentPage === 'dashboard') renderDashboard();
  if (currentPage === 'klanten') renderKlanten();
  if (currentPage === 'projecten') renderProjecten();
  if (currentPage === 'taken') renderTaken();
  if (currentPage === 'facturen') renderFacturen();
  if (currentPage === 'tijdlijn') renderTijdlijn();
  if (currentPage === 'roadmap') renderRoadmap();
  if (currentPage === 'apilog') {
    loadFollowupMailSettings();
    renderApi();
  }
  if (currentPage === 'todo') renderTodoPage();
  if (currentPage === 'meetings') renderMeetingsSidebar();
  if (currentPage === 'agenda') {
    renderCalendar();
    renderAgendaDayList();
    renderAgendaUpcoming();
  }
  if (currentPage === 'financieel') renderFinancieel();
  if (currentPage === 'peppol') renderPeppolPage();
  if (currentPage === 'artikelen') renderArtikelen();
  runAutomaticFollowupEngine();
  updateAddButtonVisibility();
  syncBottomNav(currentPage);
}

function updateBadges() {
  document.getElementById('badge-klanten').textContent = db.klanten.length;
  const bp = document.getElementById('badge-peppol'); if (bp) bp.textContent = String((db.peppolInbox||[]).length);
  const ba = document.getElementById('badge-artikelen');
  if (ba) ba.textContent = String((db.artikelen || []).length);
  document.getElementById('badge-projecten').textContent = db.projecten.filter(p=>p.status==='actief').length;
  document.getElementById('badge-taken').textContent = db.taken.filter(t=>!t.done).length;
  const openTodo = (db.todoLists || []).reduce((s,l)=>(l.items||[]).filter(i=>!i.done).length+s,0);
  document.getElementById('badge-todo').textContent = openTodo || '';
  document.getElementById('badge-meetings').textContent = (db.meetings || []).length || '';
}

function renderDashboard() {
  document.getElementById('stat-klanten').textContent = db.klanten.length;
  document.getElementById('stat-projecten').textContent = db.projecten.filter(p=>p.status==='actief').length;
  document.getElementById('stat-taken').textContent = db.taken.filter(t=>!t.done).length;
  const open = db.facturen.filter(f=>f.status==='openstaand').reduce((s,f)=>s+(f.totaal||0),0);
  document.getElementById('stat-facturen').textContent = '€' + open.toLocaleString('nl-BE', {minimumFractionDigits:0});

  const statArt = document.getElementById('stat-artikelen');
  const statArtSub = document.getElementById('stat-artikelen-sub');
  if (statArt) {
    const n = (db.artikelen || []).length;
    statArt.textContent = String(n);
    if (statArtSub) {
      const low = (db.artikelen || []).filter(
        (a) => (a.minVoorraad || 0) > 0 && (a.voorraad || 0) <= (a.minVoorraad || 0)
      ).length;
      statArtSub.textContent = low ? `${low} onder minimumvoorraad` : 'in catalogus';
    }
  }

  // Recent klanten
  const rk = document.getElementById('recent-klanten');
  const kl = db.klanten.slice(0,5);
  rk.innerHTML = kl.length ? kl.map(k => `
    <div class="recent-item" onclick="openKlantDetail('${k.id}')">
      <div class="recent-avatar">${((k.voornaam||'')[0]||'') + ((k.achternaam||'')[0]||'?')}</div>
      <div>
        <div class="recent-name">${k.voornaam} ${k.achternaam}</div>
        <div class="recent-meta">${k.bedrijf || k.sector || ''}</div>
      </div>
      ${statusBadge(k.status)}
    </div>`).join('') : '<div class="empty"><div class="empty-icon">◈</div><div class="empty-text">Geen klanten</div></div>';

  // Open taken
  const dt = document.getElementById('dash-taken');
  const open_t = db.taken.filter(t=>!t.done).slice(0,5);
  dt.innerHTML = open_t.length ? open_t.map(t => `
    <div class="task-item">
      <div class="task-check ${t.done?'done':''}" onclick="toggleTaak('${t.id}')"></div>
      <div class="task-text ${t.done?'done-text':''}">${t.naam}</div>
      ${statusBadge(t.prio)}
    </div>`).join('') : '<div class="empty"><div class="empty-icon">○</div><div class="empty-text">Geen open taken</div></div>';

  // Recent projecten
  const rp = document.getElementById('recent-projecten');
  const pr = db.projecten.slice(0,5);
  rp.innerHTML = pr.length ? pr.map(p => `
    <div class="recent-item" onclick="openProjectDetail('${p.id}')">
      <div class="recent-avatar" style="background:var(--accent-soft);color:var(--accent)">◇</div>
      <div style="flex:1">
        <div class="recent-name">${p.naam}</div>
        <div class="recent-meta">${klantNaam(p.klantId)} · deadline ${fmt(p.deadline)}</div>
      </div>
      ${statusBadge(p.status)}
    </div>`).join('') : '<div class="empty"><div class="empty-icon">◇</div><div class="empty-text">Geen projecten</div></div>';
}


function emptyStateCard(title, sub, ctaLabel, ctaAction, extra='') {
  return `<div class="empty">
    <div class="empty-icon">${extra || '✦'}</div>
    <div class="empty-text">${title}</div>
    ${sub ? `<div class="empty-sub">${sub}</div>` : ''}
    ${ctaLabel ? `<button type="button" class="btn btn-primary" style="margin-top:10px" onclick="${ctaAction}">${ctaLabel}</button>` : ''}
  </div>`;
}

function loadDemoData() {
  if (!requireAdmin()) return;
  const klanten = [
    {id:uid(),voornaam:'Sophie',achternaam:'Vermeulen',bedrijf:'Vermeulen Studio BV',btw:'BE0745123987',email:'sophie@vermeulenstudio.be',tel:'+32477111222',sector:'Design',status:'actief',adres:'Keizerstraat 11, 2000 Antwerpen',website:'https://vermeulenstudio.be',notities:'UI/branding klant',datum:today()},
    {id:uid(),voornaam:'Tom',achternaam:'Janssens',bedrijf:'Janssens Logistics NV',btw:'BE0441797980',email:'tom@janssenslogistics.be',tel:'+32477111333',sector:'Logistiek',status:'actief',adres:'Havenlaan 2, 9000 Gent',website:'https://janssenslogistics.be',notities:'ERP integratie',datum:today()},
    {id:uid(),voornaam:'Amina',achternaam:'El Khatib',bedrijf:'AK Consulting',btw:'BE0834123456',email:'amina@akconsulting.be',tel:'+32477111444',sector:'Consultancy',status:'prospect',adres:'Louizalaan 77, 1000 Brussel',website:'',notities:'Offerte in voorbereiding',datum:today()},
    {id:uid(),voornaam:'Pieter',achternaam:'De Smet',bedrijf:'De Smet Elektro',btw:'BE0678091234',email:'pieter@desmetelektro.be',tel:'+32477111555',sector:'Elektro',status:'actief',adres:'Stationsstraat 45, 2800 Mechelen',website:'',notities:'Onderhoudscontract',datum:today()},
    {id:uid(),voornaam:'Lena',achternaam:'Claes',bedrijf:'Claes Events BV',btw:'BE0755091234',email:'lena@claesevents.be',tel:'+32477111666',sector:'Events',status:'inactief',adres:'Markt 8, 3000 Leuven',website:'https://claesevents.be',notities:'Seizoensprojecten',datum:today()},
    {id:uid(),voornaam:'Bram',achternaam:'Peeters',bedrijf:'Peeters Construct',btw:'BE0534123987',email:'bram@peetersconstruct.be',tel:'+32477111777',sector:'Bouw',status:'actief',adres:'Industrieweg 12, 3500 Hasselt',website:'',notities:'Facturatie maandelijks',datum:today()}
  ];
  const projecten = [
    {id:uid(),naam:'Website relaunch',klantId:klanten[0].id,status:'actief',budget:12000,start:today(),deadline:today(),progress:35,desc:'Nieuwe site + lead funnel',tags:['web','design'],datum:today()},
    {id:uid(),naam:'ERP koppeling',klantId:klanten[1].id,status:'actief',budget:28000,start:today(),deadline:today(),progress:52,desc:'API integratie',tags:['api','erp'],datum:today()},
    {id:uid(),naam:'Sales dashboard',klantId:klanten[2].id,status:'concept',budget:6500,start:today(),deadline:today(),progress:10,desc:'KPI dashboard',tags:['dashboard'],datum:today()},
    {id:uid(),naam:'Planning app',klantId:klanten[3].id,status:'pauze',budget:9400,start:today(),deadline:today(),progress:65,desc:'Mobiele planning',tags:['mobile'],datum:today()}
  ];
  const facturen = [
    {id:uid(),type:'factuur',num:'2026-0001',klantId:klanten[0].id,projectId:projecten[0].id,desc:'Design & setup',lines:[{omschrijving:'Design',aantal:1,prijs:1500,subtotaal:1500}],excl:1500,btwPct:21,btwBedrag:315,totaal:1815,datum:today(),verval:today(),termijn:'30',status:'betaald',ref:'PO-001',betaalwijze:'overschrijving',note:'',attachments:[]},
    {id:uid(),type:'factuur',num:'2026-0002',klantId:klanten[1].id,projectId:projecten[1].id,desc:'API sprint 1',lines:[{omschrijving:'Sprint',aantal:1,prijs:2800,subtotaal:2800}],excl:2800,btwPct:21,btwBedrag:588,totaal:3388,datum:today(),verval:today(),termijn:'30',status:'openstaand',ref:'PO-002',betaalwijze:'overschrijving',note:'',attachments:[]},
    {id:uid(),type:'voorschot',num:'2026-0003',klantId:klanten[2].id,projectId:projecten[2].id,desc:'Voorschot analyse',lines:[{omschrijving:'Analyse',aantal:1,prijs:1000,subtotaal:1000}],excl:1000,btwPct:21,btwBedrag:210,totaal:1210,datum:today(),verval:today(),termijn:'30',status:'deels-betaald',ref:'PO-003',betaalwijze:'overschrijving',note:'',attachments:[]},
    {id:uid(),type:'factuur',num:'2026-0004',klantId:klanten[3].id,projectId:projecten[3].id,desc:'Onderhoud',lines:[{omschrijving:'Onderhoud',aantal:1,prijs:780,subtotaal:780}],excl:780,btwPct:21,btwBedrag:163.8,totaal:943.8,datum:today(),verval:today(),termijn:'30',status:'vervallen',ref:'PO-004',betaalwijze:'overschrijving',note:'',attachments:[]},
    {id:uid(),type:'factuur',num:'2026-0005',klantId:klanten[4].id,projectId:'',desc:'Event support',lines:[{omschrijving:'Support',aantal:1,prijs:500,subtotaal:500}],excl:500,btwPct:21,btwBedrag:105,totaal:605,datum:today(),verval:today(),termijn:'30',status:'concept',ref:'PO-005',betaalwijze:'overschrijving',note:'',attachments:[]},
    {id:uid(),type:'creditnota',num:'2026-0006',klantId:klanten[5].id,projectId:'',desc:'Correctie',lines:[{omschrijving:'Correctie',aantal:1,prijs:200,subtotaal:200}],excl:200,btwPct:21,btwBedrag:42,totaal:242,datum:today(),verval:today(),termijn:'0',status:'concept',ref:'PO-006',betaalwijze:'overschrijving',note:'',attachments:[]},
    {id:uid(),type:'factuur',num:'2026-0007',klantId:klanten[0].id,projectId:projecten[0].id,desc:'SEO setup',lines:[{omschrijving:'SEO',aantal:1,prijs:900,subtotaal:900}],excl:900,btwPct:21,btwBedrag:189,totaal:1089,datum:today(),verval:today(),termijn:'30',status:'betaald',ref:'PO-007',betaalwijze:'overschrijving',note:'',attachments:[]},
    {id:uid(),type:'factuur',num:'2026-0008',klantId:klanten[1].id,projectId:projecten[1].id,desc:'API sprint 2',lines:[{omschrijving:'Sprint',aantal:1,prijs:3200,subtotaal:3200}],excl:3200,btwPct:21,btwBedrag:672,totaal:3872,datum:today(),verval:today(),termijn:'30',status:'openstaand',ref:'PO-008',betaalwijze:'overschrijving',note:'',attachments:[]}
  ];
  const taken = [
    'Kickoff meeting voorbereiden','Contract laten tekenen','Peppol credentials vragen','Factuur #2026-0002 opvolgen','Kanban kolommen updaten','Roadmap sprint 2 plannen','API documentatie afronden','Klantfeedback verwerken','Test op iPhone','Backup export draaien','SEO copy finaliseren','Demo call inplannen'
  ].map((naam,i)=>({id:uid(),naam,klantId:klanten[i%klanten.length].id,projectId:projecten[i%projecten.length].id,prio:i%3===0?'hoog':(i%3===1?'normaal':'laag'),deadline:today(),note:'Demo-taak',done:i%4===0,datum:today()}));
  const afspraken = [
    {id:uid(),naam:'Kickoff Vermeulen Studio',datum:today(),tijd:'09:30',type:'meeting',klantId:klanten[0].id,projectId:projecten[0].id,locatie:'Teams',note:'Doelen project'},
    {id:uid(),naam:'ERP review',datum:today(),tijd:'13:00',type:'afspraak',klantId:klanten[1].id,projectId:projecten[1].id,locatie:'Gent kantoor',note:'Scope sprint 2'},
    {id:uid(),naam:'Facturatie check',datum:today(),tijd:'16:00',type:'deadline',klantId:klanten[2].id,projectId:projecten[2].id,locatie:'',note:'Openstaande posten'}
  ];
  db.klanten = klanten;
  db.projecten = projecten;
  db.facturen = facturen;
  db.taken = taken;
  db.afspraken = afspraken;
  db.artikelen = [
    { id: uid(), sku: 'SRV-001', naam: 'Consultancy uur', eenheid: 'u', voorraad: 0, minVoorraad: 0, verkoopprijs: 95, btwPct: 21, omschrijving: 'Intern — niet fysiek', datum: today() },
    { id: uid(), sku: 'HW-SSD-1TB', naam: 'SSD NVMe 1TB', eenheid: 'st', voorraad: 12, minVoorraad: 3, verkoopprijs: 89.9, btwPct: 21, omschrijving: 'Installatie hardware', datum: today() },
    { id: uid(), sku: 'INK-PAP-A4', naam: 'Papier A4 80g (pak)', eenheid: 'pak', voorraad: 8, minVoorraad: 5, verkoopprijs: 6.5, btwPct: 21, omschrijving: 'Kantoor', datum: today() },
    { id: uid(), sku: 'MERCH-TSH', naam: 'T-shirt bedrukking', eenheid: 'st', voorraad: 40, minVoorraad: 10, verkoopprijs: 18, btwPct: 21, omschrijving: 'Events', datum: today() },
    { id: uid(), sku: 'CHEM-DILU', naam: 'Verdunner 5L', eenheid: 'st', voorraad: 2, minVoorraad: 4, verkoopprijs: 24, btwPct: 21, omschrijving: 'Bouw — test laag voorraad', datum: today() },
    { id: uid(), sku: 'EL-KABEL', naam: 'Kabel rol 100m', eenheid: 'rol', voorraad: 6, minVoorraad: 2, verkoopprijs: 142, btwPct: 21, omschrijving: 'Elektro', datum: today() },
  ];
  if (!Array.isArray(db.todoLists)) db.todoLists = [];
  if (!Array.isArray(db.meetings)) db.meetings = [];
  if (!Array.isArray(db.apis)) db.apis = [];
  if (!Array.isArray(db.uitgaven)) db.uitgaven = [];
  if (!Array.isArray(db.inkomsten)) db.inkomsten = [];
  save();
  render();
  toast('✓ Voorbeelddata geladen');
}

function renderKlanten(data) {
  const rows = (data || db.klanten).map(k => {
    const np = db.projecten.filter(p=>p.klantId===k.id).length;
    return `<tr onclick="openKlantDetail('${k.id}')">
      <td><strong>${k.voornaam} ${k.achternaam}</strong> ${peppolKlantBadge(k)}</td>
      <td>${k.bedrijf || '—'}</td>
      <td class="td-mono">${k.email || '—'}</td>
      <td>${statusBadge(k.status)}</td>
      <td>${k.sector || '—'}</td>
      <td><span class="badge badge-gray">${np}</span></td>
      <td class="td-mono">${fmt(k.datum)}</td>
    </tr>`;
  });
  document.getElementById('klanten-tbody').innerHTML = rows.join('') ||
    `<tr><td colspan="7">${emptyStateCard('Nog geen klanten', 'Voeg je eerste klant toe of laad voorbeelddata.', '+ Eerste klant toevoegen', "openModal('modal-klant')", '👥')}</td></tr>`;
}

function renderArtikelen(data) {
  const list = data || db.artikelen || [];
  const rows = list.map((a) => {
    const low = (a.minVoorraad || 0) > 0 && (a.voorraad || 0) <= (a.minVoorraad || 0);
    const rowCls = low ? ' class="tr-stock-low"' : '';
    const oms = String(a.omschrijving || '');
    const sub = oms
      ? `<div style="font-size:11px;color:var(--text3);margin-top:2px">${escHtml(oms.slice(0, 100))}${oms.length > 100 ? '…' : ''}</div>`
      : '';
    return `<tr${rowCls}>
      <td class="td-mono">${escHtml(a.sku) || '—'}</td>
      <td><strong>${escHtml(a.naam)}</strong>${sub}</td>
      <td class="td-mono">${escHtml(a.eenheid) || 'st'}</td>
      <td class="td-mono">${Number(a.voorraad || 0).toLocaleString('nl-BE')}</td>
      <td class="td-mono">${Number(a.minVoorraad || 0).toLocaleString('nl-BE')}</td>
      <td class="td-mono">€${Number(a.verkoopprijs || 0).toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td class="td-mono">${Number(a.btwPct ?? 21)}%</td>
      <td onclick="event.stopPropagation()">
        <button type="button" class="btn btn-ghost" style="padding:4px 8px;font-size:12px" onclick="editArtikel('${a.id}')">✎</button>
        <button type="button" class="btn btn-ghost" style="padding:4px 8px;font-size:12px" onclick="delArtikel('${a.id}')">🗑</button>
      </td>
    </tr>`;
  });
  const tb = document.getElementById('artikelen-tbody');
  if (!tb) return;
  tb.innerHTML = rows.join('') ||
    `<tr><td colspan="8">${emptyStateCard('Nog geen artikelen', 'Leg je artikelcatalogus en voorraad aan, of laad voorbeelddata.', '+ Artikel toevoegen', "openModal('modal-artikel')", '📦')}</td></tr>`;
}

function renderProjecten(data) {
  const list = (data || db.projecten).filter(p => projectFilter === 'alle' || p.status === projectFilter);
  document.getElementById('projecten-grid').innerHTML = list.length ? list.map(p => {
    const msCount = (db.roadmaps&&db.roadmaps[p.id]||[]).length;
    const takenCount = db.taken.filter(t=>t.projectId===p.id&&!t.done).length;
    return `<div class="card" onclick="openProjectArch('${p.id}')">
      <div class="card-head">
        <div class="card-title">${p.naam}</div>
        ${statusBadge(p.status)}
      </div>
      <div class="card-sub">${klantNaam(p.klantId)}</div>
      ${p.githubRepo ? `<div style="font-size:11px;color:var(--text3);margin-bottom:6px">🔗 ${p.githubRepo}</div>` : ''}
      ${p.desc ? `<div style="font-size:12px;color:var(--text2);line-height:1.5;margin-bottom:6px">${p.desc.slice(0,80)}${p.desc.length>80?'…':''}</div>` : ''}
      <div class="progress-wrap">
        <div class="progress-label"><span>Voortgang</span><span>${p.progress||0}%</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${p.progress||0}%"></div></div>
      </div>
      <div class="card-meta">
        ${(p.tags||[]).map(t=>`<span class="tag">${t}</span>`).join('')}
        ${p.budget ? `<span class="badge badge-green">€${parseFloat(p.budget).toLocaleString('nl-BE')}</span>` : ''}
        ${p.deadline ? `<span class="badge badge-amber">📅 ${fmt(p.deadline)}</span>` : ''}
        ${msCount ? `<span class="badge badge-accent">◉ ${msCount} mijlpalen</span>` : ''}
        ${takenCount ? `<span class="badge badge-blue">${takenCount} open taken</span>` : ''}
      </div>
    </div>`;
  }).join('') :
    `<div style="grid-column:1/-1">${emptyStateCard('Nog geen projecten', 'Maak een project of laad voorbeelddata om Orion te verkennen.', '+ Nieuw project', "openModal('modal-project')", '🗂')}</div>`;
}

function filterProjecten(status, btn) {
  projectFilter = status;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderProjecten();
}

function renderTaken(data) {
  const list = data || db.taken;
  document.getElementById('taken-list').innerHTML = list.length ? list.map(t => `
    <div class="task-item">
      <div class="task-check ${t.done?'done':''}" onclick="toggleTaak('${t.id}')"></div>
      <div style="flex:1">
        <div class="task-text ${t.done?'done-text':''}">${t.naam}</div>
        ${t.note ? `<div class="task-meta" style="margin-top:2px">${t.note}</div>` : ''}
      </div>
      ${statusBadge(t.prio)}
      ${t.deadline ? `<span class="badge badge-gray td-mono">${fmt(t.deadline)}</span>` : ''}
      <span style="font-size:11px;color:var(--text3)">${klantNaam(t.klantId)}</span>
      <button class="btn btn-ghost" style="padding:4px 10px;font-size:11px" onclick="event.stopPropagation();del('taken','${t.id}')">✕</button>
    </div>`).join('') :
    emptyStateCard('Nog geen taken', 'Maak je eerste taak met deadline en prioriteit.', '+ Eerste taak toevoegen', "openModal('modal-taak')", '✅');
}

function toggleTaak(id) {
  const t = db.taken.find(t=>t.id===id);
  if (t) { t.done = !t.done; save(); render(); }
}

let facFilter = 'alle';

function filterFacturen(f, btn) {
  facFilter = f;
  document.querySelectorAll('#fac-tabs .tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderFacturen();
}

function renderFacturen(data) {
  // Populate klant filter
  const kf = document.getElementById('fac-klant-filter');
  if (kf) {
    const cur = kf.value;
    kf.innerHTML = '<option value="">Alle klanten</option>' + db.klanten.map(k =>
      `<option value="${k.id}"${k.id===cur?' selected':''}>${k.voornaam} ${k.achternaam}</option>`
    ).join('');
  }

  const klantFilter = (document.getElementById('fac-klant-filter')||{}).value || '';
  let list = data || db.facturen;
  if (klantFilter) list = list.filter(f => f.klantId === klantFilter);
  if (facFilter === 'openstaand') list = list.filter(f => f.status === 'openstaand' || f.status === 'deels-betaald');
  else if (facFilter === 'vervallen') list = list.filter(f => f.status === 'vervallen');
  else if (['voorschot','factuur','creditnota'].includes(facFilter)) list = list.filter(f => (f.type||'factuur') === facFilter);

  // Stats
  const all = db.facturen;
  const totF = n => '€' + n.toLocaleString('nl-BE', {minimumFractionDigits:2});
  const setS = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  setS('fstat-totaal', totF(all.reduce((s,f)=>s+(f.totaal||0),0)));
  setS('fstat-open', totF(all.filter(f=>['openstaand','deels-betaald'].includes(f.status)).reduce((s,f)=>s+(f.totaal||0),0)));
  setS('fstat-betaald', totF(all.filter(f=>f.status==='betaald').reduce((s,f)=>s+(f.totaal||0),0)));
  setS('fstat-vervallen', totF(all.filter(f=>f.status==='vervallen').reduce((s,f)=>s+(f.totaal||0),0)));

  const typeLabel = { factuur:'Factuur', voorschot:'Voorschot', creditnota:'Creditnota', offerte:'Offerte', 'pro-forma':'Pro-forma' };
  const voorschotTypeLabel = {
    algemeen: 'Algemeen voorschot',
    start: 'Start project',
    design: 'Design fase',
    development: 'Development fase',
    oplevering: 'Oplevering / finale termijn'
  };
  const rows = list.map(f => {
    const kl = db.klanten.find(k=>k.id===f.klantId);
    const t = f.type || 'factuur';
    const excl = f.excl ?? f.bedrag ?? 0;
    const btw = f.btwBedrag ?? ((f.btw||21)/100 * excl);
    const tot = f.totaal || 0;
    return `<tr onclick="openFactuurDetail('${f.id}')" style="cursor:pointer">
      <td class="td-mono" style="font-weight:600">${f.num}</td>
      <td>
        <span class="badge badge-type-${t}">${typeLabel[t]||t}</span>
        ${(t === 'voorschot' && f.voorschotType) ? `<div style="font-size:10px;color:var(--text3);margin-top:4px">${voorschotTypeLabel[f.voorschotType] || f.voorschotType}</div>` : ''}
      </td>
      <td>${kl ? kl.voornaam+' '+kl.achternaam : '—'}</td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.desc||'—'}</td>
      <td class="fac-amount">€${excl.toLocaleString('nl-BE',{minimumFractionDigits:2})}</td>
      <td class="fac-amount" style="color:var(--text3)">€${btw.toLocaleString('nl-BE',{minimumFractionDigits:2})}</td>
      <td class="fac-amount" style="font-weight:700">€${tot.toLocaleString('nl-BE',{minimumFractionDigits:2})}</td>
      <td class="td-mono">${fmt(f.datum)}</td>
      <td class="td-mono">${fmt(f.verval)||'—'}</td>
      <td><span class="badge badge-status-${f.status||'concept'}">${f.status||'concept'}</span></td>
      <td style="text-align:right;white-space:nowrap">
        <button type="button" class="btn btn-ghost" style="padding:3px 8px;font-size:11px" title="Download PDF" onclick="event.stopPropagation();downloadFactuurPdf('${f.id}')">PDF</button>
        <button type="button" class="btn btn-ghost" style="padding:3px 8px;font-size:11px" title="Verstuur via Peppol" onclick="event.stopPropagation();sendFactuurViaPeppol('${f.id}')">Peppol</button>
        <button type="button" class="btn btn-ghost" style="padding:3px 8px;font-size:11px" title="Verwijderen" onclick="event.stopPropagation();del('facturen','${f.id}')">✕</button>
      </td>
    </tr>`;
  });
  document.getElementById('facturen-tbody').innerHTML = rows.join('') ||
    `<tr><td colspan="11">${emptyStateCard('Nog geen facturen', 'Stel je eerste factuur op en verstuur via PDF of Peppol.', '+ Eerste factuur opstellen', "startFactuurOpstellen('factuur')", '🧾')}</td></tr>`;

  const cards = list.map(f => {
    const kl = db.klanten.find(k=>k.id===f.klantId);
    const t = f.type || 'factuur';
    const tot = f.totaal || 0;
    return `<div class="fac-mobile-card" onclick="openFactuurDetail('${f.id}')">
      <div class="fac-mobile-head">
        <div class="fac-mobile-num">${f.num}</div>
        <span class="badge badge-status-${f.status||'concept'}">${f.status||'concept'}</span>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span class="badge badge-type-${t}">${typeLabel[t]||t}</span>
        <span style="font-size:11px;color:var(--text3)">${kl ? kl.voornaam+' '+kl.achternaam : '—'}</span>
      </div>
      <div class="fac-mobile-row"><span>Omschrijving</span><strong>${f.desc||'—'}</strong></div>
      <div class="fac-mobile-row"><span>Totaal</span><strong>€${tot.toLocaleString('nl-BE',{minimumFractionDigits:2})}</strong></div>
      <div class="fac-mobile-row"><span>Vervaldag</span><strong>${fmt(f.verval)||'—'}</strong></div>
      <div class="fac-mobile-actions">
        <button class="btn btn-ghost" style="font-size:11px;padding:5px 10px" onclick="event.stopPropagation();downloadFactuurPdf('${f.id}')">PDF</button>
        <button class="btn btn-ghost" style="font-size:11px;padding:5px 10px" onclick="event.stopPropagation();sendFactuurViaPeppol('${f.id}')">Peppol</button>
        <button class="btn btn-ghost" style="font-size:11px;padding:5px 10px" onclick="event.stopPropagation();changeFactuurStatus('${f.id}','betaald')">Markeer betaald</button>
        <button class="btn btn-danger" style="font-size:11px;padding:5px 10px" onclick="event.stopPropagation();del('facturen','${f.id}')">Verwijder</button>
      </div>
    </div>`;
  });
  const cardsEl = document.getElementById('facturen-cards');
  if (cardsEl) cardsEl.innerHTML = cards.join('') || emptyStateCard('Nog geen facturen', 'Start met een eerste factuur om omzet op te bouwen.', '+ Eerste factuur opstellen', "startFactuurOpstellen('factuur')", '🧾');
  renderFacturenWithPeppolBadges();
}

function openFactuurDetail(id) {
  const f = db.facturen.find(f=>f.id===id);
  if (!f) return;
  const kl = db.klanten.find(k=>k.id===f.klantId);
  const pr = db.projecten.find(p=>p.id===f.projectId);
  const typeLabel = { factuur:'Factuur', voorschot:'Voorschotfactuur', creditnota:'Creditnota', offerte:'Offerte', 'pro-forma':'Pro-forma factuur' };
  const voorschotTypeLabel = {
    algemeen: 'Algemeen voorschot',
    start: 'Start project',
    design: 'Design fase',
    development: 'Development fase',
    oplevering: 'Oplevering / finale termijn'
  };
  const excl = f.excl ?? f.bedrag ?? 0;
  const btwB = f.btwBedrag ?? 0;
  const tot = f.totaal || 0;

  document.getElementById('detail-title').textContent = f.num;
  document.getElementById('detail-body').innerHTML = `
    <div class="detail-section">
      <div class="detail-section-title">Document</div>
      ${row('Type', `<span class="badge badge-type-${f.type||'factuur'}">${typeLabel[f.type||'factuur']}</span>`)}
      ${row('Nummer', f.num)}
      ${row('Status', `<span class="badge badge-status-${f.status}">${f.status}</span>`)}
      ${row('Klant', kl ? kl.voornaam+' '+kl.achternaam : '—')}
      ${row('Project', pr ? pr.naam : '—')}
      ${row('Referentie', f.ref)}
      ${row('Betaalwijze', f.betaalwijze)}
    </div>
    <div class="detail-section">
      <div class="detail-section-title">Lijnen</div>
      ${(f.lines||[]).map(l=>`<div class="fac-detail-line">
        <span>${l.omschrijving||'—'} <span style="color:var(--text3);font-size:11px">×${l.aantal||1}</span></span>
        <span style="font-family:'JetBrains Mono',monospace">€${(l.subtotaal||0).toLocaleString('nl-BE',{minimumFractionDigits:2})}</span>
      </div>`).join('') || '<div style="color:var(--text3);font-size:12px">Geen lijnen</div>'}
    </div>
    <div class="detail-section">
      <div class="detail-section-title">Bedragen</div>
      ${row('Excl. BTW', `<span style="font-family:'JetBrains Mono',monospace">€${excl.toLocaleString('nl-BE',{minimumFractionDigits:2})}</span>`)}
      ${row(`BTW (${f.btwPct||0}%)`, `<span style="font-family:'JetBrains Mono',monospace">€${btwB.toLocaleString('nl-BE',{minimumFractionDigits:2})}</span>`)}
      ${row('Totaal', `<span style="font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:700;color:var(--accent)">€${tot.toLocaleString('nl-BE',{minimumFractionDigits:2})}</span>`)}
      ${f.voorschotBedrag ? row('Voorschot', `<span style="font-family:'JetBrains Mono',monospace;color:var(--amber)">€${f.voorschotBedrag.toLocaleString('nl-BE',{minimumFractionDigits:2})} (${f.voorschotPct}%)</span>`) : ''}
      ${(f.type === 'voorschot' && f.voorschotType) ? row('Voorschot voor', voorschotTypeLabel[f.voorschotType] || f.voorschotType) : ''}
    </div>
    <div class="detail-section">
      <div class="detail-section-title">Datums</div>
      ${row('Datum', fmt(f.datum))}
      ${row('Vervaldag', fmt(f.verval))}
      ${row('Termijn', f.termijn ? f.termijn+' dagen' : '—')}
    </div>
    ${f.note ? `<div class="detail-section"><div class="detail-section-title">Notitie</div><div style="font-size:13px;color:var(--text2);line-height:1.6">${f.note}</div></div>` : ''}
    ${(f.attachments && f.attachments.length) ? `<div class="detail-section"><div class="detail-section-title">Bijlagen / links</div>
      ${f.attachments.map((a) => `<div class="file-entry" style="margin-bottom:6px">
        <div class="file-icon">${({ pdf:'📄', figma:'🎨', github:'💻', drive:'📁', notion:'📝', link:'🔗', other:'📎' }[a.type] || '📎')}</div>
        <div style="flex:1;min-width:0">
          <div class="file-name">${a.naam || '—'}</div>
          ${a.note ? `<div style="font-size:11px;color:var(--text2);margin-top:2px">${a.note}</div>` : ''}
        </div>
        ${a.url ? `<a href="${a.url}" target="_blank" rel="noopener" class="btn btn-ghost" style="padding:4px 10px;font-size:12px">Openen</a>` : ''}
      </div>`).join('')}
    </div>` : ''}
    <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="downloadFactuurPdf('${id}')">📄 Download PDF</button>
      <button class="btn btn-primary" onclick="editFactuur('${id}')">Bewerken</button>
      <button class="btn btn-primary" onclick="changeFactuurStatus('${id}','betaald')">✓ Betaald</button>
      <button class="btn btn-ghost" onclick="changeFactuurStatus('${id}','vervallen')">Vervallen</button>
      <button class="btn btn-danger" onclick="del('facturen','${id}')">Verwijder</button>
    </div>`;
  openDetail();
}

function changeFactuurStatus(id, status) {
  const f = db.facturen.find(f=>f.id===id);
  if (!f) return;
  const next = { ...f, status };
  const block = validateFactuurForDefinitiveStatus(next);
  if (block && status !== 'concept') { toast('❌ ' + block); return; }
  f.status = status;
  save();
  closeDetail();
  render();
  toast('✓ Status bijgewerkt');
}

function renderApi(data) {
  const list = data || db.apis;
  document.getElementById('api-list').innerHTML = list.length ? list.map(a => `
    <div class="api-entry">
      <span class="api-pill">${a.naam}</span>
      <span style="flex:1;font-size:13px;color:var(--text2)">${klantNaam(a.klantId)}</span>
      ${statusBadge(a.env)}
      <span class="badge badge-gray td-mono">${a.versie || '—'}</span>
      ${a.url ? `<span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--text3)">${a.url.slice(0,40)}</span>` : ''}
      <button class="btn btn-ghost" style="padding:3px 8px;font-size:11px" onclick="del('apis','${a.id}')">✕</button>
    </div>`).join('') :
    `<div class="empty"><div class="empty-icon">⌥</div><div class="empty-text">Geen APIs geregistreerd</div></div>`;
}

// ─── DETAIL PANELS ────────────────────────────────────────────────────────────
function openKlantDetail(id) {
  const k = db.klanten.find(k=>k.id===id);
  if (!k) return;
  const projecten = db.projecten.filter(p=>p.klantId===id);
  const facturen = db.facturen.filter(f=>f.klantId===id);
  const apis = db.apis.filter(a=>a.klantId===id);

  document.getElementById('detail-title').textContent = k.voornaam + ' ' + k.achternaam;
  document.getElementById('detail-body').innerHTML = `
    <div class="detail-section">
      <div class="detail-section-title">Contactinfo</div>
      ${row('Email', k.email ? `<a href="mailto:${k.email}" style="color:var(--accent)">${k.email}</a>` : '—')}
      ${row('Telefoon', k.tel)}
      ${row('Bedrijf', k.bedrijf)}
      ${row('BTW', k.btw)}
      ${row('Adres', k.adres)}
      ${row('Website', k.website ? `<a href="${k.website}" target="_blank" style="color:var(--accent)">${k.website}</a>` : '—')}
      ${row('Sector', k.sector)}
      ${row('Status', statusBadge(k.status))}
    </div>
    ${k.notities ? `<div class="detail-section"><div class="detail-section-title">Notities</div><div style="font-size:13px;color:var(--text2);line-height:1.6">${k.notities}</div></div>` : ''}
    <div class="detail-section">
      <div class="detail-section-title">Projecten (${projecten.length})</div>
      ${projecten.map(p=>`<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;display:flex;align-items:center;justify-content:space-between">
        <span>${p.naam}</span>${statusBadge(p.status)}</div>`).join('') || '<div style="color:var(--text3);font-size:12px">Geen projecten</div>'}
    </div>
    <div class="detail-section">
      <div class="detail-section-title">APIs (${apis.length})</div>
      ${apis.map(a=>`<div style="padding:6px 0;font-size:12px;font-family:'JetBrains Mono',monospace;color:var(--text2);border-bottom:1px solid var(--border)">
        <span class="api-pill">${a.naam}</span> ${a.env} ${a.versie||''}</div>`).join('') || '<div style="color:var(--text3);font-size:12px">Geen APIs</div>'}
    </div>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button class="btn btn-primary" onclick="editKlant('${id}')">✎ Bewerken</button>
      <button class="btn btn-danger" onclick="del('klanten','${id}')">Verwijder</button>
    </div>`;
  openDetail();
}

function openProjectDetail(id) {
  openProjectArch(id);
}

// ─── PROJECT ARCHITECTUUR ────────────────────────────────────────────────────
let currentArchProjectId = null;
let currentArchTab = 'overview';

function openProjectArch(id) {
  const p = db.projecten.find(p=>p.id===id);
  if (!p) return;
  currentArchProjectId = id;
  currentArchTab = 'overview';

  // Ensure data structures
  if (!db.arch) db.arch = {};
  if (!db.arch[id]) db.arch[id] = { kanban: { todo:[], inprogress:[], review:[], done:[] }, tech:[], bestanden:[], tijdlijn:[], notities:'' };
  if (!db.roadmaps) db.roadmaps = {};
  if (!db.roadmaps[id]) db.roadmaps[id] = [];

  const k = db.klanten.find(k=>k.id===p.klantId);
  document.getElementById('proj-arch-title').textContent = p.naam;
  document.getElementById('proj-arch-status').innerHTML = statusBadge(p.status);
  const repoPart = p.githubRepo ? ` • GitHub: ${p.githubRepo}` : '';
  document.getElementById('proj-arch-client').textContent = `${k ? k.voornaam+' '+k.achternaam : ''}${repoPart}`;

  // Reset tabs
  document.querySelectorAll('.proj-arch-tab').forEach(t=>t.classList.remove('active'));
  const firstTab = document.querySelector('.proj-arch-tab');
  if (firstTab) firstTab.classList.add('active');
  document.querySelectorAll('.proj-arch-panel').forEach(p=>p.classList.remove('active'));
  const overviewPanel = document.getElementById('arch-panel-overview');
  if (overviewPanel) overviewPanel.classList.add('active');

  document.getElementById('proj-arch-overlay').classList.add('open');
  renderArchOverview(id);
}

function closeProjectArch() {
  document.getElementById('proj-arch-overlay').classList.remove('open');
  currentArchProjectId = null;
}

function switchArchTab(tab, btn) {
  currentArchTab = tab;
  document.querySelectorAll('.proj-arch-tab').forEach(t=>t.classList.remove('active'));
  if (btn && btn.classList) btn.classList.add('active');
  document.querySelectorAll('.proj-arch-panel').forEach(p=>p.classList.remove('active'));
  const panel = document.getElementById('arch-panel-'+tab);
  if (panel) panel.classList.add('active');
  const id = currentArchProjectId;
  if (!id) return;
  if (tab==='overview') renderArchOverview(id);
  if (tab==='kanban') renderArchKanban(id);
  if (tab==='roadmap') renderArchRoadmap(id);
  if (tab==='tijdlijn') renderArchTijdlijn(id);
  if (tab==='tech') renderArchTech(id);
  if (tab==='bestanden') renderArchBestanden(id);
  if (tab==='notities') renderArchNotities(id);
  if (tab==='facturen') renderArchFacturen(id);
}

function getArch(id) { return db.arch && db.arch[id] ? db.arch[id] : { kanban:{todo:[],inprogress:[],review:[],done:[]}, tech:[], bestanden:[], tijdlijn:[], notities:'' }; }
function saveArch() { save(); }

// OVERZICHT
function renderArchOverview(id) {
  const p = db.projecten.find(p=>p.id===id);
  const arch = getArch(id);
  const taken = db.taken.filter(t=>t.projectId===id);
  const ms = (db.roadmaps[id]||[]);
  const facturen = db.facturen.filter(f=>f.projectId===id);
  const totFac = facturen.reduce((s,f)=>s+(f.totaal||0),0);
  const allItems = ms.flatMap(m=>m.items||[]);
  const doneItems = allItems.filter(i=>i.done).length;
  const delivery = getProjectDeliveryStatus(p, taken, ms);

  document.getElementById('arch-stats').innerHTML = `
    <div class="proj-stat">
      <div class="proj-stat-label">Voortgang</div>
      <div class="proj-stat-val">${p.progress||0}%</div>
      <div class="progress-bar" style="margin-top:8px"><div class="progress-fill" style="width:${p.progress||0}%"></div></div>
    </div>
    <div class="proj-stat">
      <div class="proj-stat-label">Open taken</div>
      <div class="proj-stat-val" style="color:var(--amber)">${taken.filter(t=>!t.done).length}</div>
      <div class="proj-stat-sub">${taken.length} totaal</div>
    </div>
    <div class="proj-stat">
      <div class="proj-stat-label">Mijlpalen</div>
      <div class="proj-stat-val">${doneItems}/${allItems.length}</div>
      <div class="proj-stat-sub">deliverables voltooid</div>
    </div>
    <div class="proj-stat">
      <div class="proj-stat-label">Budget</div>
      <div class="proj-stat-val" style="color:var(--green)">€${parseFloat(p.budget||0).toLocaleString('nl-BE')}</div>
      <div class="proj-stat-sub">€${totFac.toLocaleString('nl-BE')} gefactureerd</div>
    </div>
    <div class="proj-stat">
      <div class="proj-stat-label">Deadline</div>
      <div class="proj-stat-val" style="font-size:16px">${fmt(p.deadline)||'—'}</div>
      <div class="proj-stat-sub">${p.deadline ? daysLeft(p.deadline) : ''}</div>
    </div>
    <div class="proj-stat">
      <div class="proj-stat-label">Tech stack</div>
      <div class="proj-stat-val">${(arch.tech||[]).length}</div>
      <div class="proj-stat-sub">technologieën</div>
    </div>
    <div class="proj-stat proj-stat-tracker">
      <div class="proj-stat-label">Live opleverstatus</div>
      <div class="proj-stat-val" style="font-size:16px">${delivery.phaseLabel}</div>
      <div class="proj-stat-sub">Geschatte oplevering: ${delivery.etaText}</div>
      <div class="delivery-track">
        ${delivery.steps.map((s, i) => `
          <div class="delivery-step ${i < delivery.phaseIndex ? 'done' : ''} ${i === delivery.phaseIndex ? 'active' : ''}">
            <div class="delivery-dot"></div>
            <div class="delivery-label">${s}</div>
          </div>
        `).join('')}
      </div>
      <div class="proj-stat-sub">${delivery.confidenceText}</div>
    </div>`;

  document.getElementById('arch-details').innerHTML = `
    ${rowArch('Status', statusBadge(p.status))}
    ${rowArch('Klant', klantNaam(p.klantId))}
    ${rowArch('Start', fmt(p.start)||'—')}
    ${rowArch('Deadline', fmt(p.deadline)||'—')}
    ${rowArch('Live status', `<span class="badge badge-blue">${delivery.phaseLabel}</span> · ${delivery.etaText}`)}
    ${rowArch('Opvolgmail', p.followupCadence && p.followupCadence !== 'uit' ? `Actief (${p.followupCadence})` : 'Uit')}
    ${rowArch('Laatste opvolging', fmt(p.followupLastSent)||'—')}
    ${rowArch('Volgende opvolging', fmt(p.followupNextDue)||'—')}
    ${rowArch('Budget', p.budget?'€'+parseFloat(p.budget).toLocaleString('nl-BE'):'—')}
    ${rowArch('Tags', (p.tags||[]).map(t=>`<span class="tag">${t}</span>`).join(' ')||'—')}
    ${rowArch('Beschrijving', p.desc||'—')}
    <div style="padding:12px 16px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-ghost" onclick="editProject('${id}')">✎ Bewerk project</button>
      <button class="btn btn-primary" onclick="switchArchTab('kanban',document.querySelectorAll('.proj-arch-tab')[1])">Open Kanban</button>
      <button class="btn btn-ghost" onclick="switchArchTab('roadmap',document.querySelectorAll('.proj-arch-tab')[2])">Roadmap</button>
      <button class="btn btn-ghost" onclick="sendProjectFollowupEmail('${id}')">✉ Stuur opvolgmail</button>
    </div>`;

  // Mini tijdlijn van mijlpalen
  const events = ms.slice(0,5).map(m => ({
    naam: m.naam, datum: m.datum,
    done: m.status==='done', desc: m.desc||''
  }));
  document.getElementById('arch-timeline-mini').innerHTML = events.length ? events.map(e=>`
    <div class="timeline-event">
      <div class="timeline-dot-col">
        <div class="timeline-dot ${e.done?'done':''}"></div>
        <div class="timeline-line"></div>
      </div>
      <div class="timeline-content">
        <div class="timeline-title">${e.naam}</div>
        <div class="timeline-date">${fmt(e.datum)||'Geen datum'}</div>
        ${e.desc?`<div class="timeline-desc">${e.desc}</div>`:''}
      </div>
    </div>`).join('') : '<div style="color:var(--text3);font-size:13px;padding:12px 16px">Nog geen mijlpalen — voeg ze toe in de Roadmap tab</div>';
}

function rowArch(label, val) {
  return `<div style="display:flex;align-items:flex-start;gap:10px;padding:9px 16px;border-bottom:1px solid var(--border);font-size:13px">
    <div style="color:var(--text3);font-family:'JetBrains Mono',monospace;font-size:11px;min-width:100px;padding-top:1px">${label}</div>
    <div style="color:var(--text);flex:1">${val}</div>
  </div>`;
}

function daysLeft(dateStr) {
  const d = new Date(dateStr+'T00:00:00');
  const diff = Math.round((d - new Date()) / 86400000);
  if (diff < 0) return `${Math.abs(diff)} dagen te laat`;
  if (diff === 0) return 'Vandaag!';
  return `nog ${diff} dagen`;
}

function getProjectDeliveryStatus(project, taken, milestones) {
  const progress = Math.max(0, Math.min(100, parseInt(project.progress || 0, 10)));
  const openTasks = (taken || []).filter(t => !t.done).length;
  const totalMilestones = (milestones || []).length;
  const doneMilestones = (milestones || []).filter(m => m.status === 'done').length;
  const milestoneRatio = totalMilestones ? (doneMilestones / totalMilestones) : 0;

  const steps = ['Besteld', 'Analyse', 'Bouw', 'Test', 'Oplevering'];
  let phaseIndex = 0;
  if (progress >= 100 || project.status === 'voltooid') phaseIndex = 4;
  else if (progress >= 75) phaseIndex = 3;
  else if (progress >= 45) phaseIndex = 2;
  else if (progress >= 15) phaseIndex = 1;

  let phaseLabel = steps[phaseIndex];
  if (project.status === 'pauze') phaseLabel = 'On hold';
  if (project.status === 'concept') phaseLabel = 'Intake';

  const todayDate = new Date();
  const startDate = project.start ? new Date(project.start + 'T00:00:00') : null;
  const deadlineDate = project.deadline ? new Date(project.deadline + 'T00:00:00') : null;

  let eta = deadlineDate ? new Date(deadlineDate) : null;
  if (startDate && progress > 5) {
    const elapsedDays = Math.max(1, Math.round((todayDate - startDate) / 86400000));
    const projectedTotalDays = Math.round(elapsedDays / (progress / 100));
    eta = new Date(startDate);
    eta.setDate(startDate.getDate() + projectedTotalDays);
  } else if (!eta && startDate) {
    eta = new Date(startDate);
    eta.setDate(startDate.getDate() + 30);
  } else if (!eta) {
    eta = new Date(todayDate);
    eta.setDate(todayDate.getDate() + 30);
  }

  let confidence = 65;
  if (progress >= 85) confidence = 90;
  else if (progress >= 60) confidence = 80;
  else if (progress >= 35) confidence = 72;
  if (openTasks > 10) confidence -= 10;
  if (milestoneRatio >= 0.7) confidence += 8;
  confidence = Math.max(35, Math.min(95, confidence));

  const etaText = fmt(eta.toISOString().slice(0, 10)) + ` (${daysLeft(eta.toISOString().slice(0, 10))})`;
  const confidenceText = `Voorspelling: ${confidence}% betrouwbaar · ${openTasks} open taken`;

  return { steps, phaseIndex, phaseLabel, etaText, confidenceText };
}

function computeNextFollowupDate(cadence, fromDate) {
  const base = new Date((fromDate || today()) + 'T00:00:00');
  const map = { wekelijks: 7, '2wekelijks': 14, maandelijks: 30 };
  const days = map[cadence] || 0;
  if (!days) return '';
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0,10);
}

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getFollowupMailConfig() {
  const url = (localStorage.getItem('hohoh_followup_url') || (typeof window !== 'undefined' && (window.__ORION_FOLLOWUP_URL__ || window.__HOHOH_FOLLOWUP_URL__)) || '').trim();
  const secret = (localStorage.getItem('hohoh_followup_secret') || (typeof window !== 'undefined' && (window.__ORION_FOLLOWUP_SECRET__ || window.__HOHOH_FOLLOWUP_SECRET__)) || '').trim();
  return { url, secret };
}

function loadFollowupMailSettings() {
  const { url, secret } = getFollowupMailConfig();
  const elU = document.getElementById('followup-url');
  const elS = document.getElementById('followup-secret');
  if (elU) elU.value = url;
  if (elS) elS.value = secret;
}

function saveFollowupMailSettings() {
  const elU = document.getElementById('followup-url');
  const elS = document.getElementById('followup-secret');
  const u = (elU && elU.value) ? elU.value.trim() : '';
  const s = (elS && elS.value) ? elS.value.trim() : '';
  localStorage.setItem('hohoh_followup_url', u);
  localStorage.setItem('hohoh_followup_secret', s);
  const st = document.getElementById('followup-settings-status');
  if (st) {
    st.textContent = '✓ Opgeslagen';
    setTimeout(() => { st.textContent = ''; }, 2500);
  }
  toast('✓ Opvolgmail-instellingen opgeslagen');
}

/** Platte tekst + HTML met voortgangsbalk (e-mailclients: inline styles) */
function buildFollowupEmailBodies(p, k, delivery) {
  const progress = Math.max(0, Math.min(100, parseInt(p.progress || 0, 10)));
  const naam = escHtml(p.naam);
  const fase = escHtml(delivery.phaseLabel);
  const voornaam = escHtml(k.voornaam || '');
  const eta = escHtml(delivery.etaText);

  const text =
`Beste ${k.voornaam || ''},

Hierbij een statusupdate van je project:

- Project: ${p.naam}
- Huidige fase: ${delivery.phaseLabel}
- Voortgang: ${progress}%
- Geschatte oplevering: ${delivery.etaText}

We houden je op de hoogte van de volgende stap.

Groeten,
HohoSolutions`;

  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a;">
<p>Beste ${voornaam || 'klant'},</p>
<p>Hierbij een statusupdate van je project:</p>
<table cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:14px;">
<tr><td style="padding:4px 0;color:#666;">Project</td><td style="padding:4px 0;"><strong>${naam}</strong></td></tr>
<tr><td style="padding:4px 0;color:#666;">Huidige fase</td><td style="padding:4px 0;">${fase}</td></tr>
<tr><td style="padding:4px 0;color:#666;">Geschatte oplevering</td><td style="padding:4px 0;">${eta}</td></tr>
</table>
<p style="margin:12px 0 6px;font-size:12px;color:#666;">Voortgang</p>
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:420px;border-collapse:collapse;">
<tr><td style="background:#e8e6f4;border-radius:10px;height:22px;overflow:hidden;padding:0;">
<div style="width:${progress}%;max-width:100%;background:linear-gradient(90deg,#7c6cf6,#534ab7);height:22px;border-radius:10px;"></div>
</td></tr>
<tr><td style="font-size:13px;color:#534ab7;padding-top:8px;font-weight:600;">${progress}%</td></tr>
</table>
<p style="margin-top:20px;">We houden je op de hoogte van de volgende stap.</p>
<p>Groeten,<br><strong>HohoSolutions</strong></p>
</body></html>`;

  return { text, html };
}

async function sendProjectFollowupEmail(projectId, isAuto = false) {
  const p = db.projecten.find(x => x.id === projectId);
  if (!p) return;
  const k = db.klanten.find(x => x.id === p.klantId);
  if (!k || !k.email) {
    toast('❌ Klant heeft geen e-mailadres');
    return;
  }
  const delivery = getProjectDeliveryStatus(p, db.taken.filter(t => t.projectId === projectId), db.roadmaps[projectId] || []);
  const subjectPlain = `Opvolging project ${p.naam} — ${delivery.phaseLabel}`;
  const { url, secret } = getFollowupMailConfig();

  const markSent = () => {
    p.followupLastSent = today();
    p.followupNextDue = p.followupCadence && p.followupCadence !== 'uit'
      ? computeNextFollowupDate(p.followupCadence, today())
      : '';
    save();
    if (!isAuto) {
      render();
      toast('✓ Opvolgmail verzonden');
    }
  };

  if (url && secret) {
    const { text, html } = buildFollowupEmailBodies(p, k, delivery);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Followup-Secret': secret,
        },
        body: JSON.stringify({
          to: k.email,
          subject: subjectPlain,
          text,
          html,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(`❌ Verzenden mislukt: ${data.error || res.status}`);
        return;
      }
      markSent();
      if (isAuto) toast(`⏰ Opvolgmail verzonden: ${p.naam}`);
    } catch (e) {
      toast(`❌ Netwerkfout: ${e.message || 'onbekend'}`);
    }
    return;
  }

  if (isAuto) return;

  const subject = encodeURIComponent(subjectPlain);
  const body = encodeURIComponent(
`Beste ${k.voornaam || ''},

Hierbij een statusupdate van je project:

- Project: ${p.naam}
- Huidige fase: ${delivery.phaseLabel}
- Voortgang: ${p.progress || 0}%
- Geschatte oplevering: ${delivery.etaText}

We houden je op de hoogte van de volgende stap.

Groeten,
HohoSolutions`);
  window.location.href = `mailto:${k.email}?subject=${subject}&body=${body}`;

  p.followupLastSent = today();
  p.followupNextDue = p.followupCadence && p.followupCadence !== 'uit'
    ? computeNextFollowupDate(p.followupCadence, today())
    : '';
  save();
  render();
  toast('✓ Opvolgmail voorbereid (Mail-app)');
}

function runAutomaticFollowupEngine() {
  if (autoFollowupTriggeredToday) return;
  const { url, secret } = getFollowupMailConfig();
  if (!url || !secret) return;
  const todayStr = today();
  const due = db.projecten.find(p =>
    p.followupCadence && p.followupCadence !== 'uit' &&
    p.followupNextDue &&
    p.followupNextDue <= todayStr &&
    p.followupLastSent !== todayStr
  );
  if (!due) return;
  const k = db.klanten.find(x => x.id === due.klantId);
  if (!k || !k.email) return;
  autoFollowupTriggeredToday = true;
  sendProjectFollowupEmail(due.id, true).catch(() => {});
}

// KANBAN
function renderArchKanban(id) {
  const arch = getArch(id);
  const cols = [
    { key:'todo', label:'Te doen', color:'var(--text3)' },
    { key:'inprogress', label:'Bezig', color:'var(--blue)' },
    { key:'review', label:'Review', color:'var(--amber)' },
    { key:'done', label:'Voltooid', color:'var(--green)' }
  ];
  document.getElementById('arch-kanban').innerHTML = cols.map(col => {
    const cards = (arch.kanban[col.key]||[]);
    return `<div class="kanban-col">
      <div class="kanban-col-head">
        <div class="kanban-col-title" style="color:${col.color}">${col.label}</div>
        <span class="kanban-col-count">${cards.length}</span>
      </div>
      <div class="kanban-cards">
        ${cards.map((c,i)=>`<div class="kanban-card">
          <div class="kanban-card-title">${c.naam}</div>
          ${c.desc?`<div style="font-size:11px;color:var(--text2);margin-top:3px">${c.desc}</div>`:''}
          <div class="kanban-card-meta">
            ${c.prio?statusBadge(c.prio):''}
            ${c.datum?`<span class="badge badge-gray td-mono">${fmt(c.datum)}</span>`:''}
            <select onchange="moveKanbanCard('${id}','${col.key}',${i},this.value)" style="font-size:10px;background:var(--surface);border:1px solid var(--border);border-radius:4px;color:var(--text2);padding:2px 4px;cursor:pointer;outline:none;margin-left:auto">
              ${cols.map(c2=>`<option value="${c2.key}"${c2.key===col.key?' selected':''}>${c2.label}</option>`).join('')}
            </select>
            <button onclick="delKanbanCard('${id}','${col.key}',${i})" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:12px;padding:0 3px">✕</button>
          </div>
        </div>`).join('')}
      </div>
      <button class="kanban-add" onclick="addKanbanCard('${id}','${col.key}')">+ Toevoegen</button>
    </div>`;
  }).join('');
}

async function addKanbanCard(pid, col) {
  const data = await openArchInputModal('Nieuwe taak', [
    { id: 'naam', label: 'Taaknaam', placeholder: 'Korte titel' },
    { id: 'desc', label: 'Beschrijving (optioneel)', placeholder: '' }
  ]);
  if (!data || !data.naam || !data.naam.trim()) return;
  const naam = data.naam.trim();
  const desc = (data.desc || '').trim();
  if (!db.arch[pid]) db.arch[pid] = { kanban:{todo:[],inprogress:[],review:[],done:[]}, tech:[], bestanden:[], tijdlijn:[], notities:'' };
  if (!db.arch[pid].kanban[col]) db.arch[pid].kanban[col] = [];
  db.arch[pid].kanban[col].push({ naam, desc, prio:'normaal', datum:'' });
  saveArch(); renderArchKanban(pid);
}

function addKanbanTask() { addKanbanCard(currentArchProjectId, 'todo'); }

function moveKanbanCard(pid, fromCol, idx, toCol) {
  const card = db.arch[pid].kanban[fromCol].splice(idx, 1)[0];
  if (!db.arch[pid].kanban[toCol]) db.arch[pid].kanban[toCol] = [];
  db.arch[pid].kanban[toCol].push(card);
  saveArch(); renderArchKanban(pid);
}

function delKanbanCard(pid, col, idx) {
  db.arch[pid].kanban[col].splice(idx, 1);
  saveArch(); renderArchKanban(pid);
}

// ROADMAP (project-specific)
function renderArchRoadmap(id) {
  if (!db.roadmaps[id]) db.roadmaps[id] = [];
  const milestones = db.roadmaps[id];
  const body = document.getElementById('arch-roadmap-body');
  if (!milestones.length) {
    body.innerHTML = `<div class="empty"><div class="empty-icon">◉</div><div class="empty-text">Nog geen mijlpalen</div><div class="empty-sub">Klik op + Mijlpaal om te beginnen</div></div>`;
    return;
  }
  body.innerHTML = milestones.map((ms, mi) => {
    const done = (ms.items||[]).filter(i=>i.done).length;
    const total = (ms.items||[]).length;
    const pct = total ? Math.round((done/total)*100) : 0;
    const isOpen = ms._open !== false;
    return `<div class="milestone-card" style="margin-bottom:12px">
      <div class="milestone-head" onclick="toggleArchMs(${mi})">
        <div class="milestone-dot ${ms.status||'open'}"></div>
        <div class="milestone-title">${ms.naam}</div>
        ${ms.datum?`<div class="milestone-meta">📅 ${fmt(ms.datum)}</div>`:''}
        <div class="ms-progress"><div class="ms-bar"><div class="ms-fill" style="width:${pct}%"></div></div><span>${done}/${total}</span></div>
        <select class="gantt-select" style="padding:3px 6px;font-size:11px" onclick="event.stopPropagation()" onchange="changeArchMsStatus(${mi},this.value)">
          <option value="open"${(ms.status||'open')==='open'?' selected':''}>Open</option>
          <option value="done"${ms.status==='done'?' selected':''}>Voltooid</option>
          <option value="blocked"${ms.status==='blocked'?' selected':''}>Geblokkeerd</option>
        </select>
        <button class="btn btn-ghost" style="padding:3px 8px;font-size:11px" onclick="event.stopPropagation();delArchMs(${mi})">✕</button>
        <div class="milestone-toggle ${isOpen?'open':''}">▶</div>
      </div>
      ${isOpen?`<div class="milestone-items">
        ${ms.desc?`<div style="font-size:12px;color:var(--text2);padding:8px 0;border-bottom:1px solid var(--border);line-height:1.5">${ms.desc}</div>`:''}
        ${(ms.items||[]).map((item,ii)=>`<div class="rm-item">
          <div class="rm-check ${item.done?'done':''}" onclick="toggleArchItem(${mi},${ii})"></div>
          <div class="rm-content">
            <div class="rm-name ${item.done?'done-text':''}">${item.naam}</div>
            ${item.desc?`<div class="rm-desc">${item.desc}</div>`:''}
            <div class="rm-foot">${item.prio?statusBadge(item.prio):''}${item.datum?`<span class="badge badge-gray td-mono">📅 ${fmt(item.datum)}</span>`:''}</div>
          </div>
          <button class="btn btn-ghost" style="padding:3px 8px;font-size:11px" onclick="delArchItem(${mi},${ii})">✕</button>
        </div>`).join('')}
        <div class="add-item-row">
          <input placeholder="+ Deliverable toevoegen..." id="arch-item-${mi}" onkeydown="if(event.key==='Enter')addArchItem(${mi})" style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:7px 10px;font-size:13px;color:var(--text);font-family:'Plus Jakarta Sans',sans-serif;outline:none;flex:1">
          <input type="date" id="arch-item-date-${mi}" style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:7px 10px;font-size:12px;color:var(--text);font-family:'Plus Jakarta Sans',sans-serif;outline:none;width:150px">
          <button class="btn btn-primary" onclick="addArchItem(${mi})">+</button>
        </div>
      </div>`:''}
    </div>`;
  }).join('');
}

async function addArchMilestone() {
  const id = currentArchProjectId;
  if (!db.roadmaps[id]) db.roadmaps[id] = [];
  const data = await openArchInputModal('Nieuwe mijlpaal', [
    { id: 'naam', label: 'Naam', placeholder: 'Mijlpaal' },
    { id: 'datum', label: 'Deadline (optioneel)', type: 'date' },
    { id: 'desc', label: 'Beschrijving (optioneel)', placeholder: '' }
  ]);
  if (!data || !data.naam || !data.naam.trim()) return;
  const naam = data.naam.trim();
  const datum = (data.datum || '').trim();
  const desc = (data.desc || '').trim();
  db.roadmaps[id].push({ naam, datum, desc, status:'open', items:[], _open:true });
  save(); renderArchRoadmap(id);
}
async function delArchMs(mi) {
  if (!(await openArchConfirmModal('Verwijderen?'))) return;
  db.roadmaps[currentArchProjectId].splice(mi,1);
  save(); renderArchRoadmap(currentArchProjectId);
}
function toggleArchMs(mi) {
  const ms = db.roadmaps[currentArchProjectId][mi];
  ms._open = ms._open===false;
  save(); renderArchRoadmap(currentArchProjectId);
}
function changeArchMsStatus(mi, val) {
  db.roadmaps[currentArchProjectId][mi].status = val;
  save(); renderArchRoadmap(currentArchProjectId);
}
function addArchItem(mi) {
  const id = currentArchProjectId;
  const naam = (document.getElementById('arch-item-'+mi)||{}).value;
  if (!naam||!naam.trim()) return;
  const datum = (document.getElementById('arch-item-date-'+mi)||{}).value||'';
  db.roadmaps[id][mi].items.push({ naam:naam.trim(), datum, done:false });
  save(); renderArchRoadmap(id);
}
function toggleArchItem(mi, ii) {
  const id = currentArchProjectId;
  const item = db.roadmaps[id][mi].items[ii];
  item.done = !item.done;
  const ms = db.roadmaps[id][mi];
  if (ms.items.every(i=>i.done)&&ms.items.length) ms.status='done';
  else if(ms.status==='done') ms.status='open';
  save(); renderArchRoadmap(id);
}
function delArchItem(mi, ii) {
  db.roadmaps[currentArchProjectId][mi].items.splice(ii,1);
  save(); renderArchRoadmap(currentArchProjectId);
}

// TIJDLIJN
function renderArchTijdlijn(id) {
  const arch = getArch(id);
  const p = db.projecten.find(p=>p.id===id);
  const ms = (db.roadmaps[id]||[]).filter(m=>m.datum);
  const body = document.getElementById('arch-tijdlijn-body');

  // Build events: project start, milestones, deadline
  const events = [];
  if (p.start) events.push({ naam:'Project start', datum:p.datum||p.start, done:true, desc:'', type:'start' });
  ms.forEach(m => events.push({ naam:m.naam, datum:m.datum, done:m.status==='done', desc:m.desc||'', type:'milestone' }));
  if (p.deadline) events.push({ naam:'Deadline', datum:p.deadline, done:false, desc:'Geplande einddatum', type:'deadline' });
  events.sort((a,b)=>a.datum.localeCompare(b.datum));

  if (!events.length) {
    body.innerHTML = `<div class="empty"><div class="empty-icon">▬</div><div class="empty-text">Voeg data toe aan het project en mijlpalen om de tijdlijn te zien</div></div>`;
    return;
  }

  // Also show arch tijdlijn entries
  const customEvents = (arch.tijdlijn||[]);

  body.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div>
        <div style="font-size:13px;font-weight:700;margin-bottom:12px">Automatische tijdlijn</div>
        <div class="mini-timeline">
          ${events.map((e,i)=>`<div class="timeline-event">
            <div class="timeline-dot-col">
              <div class="timeline-dot ${e.done?'done':''}" style="${e.type==='deadline'?'border-color:var(--red)':''}${e.type==='start'?'border-color:var(--green);background:var(--green)':''}"></div>
              ${i<events.length-1?`<div class="timeline-line"></div>`:''}
            </div>
            <div class="timeline-content">
              <div class="timeline-title">${e.naam}</div>
              <div class="timeline-date">${fmt(e.datum)}</div>
              ${e.desc?`<div class="timeline-desc">${e.desc}</div>`:''}
            </div>
          </div>`).join('')}
        </div>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div style="font-size:13px;font-weight:700">Manuele events</div>
          <button class="btn btn-primary" style="padding:5px 12px;font-size:12px" onclick="addTijdlijnEvent()">+ Event</button>
        </div>
        <div class="mini-timeline" id="arch-custom-events">
          ${customEvents.length ? customEvents.map((e,i)=>`<div class="timeline-event">
            <div class="timeline-dot-col">
              <div class="timeline-dot ${e.done?'done':''}"></div>
              ${i<customEvents.length-1?`<div class="timeline-line"></div>`:''}
            </div>
            <div class="timeline-content">
              <div class="timeline-title">${e.naam}</div>
              <div class="timeline-date">${fmt(e.datum)}</div>
              ${e.desc?`<div class="timeline-desc">${e.desc}</div>`:''}
            </div>
            <button onclick="delTijdlijnEvent(${i})" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:12px;padding:0 4px;align-self:flex-start">✕</button>
          </div>`).join('') : '<div style="color:var(--text3);font-size:13px">Nog geen manuele events</div>'}
        </div>
      </div>
    </div>`;
}

async function addTijdlijnEvent() {
  const id = currentArchProjectId;
  const data = await openArchInputModal('Manueel event', [
    { id: 'naam', label: 'Eventnaam', placeholder: '' },
    { id: 'datum', label: 'Datum', type: 'date', value: today() },
    { id: 'desc', label: 'Beschrijving (optioneel)', placeholder: '' }
  ]);
  if (!data || !data.naam || !data.naam.trim()) return;
  const naam = data.naam.trim();
  const datum = (data.datum || '').trim() || today();
  const desc = (data.desc || '').trim();
  if (!db.arch[id]) db.arch[id] = { kanban:{todo:[],inprogress:[],review:[],done:[]}, tech:[], bestanden:[], tijdlijn:[], notities:'' };
  db.arch[id].tijdlijn.push({ naam, datum, desc, done:false });
  save(); renderArchTijdlijn(id);
}
function delTijdlijnEvent(i) {
  db.arch[currentArchProjectId].tijdlijn.splice(i,1);
  save(); renderArchTijdlijn(currentArchProjectId);
}

// TECH STACK
function renderArchTech(id) {
  const arch = getArch(id);
  const cats = { frontend:'Frontend', backend:'Backend', database:'Database', devops:'DevOps', api:'API / Integratie', design:'Design', testing:'Testing', other:'Overig' };
  document.getElementById('arch-tech-grid').innerHTML = (arch.tech||[]).map((t,i)=>`
    <div class="tech-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div class="tech-name">${t.naam}</div>
        <button onclick="delTech(${i})" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:12px">✕</button>
      </div>
      <div class="tech-cat">${cats[t.cat]||t.cat||'Overig'}</div>
      ${t.versie?`<div style="font-size:11px;color:var(--text3);font-family:'JetBrains Mono',monospace">${t.versie}</div>`:''}
      ${t.note?`<div style="font-size:11px;color:var(--text2);margin-top:4px">${t.note}</div>`:''}
    </div>`).join('') || `<div class="empty" style="grid-column:1/-1"><div class="empty-icon">⌥</div><div class="empty-text">Nog geen technologieën</div></div>`;
}

async function addTechItem() {
  const id = currentArchProjectId;
  const data = await openArchInputModal('Technologie', [
    { id: 'naam', label: 'Technologie / tool', placeholder: 'React, PostgreSQL…' },
    { id: 'cat', label: 'Categorie', type: 'select', value: 'other', options: [
      { v: 'frontend', label: 'Frontend' }, { v: 'backend', label: 'Backend' }, { v: 'database', label: 'Database' },
      { v: 'devops', label: 'DevOps' }, { v: 'api', label: 'API / integratie' }, { v: 'design', label: 'Design' },
      { v: 'testing', label: 'Testing' }, { v: 'other', label: 'Overig' }
    ] },
    { id: 'versie', label: 'Versie (optioneel)', placeholder: '1.0' },
    { id: 'note', label: 'Notitie (optioneel)', placeholder: '' }
  ]);
  if (!data || !data.naam || !data.naam.trim()) return;
  const naam = data.naam.trim();
  const cat = (data.cat || 'other').trim() || 'other';
  const versie = (data.versie || '').trim();
  const note = (data.note || '').trim();
  if (!db.arch[id]) db.arch[id] = { kanban:{todo:[],inprogress:[],review:[],done:[]}, tech:[], bestanden:[], tijdlijn:[], notities:'' };
  db.arch[id].tech.push({ naam, cat, versie, note });
  save(); renderArchTech(id);
}
function delTech(i) {
  db.arch[currentArchProjectId].tech.splice(i,1);
  save(); renderArchTech(currentArchProjectId);
}

// BESTANDEN
function renderArchBestanden(id) {
  const arch = getArch(id);
  const icons = { pdf:'📄', figma:'🎨', github:'💻', drive:'📁', notion:'📝', link:'🔗', other:'📎' };
  document.getElementById('arch-bestanden-list').innerHTML = (arch.bestanden||[]).length ?
    (arch.bestanden).map((b,i)=>`<div class="file-entry">
      <div class="file-icon">${icons[b.type]||'📎'}</div>
      <div style="flex:1">
        <div class="file-name">${b.naam}</div>
        <div class="file-meta">${b.type||'link'} ${b.datum?'· '+fmt(b.datum):''}${b.fileSize?` · ${Math.round((b.fileSize/1024)*10)/10} KB`:''}</div>
        ${b.note?`<div style="font-size:11px;color:var(--text2);margin-top:2px">${b.note}</div>`:''}
      </div>
      ${b.url?`<a href="${b.url}" ${b.url.startsWith('data:') ? `download="${escapeArchAttr(b.downloadName || b.naam || 'bestand')}"` : 'target="_blank"'} class="btn btn-ghost" style="padding:4px 10px;font-size:12px">${b.url.startsWith('data:') ? 'Download' : 'Openen'}</a>`:''}
      <button onclick="delBestand(${i})" class="btn btn-ghost" style="padding:4px 8px;font-size:12px;color:var(--text3)">✕</button>
    </div>`).join('') :
    `<div class="empty"><div class="empty-icon">📁</div><div class="empty-text">Nog geen bestanden of links</div></div>`;
}

function bestandSuggestDefaults() {
  const pid = currentArchProjectId;
  const p = db.projecten.find((x) => x.id === pid);
  const k = p ? db.klanten.find((x) => x.id === p.klantId) : null;
  const naam = p ? `Document — ${p.naam}` : 'Link';
  const url = (p && p.githubUrl) ? p.githubUrl : (k && k.website) ? k.website : '';
  const type = (p && p.githubUrl) ? 'github' : 'link';
  const note = k ? `${k.voornaam || ''} ${k.achternaam || ''}`.trim() : '';
  return { naam, url, type, note };
}

async function addBestand() {
  const id = currentArchProjectId;
  const d = bestandSuggestDefaults();
  const data = await openArchInputModal('Bestand of link', [
    { id: 'naam', label: 'Naam / beschrijving', value: d.naam },
    { id: 'url', label: 'URL (optioneel)', value: d.url, placeholder: 'https://…' },
    { id: 'type', label: 'Type', type: 'select', value: d.type, options: [
      { v: 'pdf', label: 'PDF' }, { v: 'figma', label: 'Figma' }, { v: 'github', label: 'GitHub' },
      { v: 'drive', label: 'Drive' }, { v: 'notion', label: 'Notion' }, { v: 'link', label: 'Link' }, { v: 'other', label: 'Overig' }
    ] },
    { id: 'note', label: 'Notitie (optioneel)', value: d.note }
  ]);
  if (!data || !data.naam || !data.naam.trim()) return;
  const naam = data.naam.trim();
  const url = (data.url || '').trim();
  const type = (data.type || 'link').trim() || 'link';
  const note = (data.note || '').trim();
  if (!db.arch[id]) db.arch[id] = { kanban:{todo:[],inprogress:[],review:[],done:[]}, tech:[], bestanden:[], tijdlijn:[], notities:'' };
  db.arch[id].bestanden.push({ naam, url, type, note, datum:today() });
  save(); renderArchBestanden(id);
}
function delBestand(i) {
  db.arch[currentArchProjectId].bestanden.splice(i,1);
  save(); renderArchBestanden(currentArchProjectId);
}

function detectBestandType(fileName = '', mime = '') {
  const n = String(fileName || '').toLowerCase();
  const m = String(mime || '').toLowerCase();
  if (m.includes('pdf') || n.endsWith('.pdf')) return 'pdf';
  if (n.includes('figma')) return 'figma';
  if (n.includes('github')) return 'github';
  if (n.includes('notion')) return 'notion';
  return 'other';
}

function uploadBestandFromDevice() {
  const id = currentArchProjectId;
  if (!id) {
    toast('❌ Selecteer eerst een project');
    return;
  }
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.jpg,.jpeg,.png,.webp,.zip,.csv,.json';
  input.style.display = 'none';
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    if (!file) return;
    // localStorage heeft limiet; houd uploads compact zodat de app stabiel blijft.
    if (file.size > 5 * 1024 * 1024) {
      toast('❌ Bestand te groot (max 5MB voor lokale opslag)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || '');
      if (!url.startsWith('data:')) {
        toast('❌ Upload mislukt');
        return;
      }
      if (!db.arch[id]) db.arch[id] = { kanban:{todo:[],inprogress:[],review:[],done:[]}, tech:[], bestanden:[], tijdlijn:[], notities:'' };
      const item = {
        naam: file.name,
        url,
        type: detectBestandType(file.name, file.type),
        note: `Lokaal geüpload vanaf toestel`,
        datum: today(),
        fileSize: file.size,
        mime: file.type || '',
        downloadName: file.name
      };
      db.arch[id].bestanden.push(item);
      save();
      renderArchBestanden(id);
      toast('✓ Bestand geüpload');
    };
    reader.onerror = () => toast('❌ Kon bestand niet lezen');
    reader.readAsDataURL(file);
  });
  document.body.appendChild(input);
  input.click();
  setTimeout(() => input.remove(), 1200);
}

// NOTITIES
function renderArchNotities(id) {
  const arch = getArch(id);
  const el = document.getElementById('arch-notes-area');
  if (el) el.value = arch.notities || '';
}
function saveProjectNotes() {
  const id = currentArchProjectId;
  if (!db.arch[id]) db.arch[id] = { kanban:{todo:[],inprogress:[],review:[],done:[]}, tech:[], bestanden:[], tijdlijn:[], notities:'' };
  db.arch[id].notities = (document.getElementById('arch-notes-area')||{}).value || '';
  save(); toast('✓ Notities opgeslagen');
}

// FACTUREN PER PROJECT
function renderArchFacturen(id) {
  const list = db.facturen.filter(f=>f.projectId===id||f.klantId===(db.projecten.find(p=>p.id===id)||{}).klantId);
  const typeLabel = { factuur:'Factuur', voorschot:'Voorschot', creditnota:'Creditnota', offerte:'Offerte', 'pro-forma':'Pro-forma' };
  document.getElementById('arch-facturen-list').innerHTML = list.length ? list.map(f=>`
    <div class="file-entry" onclick="openFactuurDetail('${f.id}')" style="cursor:pointer">
      <div style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:600;min-width:100px">${f.num}</div>
      <span class="badge badge-type-${f.type||'factuur'}">${typeLabel[f.type||'factuur']}</span>
      <div style="flex:1;font-size:13px;color:var(--text2)">${f.desc||'—'}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700">€${(f.totaal||0).toLocaleString('nl-BE',{minimumFractionDigits:2})}</div>
      <span class="badge badge-status-${f.status||'concept'}">${f.status||'concept'}</span>
      <button type="button" class="btn btn-ghost" style="padding:4px 10px;font-size:11px;flex-shrink:0" onclick="event.stopPropagation();downloadFactuurPdf('${f.id}')">PDF</button>
    </div>`).join('') :
    `<div class="empty"><div class="empty-icon">📄</div><div class="empty-text">Geen facturen voor dit project</div></div>`;
}

function row(label, val) {
  return `<div class="detail-row"><div class="detail-key">${label}</div><div class="detail-val">${val||'—'}</div></div>`;
}

function normalizeGithubRepo(input) {
  const raw = (input || '').trim();
  if (!raw) return '';
  const cleaned = raw
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/^github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+|\/+$/g, '');
  const parts = cleaned.split('/');
  if (parts.length < 2) return '';
  const owner = parts[0].trim();
  const repo = parts[1].trim();
  if (!owner || !repo) return '';
  return `${owner}/${repo}`;
}

async function suggestProjectFromGithub() {
  const repo = normalizeGithubRepo(v('p-github'));
  if (!repo) {
    toast('❌ Vul een geldige GitHub repo in');
    return;
  }
  const setVal = (id, value) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (value === undefined || value === null) return;
    el.value = value;
  };

  try {
    toast('⏳ GitHub data ophalen...');
    const [repoRes, langRes, commitsRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${repo}`),
      fetch(`https://api.github.com/repos/${repo}/languages`),
      fetch(`https://api.github.com/repos/${repo}/commits?per_page=30`)
    ]);
    if (!repoRes.ok) throw new Error('Repo niet gevonden of API-limiet bereikt');
    const repoData = await repoRes.json();
    const langData = langRes.ok ? await langRes.json() : {};
    const commits = commitsRes.ok ? await commitsRes.json() : [];

    const commitDates = Array.isArray(commits) ? commits
      .map(c => c?.commit?.committer?.date || c?.commit?.author?.date)
      .filter(Boolean)
      .map(d => new Date(d)) : [];
    const latestCommit = commitDates.length ? new Date(Math.max(...commitDates.map(d => d.getTime()))) : null;
    const daysSinceLastCommit = latestCommit ? Math.floor((Date.now() - latestCommit.getTime()) / 86400000) : 9999;

    let status = 'concept';
    if (repoData.archived) status = 'voltooid';
    else if ((repoData.size || 0) > 0 && daysSinceLastCommit <= 21) status = 'actief';
    else if (daysSinceLastCommit <= 90) status = 'pauze';

    let progress = 10;
    if (repoData.archived) progress = 100;
    else if (daysSinceLastCommit <= 7) progress = 75;
    else if (daysSinceLastCommit <= 21) progress = 60;
    else if (daysSinceLastCommit <= 60) progress = 40;
    else progress = 25;

    const topLangs = Object.keys(langData || {}).slice(0, 4);
    const suggestedTags = [...new Set(['GitHub', ...topLangs])];
    const existingTags = v('p-tags').split(',').map(t => t.trim()).filter(Boolean);
    const mergedTags = [...new Set([...existingTags, ...suggestedTags])];

    const currentName = v('p-naam').trim();
    if (!currentName) setVal('p-naam', (repoData.name || '').replace(/[-_]/g, ' '));
    if (!v('p-desc').trim()) {
      const desc = repoData.description ? repoData.description : `Project gekoppeld aan ${repo}`;
      setVal('p-desc', desc);
    }
    setVal('p-status', status);
    setVal('p-progress', progress);
    setVal('p-start', (repoData.created_at || '').slice(0, 10));
    setVal('p-tags', mergedTags.join(', '));
    setVal('p-github', repo);

    const draft = {
      githubRepo: repo,
      githubUrl: `https://github.com/${repo}`,
      githubSyncedAt: new Date().toISOString(),
      githubStats: {
        stars: repoData.stargazers_count || 0,
        forks: repoData.forks_count || 0,
        openIssues: repoData.open_issues_count || 0,
        latestCommit: latestCommit ? latestCommit.toISOString() : null,
        commitSample: Array.isArray(commits) ? commits.length : 0,
        languages: topLangs
      }
    };
    const existing = editId ? db.projecten.find(p => p.id === editId) : null;
    if (existing) {
      Object.assign(existing, draft);
      save();
    }

    toast('✓ Project slim ingevuld vanuit GitHub');
  } catch (e) {
    toast(`❌ GitHub sync mislukt: ${e.message || 'Onbekende fout'}`);
  }
}

function openDetail() { document.getElementById('detail-panel').classList.add('open'); }
function closeDetail() { document.getElementById('detail-panel').classList.remove('open'); }

// ─── EDIT ─────────────────────────────────────────────────────────────────────
function editKlant(id) {
  const k = db.klanten.find(k=>k.id===id);
  if (!k) return;
  editId = id;
  document.getElementById('modal-klant-title').textContent = 'Klant bewerken';
  set('k-voornaam', k.voornaam); set('k-achternaam', k.achternaam);
  set('k-bedrijf', k.bedrijf); set('k-btw', k.btw);
  set('k-email', k.email); set('k-tel', k.tel);
  set('k-sector', k.sector); set('k-status', k.status);
  set('k-adres', k.adres); set('k-website', k.website);
  set('k-notities', k.notities);
  openModal('modal-klant');
  closeDetail();
}

function set(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val || '';
}

function editProject(id) {
  const p = db.projecten.find(x => x.id === id);
  if (!p) return;
  editId = id;
  openModal('modal-project');
  set('p-naam', p.naam); set('p-klant', p.klantId);
  set('p-status', p.status); set('p-budget', p.budget);
  set('p-start', p.start); set('p-deadline', p.deadline);
  set('p-progress', p.progress); set('p-desc', p.desc);
  set('p-tags', (p.tags || []).join(', '));
  set('p-github', p.githubRepo || p.githubUrl || '');
  set('p-followup-cadence', p.followupCadence || 'uit');
  closeDetail();
}

// ─── SEARCH ───────────────────────────────────────────────────────────────────
function globalSearch(q) {
  q = q.toLowerCase().trim();
  if (!q) { render(); return; }
  if (currentPage === 'klanten') {
    renderKlanten(db.klanten.filter(k =>
      `${k.voornaam} ${k.achternaam} ${k.bedrijf} ${k.email} ${k.sector}`.toLowerCase().includes(q)
    ));
  }
  if (currentPage === 'projecten') {
    renderProjecten(db.projecten.filter(p =>
      `${p.naam} ${p.desc} ${(p.tags||[]).join(' ')}`.toLowerCase().includes(q)
    ));
  }
  if (currentPage === 'taken') {
    renderTaken(db.taken.filter(t =>
      `${t.naam} ${t.note}`.toLowerCase().includes(q)
    ));
  }
  if (currentPage === 'facturen') {
    renderFacturen(db.facturen.filter(f =>
      `${f.num} ${f.desc}`.toLowerCase().includes(q)
    ));
  }
  if (currentPage === 'artikelen') {
    renderArtikelen((db.artikelen || []).filter((a) =>
      `${a.sku || ''} ${a.naam || ''} ${a.omschrijving || ''}`.toLowerCase().includes(q)
    ));
  }
  if (currentPage === 'financieel') {
    renderFinancieel(q);
  }
}

// ─── FINANCIEEL (indicatief — o.a. naar beroepskosten.be) ────────────────────
let finJaar = new Date().getFullYear();
let finEditUitgaveId = null;
let finEditInkomenId = null;

/** Categorieën in lijn met rubrieken op beroepskosten.be; percentages = ruwe indicatie, geen fiscaal advies. */
const FIN_CATEGORY_META = {
  belastingen_verzekeringen: { label: 'Belastingen & verzekeringen', groep: 'Aanbevolen', aftrekPct: 100, risico: 'laag', hint: 'Bijv. VAPZ, sociale bijdragen — vaak volledig aftrekbaar als beroepskost.' },
  eten_drinken: { label: 'Eten & drinken (restaurant zakelijk)', groep: 'Eten & drinken', aftrekPct: 50, risico: 'midden', hint: 'Vooral aftrekbaar bij uitnodiging (potentiële) klanten of leveranciers; hou bewijs en context bij.' },
  financien: { label: 'Financiële kosten', groep: 'Financiën', aftrekPct: 100, risico: 'laag', hint: 'Bankkosten, rente zakelijk krediet indien professioneel.' },
  gereedschap: { label: 'Gereedschap & klein materiaal', groep: 'Gereedschap', aftrekPct: 100, risico: 'laag', hint: 'Duidelijk verband met de activiteit.' },
  informatica: { label: 'Informatica (PC, laptop, software)', groep: 'Informatica', aftrekPct: 100, risico: 'laag', hint: 'Sterk verband met vrijwel elke zelfstandige activiteit; bewaar facturen.' },
  kantoor: { label: 'Kantoorkosten', groep: 'Kantoorkosten', aftrekPct: 100, risico: 'laag', hint: 'Huur kantoor, kantoormateriaal, niet-persoonlijke abonnementen.' },
  kledij: { label: 'Kledij & uitrusting', groep: 'Kledij', aftrekPct: 30, risico: 'midden', hint: 'Alleen in zoverre uitsluitend of overwegend beroepsmatig; controlegevoelig.' },
  marketing: { label: 'Marketing & reclame', groep: 'Marketing', aftrekPct: 100, risico: 'laag', hint: 'Reclame, website, beurzen — typisch aftrekbaar.' },
  opleiding: { label: 'Opleiding (beroepsgericht)', groep: 'Opleiding', aftrekPct: 100, risico: 'laag', hint: 'Moet link hebben met huidige of toekomstige activiteit.' },
  reizen: { label: 'Reizen (zakelijk)', groep: 'Reizen', aftrekPct: 100, risico: 'midden', hint: 'Enkel professioneel deel; documenteer doel en dagen.' },
  telecom: { label: 'Telefoon & internet', groep: 'Telecom', aftrekPct: 50, risico: 'laag', hint: 'Professioneel aandeel vaak aftrekbaar; gemengd gebruik = verdeelsleutel.' },
  terrein_verbouw: { label: 'Terreinen & verbouwing', groep: 'Terrein', aftrekPct: null, risico: 'midden', hint: 'Sterk casusafhankelijk — percentage niet automatisch in te vullen.' },
  thuiskantoor: { label: 'Thuiskantoor', groep: 'Thuiskantoor', aftrekPct: null, risico: 'midden', hint: 'Forfait of werkelijke kosten volgens regels; vaak beperkt percentage van woning.' },
  vergoedingen: { label: 'Vergoedingen', groep: 'Vergoedingen', aftrekPct: 100, risico: 'midden', hint: 'Kilometervergoeding, onkostennota’s — binnen wettelijke limieten.' },
  vervoer: { label: 'Vervoer (openbaar, taxi, …)', groep: 'Vervoer', aftrekPct: 100, risico: 'midden', hint: 'Zakelijke verplaatsingen; niet woon-werk tenzij uitzondering.' },
  voertuig: { label: 'Voertuig (auto, leasing)', groep: 'Voertuig', aftrekPct: null, risico: 'hoog', hint: 'Beroepsmatig % + bewijs; veel controles — laat berekening nakijken door een accountant.' },
  werkplek: { label: 'Werkplek & meubilair', groep: 'Werkplek', aftrekPct: 100, risico: 'laag', hint: 'Bureau, stoel, lamp voor de professionele ruimte.' },
  fitness_lifestyle: { label: 'Fitness / sport / lifestyle', groep: 'Valkuil', aftrekPct: 0, risico: 'hoog', hint: 'Zoals op beroepskosten.be: meestal géén of zeer beperkte aftrek; hoge kans op vragen bij controle.' },
  overig: { label: 'Niet geclassificeerd / overig', groep: 'Overig', aftrekPct: 50, risico: 'hoog', hint: 'Onduidelijke posten vallen sneller op bij audit — kies een specifiekere categorie indien mogelijk.' }
};

function finMeta(cat) {
  return FIN_CATEGORY_META[cat] || FIN_CATEGORY_META.overig;
}

function finEffectieveAftrekPct(u) {
  if (u.aftrekOverride != null && u.aftrekOverride !== '' && !Number.isNaN(Number(u.aftrekOverride))) {
    const n = Math.max(0, Math.min(100, Number(u.aftrekOverride)));
    return n;
  }
  const m = finMeta(u.categorie);
  return m.aftrekPct;
}

function finGeschatAftrekbaarBedrag(u) {
  const b = parseFloat(u.bedrag) || 0;
  const p = finEffectieveAftrekPct(u);
  if (p == null) return null;
  return Math.round(b * p) / 100;
}

function finUitgavenVoorJaar(jaar) {
  const y = String(jaar);
  return (db.uitgaven || []).filter((u) => (u.datum || '').startsWith(y));
}

function finInkomstenVoorJaar(jaar) {
  const y = String(jaar);
  return (db.inkomsten || []).filter((i) => (i.datum || '').startsWith(y));
}

function finEvaluateRisks(jaar) {
  const list = finUitgavenVoorJaar(jaar);
  const alerts = [];
  let maxLevel = 'ok';

  let somHoog = 0;
  let somMidden = 0;
  let countHoog = 0;
  const hoogDetails = [];

  list.forEach((u) => {
    const m = finMeta(u.categorie);
    const b = parseFloat(u.bedrag) || 0;
    if (m.risico === 'hoog') {
      somHoog += b;
      countHoog++;
      if (b >= 200) {
        hoogDetails.push(`“${m.label}”: €${b.toLocaleString('nl-BE')}${u.omschrijving ? ' — ' + u.omschrijving.slice(0, 36) : ''}`);
      }
    } else if (m.risico === 'midden') {
      somMidden += b;
    }
  });

  if (hoogDetails.length) {
    const txt = hoogDetails.slice(0, 4).join(' · ') + (hoogDetails.length > 4 ? ' …' : '');
    alerts.push({
      level: 'danger',
      text: `Hoge controlekans (indicatief): ${txt}. Controleer bewijs en richtlijnen op beroepskosten.be.`
    });
    maxLevel = 'danger';
  }

  if (somHoog >= 800) {
    alerts.push({
      level: 'danger',
      text: `Totaal risicovolle categorieën (hoog) dit jaar: €${somHoog.toLocaleString('nl-BE')}. Overweeg afstemming met je accountant.`
    });
    maxLevel = 'danger';
  } else if (somHoog >= 400) {
    alerts.push({ level: 'warning', text: `Oplopend risico: €${somHoog.toLocaleString('nl-BE')} geboekt in categorieën met hoge controlekans.` });
    if (maxLevel === 'ok') maxLevel = 'warning';
  }

  if (somMidden >= 4000) {
    alerts.push({ level: 'warning', text: `Forse som (€${somMidden.toLocaleString('nl-BE')}) in categorieën met middelmatige complexiteit — documenteer zakelijk gebruik.` });
    if (maxLevel === 'ok') maxLevel = 'warning';
  }

  if (countHoog >= 4 && somHoog < 400) {
    alerts.push({ level: 'warning', text: `${countHoog} posten in risicovolle categorieën — bundel bewijsstukken per post.` });
    if (maxLevel === 'ok') maxLevel = 'warning';
  }

  return { maxLevel, alerts, somHoog, somMidden, countHoog };
}

function renderFinancieel(searchQ) {
  const q = (searchQ || '').toLowerCase().trim();
  const jaar = finJaar;
  const uit = finUitgavenVoorJaar(jaar).filter((u) =>
    !q || `${u.omschrijving} ${finMeta(u.categorie).label}`.toLowerCase().includes(q)
  );
  const ink = finInkomstenVoorJaar(jaar).filter((i) =>
    !q || `${i.omschrijving} ${i.bron || ''}`.toLowerCase().includes(q)
  );

  const totInk = ink.reduce((s, i) => s + (parseFloat(i.bedrag) || 0), 0);
  const totUit = uit.reduce((s, u) => s + (parseFloat(u.bedrag) || 0), 0);
  let totAftrek = 0;
  let aftrekOnbekend = false;
  uit.forEach((u) => {
    const g = finGeschatAftrekbaarBedrag(u);
    if (g == null) aftrekOnbekend = true;
    else totAftrek += g;
  });

  const sel = document.getElementById('fin-jaar-select');
  if (sel) {
    const curY = new Date().getFullYear();
    const opts = [curY, curY - 1, curY - 2, curY - 3, curY - 4];
    sel.innerHTML = opts.map((y) =>
      `<option value="${y}"${y === jaar ? ' selected' : ''}>${y}</option>`
    ).join('');
  }

  const risk = finEvaluateRisks(jaar);
  const banner = document.getElementById('fin-risk-banner');
  if (banner) {
    if (!risk.alerts.length) {
      banner.innerHTML = `<div class="fin-risk fin-risk--ok">Geen automatische risico-alerts voor ${jaar}. Dit is slechts een indicatie — geen fiscaal advies.</div>`;
    } else {
      banner.innerHTML = risk.alerts.map((a) =>
        `<div class="fin-risk fin-risk--${a.level}">${a.level === 'danger' ? '⚠️ ' : ''}${a.text}</div>`
      ).join('');
    }
  }

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('fin-stat-ink', '€ ' + totInk.toLocaleString('nl-BE', { minimumFractionDigits: 2 }));
  setEl('fin-stat-uit', '€ ' + totUit.toLocaleString('nl-BE', { minimumFractionDigits: 2 }));
  setEl('fin-stat-aftrek', aftrekOnbekend
    ? '€ ' + totAftrek.toLocaleString('nl-BE', { minimumFractionDigits: 2 }) + ' + variabel'
    : '€ ' + totAftrek.toLocaleString('nl-BE', { minimumFractionDigits: 2 }));
  setEl('fin-stat-net', '€ ' + (totInk - totUit).toLocaleString('nl-BE', { minimumFractionDigits: 2 }));

  const tbody = document.getElementById('fin-uit-tbody');
  if (tbody) {
    tbody.innerHTML = uit.length ? uit.map((u) => {
      const m = finMeta(u.categorie);
      const g = finGeschatAftrekbaarBedrag(u);
      const risLabel = m.risico === 'hoog' ? 'badge-red' : m.risico === 'midden' ? 'badge-amber' : 'badge-green';
      const aftrekStr = g == null ? '—' : '€ ' + g.toLocaleString('nl-BE', { minimumFractionDigits: 2 });
      return `<tr>
        <td class="td-mono">${fmt(u.datum)}</td>
        <td>${u.omschrijving || '—'}</td>
        <td><span class="badge badge-gray">${m.label}</span></td>
        <td class="td-mono">€ ${(parseFloat(u.bedrag) || 0).toLocaleString('nl-BE', { minimumFractionDigits: 2 })}</td>
        <td class="td-mono">${aftrekStr}</td>
        <td><span class="badge ${risLabel}">${m.risico}</span></td>
        <td><button type="button" class="btn btn-ghost" style="font-size:11px;padding:4px 8px" onclick="openFinUitgaveModal('${u.id}')">Bewerk</button>
            <button type="button" class="btn btn-ghost" style="font-size:11px;padding:4px 8px;color:var(--red)" onclick="delFinUitgave('${u.id}')">✕</button></td>
      </tr>`;
    }).join('') : `<tr><td colspan="7"><div class="empty"><div class="empty-icon">€</div><div class="empty-text">Geen uitgaven in ${jaar}</div></div></td></tr>`;
  }

  const itbody = document.getElementById('fin-ink-tbody');
  if (itbody) {
    itbody.innerHTML = ink.length ? ink.map((i) => `
      <tr>
        <td class="td-mono">${fmt(i.datum)}</td>
        <td>${i.omschrijving || '—'}</td>
        <td>${i.bron || '—'}</td>
        <td class="td-mono">€ ${(parseFloat(i.bedrag) || 0).toLocaleString('nl-BE', { minimumFractionDigits: 2 })}</td>
        <td><button type="button" class="btn btn-ghost" style="font-size:11px;padding:4px 8px" onclick="openFinInkomenModal('${i.id}')">Bewerk</button>
            <button type="button" class="btn btn-ghost" style="font-size:11px;padding:4px 8px;color:var(--red)" onclick="delFinInkomen('${i.id}')">✕</button></td>
      </tr>`).join('') : `<tr><td colspan="5"><div class="empty"><div class="empty-icon">€</div><div class="empty-text">Geen inkomsten in ${jaar}</div></div></td></tr>`;
  }

  const catBody = document.getElementById('fin-cat-tbody');
  if (catBody) {
    catBody.innerHTML = Object.keys(FIN_CATEGORY_META).map((key) => {
      const m = FIN_CATEGORY_META[key];
      const p = m.aftrekPct == null ? 'Variabel' : `${m.aftrekPct}% (indicatief)`;
      const r = m.risico === 'hoog' ? 'badge-red' : m.risico === 'midden' ? 'badge-amber' : 'badge-green';
      return `<tr>
        <td>${m.label}</td>
        <td>${m.groep}</td>
        <td class="td-mono">${p}</td>
        <td><span class="badge ${r}">${m.risico}</span></td>
        <td style="font-size:12px;color:var(--text2);max-width:280px">${m.hint}</td>
      </tr>`;
    }).join('');
  }
}

function setFinJaar(y) {
  finJaar = parseInt(y, 10) || new Date().getFullYear();
  renderFinancieel();
}

function showFinTab(which, btn) {
  document.querySelectorAll('.fin-tab-panel').forEach((p) => p.classList.remove('active'));
  const panel = document.getElementById('fin-panel-' + which);
  if (panel) panel.classList.add('active');
  const wrap = document.getElementById('fin-subtabs');
  if (wrap) wrap.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

function openFinKeuzeModal() {
  const el = document.getElementById('modal-fin-keuze');
  if (el) el.classList.add('open');
}

function finKiesUitgave() {
  closeModal('modal-fin-keuze');
  openFinUitgaveModal(null);
}

function finKiesInkomen() {
  closeModal('modal-fin-keuze');
  openFinInkomenModal(null);
}

function openFinUitgaveModal(id) {
  finEditUitgaveId = id || null;
  clearForm('modal-fin-uitgave');
  const elOv = document.getElementById('fu-aftrek-override');
  if (elOv) elOv.value = '';
  if (id) {
    const u = (db.uitgaven || []).find((x) => x.id === id);
    if (u) {
      set('fu-omschrijving', u.omschrijving || '');
      set('fu-bedrag', u.bedrag != null ? String(u.bedrag) : '');
      set('fu-datum', u.datum || today());
      set('fu-categorie', u.categorie || 'overig');
      if (u.aftrekOverride != null && u.aftrekOverride !== '') {
        if (elOv) elOv.value = String(u.aftrekOverride);
      }
      set('fu-note', u.note || '');
      const bew = document.getElementById('fu-bewijs');
      if (bew) bew.checked = !!u.bewijs;
    }
  } else {
    set('fu-datum', today());
    set('fu-categorie', 'informatica');
    const bew = document.getElementById('fu-bewijs');
    if (bew) bew.checked = false;
  }
  updateFinUitgaveCategoryHint();
  document.getElementById('modal-fin-uitgave').classList.add('open');
}

function updateFinUitgaveCategoryHint() {
  const m = finMeta(v('fu-categorie'));
  const hint = document.getElementById('fu-cat-hint');
  if (hint) {
    hint.innerHTML = `<strong>${m.label}</strong><br><span style="color:var(--text2)">${m.hint}</span><br>
      <span style="font-size:11px;color:var(--text3)">Indicatief aftrekbaar: ${m.aftrekPct == null ? 'variabel — vul eventueel eigen % hieronder' : m.aftrekPct + '% van het bedrag (tenzij je een eigen % invult)'}</span>`;
  }
}

function saveFinUitgave() {
  const omschrijving = v('fu-omschrijving').trim();
  const bedrag = parseFloat(v('fu-bedrag'));
  const datum = v('fu-datum');
  if (!omschrijving || !datum || Number.isNaN(bedrag) || bedrag < 0) {
    toast('❌ Vul omschrijving, geldig bedrag en datum in');
    return;
  }
  const categorie = v('fu-categorie') || 'overig';
  const meta = finMeta(categorie);
  const ovRaw = v('fu-aftrek-override').trim();
  const aftrekOverride = ovRaw === '' ? null : Math.max(0, Math.min(100, parseFloat(ovRaw)));

  if (meta.risico === 'hoog' && bedrag >= 200) {
    window.alert(
      'Risico-alert (indicatief)\n\n' +
      `Deze categorie (“${meta.label}”) wordt vaak streng gecontroleerd in België.\n` +
      `Bedrag: €${bedrag.toLocaleString('nl-BE')}.\n\n` +
      'Zorg voor bewijsstukken en laat twijfelgevallen nakijken door je accountant of op beroepskosten.be.\n\n' +
      'Dit programma geeft geen fiscaal advies.'
    );
  } else if (meta.risico === 'midden' && bedrag >= 1500) {
    window.alert(
      'Let op (indicatief)\n\n' +
      'Dit is een forse uitgave in een categorie met middelmatige complexiteit (bewijs / verdeelsleutel).\n' +
      'Documenteer zakelijk gebruik en bewaar facturen.'
    );
  }

  const obj = {
    id: finEditUitgaveId || uid(),
    omschrijving,
    bedrag,
    datum,
    categorie,
    aftrekOverride: aftrekOverride != null && !Number.isNaN(aftrekOverride) ? aftrekOverride : null,
    note: v('fu-note'),
    bewijs: !!(document.getElementById('fu-bewijs') || {}).checked
  };
  upsert('uitgaven', obj);
  finEditUitgaveId = null;
  closeModal('modal-fin-uitgave');
  renderFinancieel();
  toast(meta.risico === 'hoog' ? '✓ Opgeslagen — controleer fiscale haalbaarheid' : '✓ Uitgave opgeslagen');
}

function openFinInkomenModal(id) {
  finEditInkomenId = id || null;
  clearForm('modal-fin-inkomen');
  if (id) {
    const x = (db.inkomsten || []).find((i) => i.id === id);
    if (x) {
      set('fi-omschrijving', x.omschrijving || '');
      set('fi-bedrag', x.bedrag != null ? String(x.bedrag) : '');
      set('fi-datum', x.datum || today());
      set('fi-bron', x.bron || '');
      set('fi-note', x.note || '');
    }
  } else {
    set('fi-datum', today());
  }
  document.getElementById('modal-fin-inkomen').classList.add('open');
}

function saveFinInkomen() {
  const omschrijving = v('fi-omschrijving').trim();
  const bedrag = parseFloat(v('fi-bedrag'));
  const datum = v('fi-datum');
  if (!omschrijving || !datum || Number.isNaN(bedrag) || bedrag < 0) {
    toast('❌ Vul omschrijving, geldig bedrag en datum in');
    return;
  }
  const obj = {
    id: finEditInkomenId || uid(),
    omschrijving,
    bedrag,
    datum,
    bron: v('fi-bron'),
    note: v('fi-note')
  };
  upsert('inkomsten', obj);
  finEditInkomenId = null;
  closeModal('modal-fin-inkomen');
  renderFinancieel();
  toast('✓ Inkomen opgeslagen');
}

async function delFinUitgave(id) {
  if (!(await openArchConfirmModal('Uitgave verwijderen?'))) return;
  db.uitgaven = (db.uitgaven || []).filter((u) => u.id !== id);
  save();
  renderFinancieel();
  toast('Verwijderd');
}

async function delFinInkomen(id) {
  if (!(await openArchConfirmModal('Inkomen verwijderen?'))) return;
  db.inkomsten = (db.inkomsten || []).filter((i) => i.id !== id);
  save();
  renderFinancieel();
  toast('Verwijderd');
}

// ─── EXPORT / IMPORT ─────────────────────────────────────────────────────────
function exportData() {
  if (!requireAdmin()) return;
  const hohohAdmin = {
    password: (() => { try { return localStorage.getItem(ADMIN_PASSWORD_KEY); } catch { return null; } })(),
    createdAt: (() => { try { return localStorage.getItem('hohoh_admin_created_at'); } catch { return null; } })(),
  };
  const payload = {
    version: 1,
    product: 'Orion',
    vendor: 'HohoSolutions',
    exportedAt: new Date().toISOString(),
    db,
    hohohAdmin,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'orion-export-' + today() + '.json';
  a.click();
  toast('✓ Export gedownload');
}

function importClick() { document.getElementById('import-input').click(); }

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);

      const incomingDb = (data && data.db && typeof data.db === 'object') ? data.db : data;

      if (incomingDb && (incomingDb.klanten || incomingDb.projecten || incomingDb.uitgaven || incomingDb.inkomsten)) {
        // Admin mee importeren (zodat export/import ook op iPhone werkt).
        if (data && data.hohohAdmin && typeof data.hohohAdmin.password === 'string') {
          try {
            localStorage.setItem(ADMIN_PASSWORD_KEY, data.hohohAdmin.password);
            localStorage.setItem(ADMIN_AUTH_KEY, '1');
            if (data.hohohAdmin.createdAt) localStorage.setItem('hohoh_admin_created_at', data.hohohAdmin.createdAt);
          } catch {}
        }

        db = incomingDb;
        normalizeDbShape();
        syncInvoiceDbRef();
        save(); render();
        toast('✓ Data geïmporteerd');
      } else { toast('❌ Ongeldig bestand'); }
    } catch { toast('❌ Fout bij importeren'); }
  };
  r.readAsText(file);
  e.target.value = '';
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

// ─── TIJDLIJN / GANTT ────────────────────────────────────────────────────────
function renderTijdlijn() {
  const zoom = parseInt(document.getElementById('gantt-zoom')?.value || 12);
  const filterKlant = document.getElementById('gantt-klant')?.value || '';
  const filterStatus = document.getElementById('gantt-status')?.value || '';

  // Populate klant filter
  const gk = document.getElementById('gantt-klant');
  if (gk) {
    const cur = gk.value;
    gk.innerHTML = '<option value="">Alle klanten</option>' + db.klanten.map(k =>
      `<option value="${k.id}"${k.id===cur?' selected':''}>${k.voornaam} ${k.achternaam}</option>`
    ).join('');
  }

  const now = new Date();
  // Start = first of current month, shifted back 1 month for context
  const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + zoom, 0);
  const totalMs = endDate - startDate;

  // Build month headers
  const months = [];
  let d = new Date(startDate);
  while (d <= endDate) {
    months.push(new Date(d));
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  }

  const MONTH_NAMES = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];

  let projects = db.projecten.filter(p => p.start || p.deadline);
  if (filterKlant) projects = projects.filter(p => p.klantId === filterKlant);
  if (filterStatus) projects = projects.filter(p => p.status === filterStatus);

  if (!projects.length) {
    document.getElementById('gantt-container').innerHTML =
      `<div class="empty"><div class="empty-icon">▬</div><div class="empty-text">Geen projecten met datums</div><div class="empty-sub">Voeg start- en einddata toe aan je projecten</div></div>`;
    return;
  }

  // Today marker position
  const todayPct = Math.max(0, Math.min(100, ((now - startDate) / totalMs) * 100));

  let html = `<div style="position:relative">`;

  // Header
  html += `<div class="gantt-header">
    <div class="gantt-label-col">Project</div>
    <div class="gantt-months">`;
  months.forEach(m => {
    const isCur = m.getMonth() === now.getMonth() && m.getFullYear() === now.getFullYear();
    html += `<div class="gantt-month${isCur?' current':''}">${MONTH_NAMES[m.getMonth()]} '${String(m.getFullYear()).slice(2)}</div>`;
  });
  html += `</div></div>`;

  // Rows
  projects.forEach(p => {
    const k = db.klanten.find(k => k.id === p.klantId);
    const pStart = p.start ? new Date(p.start + 'T00:00:00') : new Date(now.getFullYear(), now.getMonth(), 1);
    const pEnd = p.deadline ? new Date(p.deadline + 'T00:00:00') : new Date(pStart.getFullYear(), pStart.getMonth() + 1, 0);

    const left = Math.max(0, ((pStart - startDate) / totalMs) * 100);
    const right = Math.min(100, ((pEnd - startDate) / totalMs) * 100);
    const width = Math.max(0.5, right - left);

    html += `<div class="gantt-row" onclick="openProjectDetail('${p.id}')">
      <div class="gantt-row-label">
        <div class="rl-name">${p.naam}</div>
        <div class="rl-sub">${k ? k.voornaam + ' ' + k.achternaam : '—'}</div>
      </div>
      <div class="gantt-track">
        <div class="gantt-today" style="left:${todayPct}%"></div>
        <div class="gantt-bar ${p.status}" style="left:${left}%;width:${width}%;max-width:${width}%"
          title="${p.naam} · ${fmt(p.start)} → ${fmt(p.deadline)}">
          ${width > 6 ? p.naam : ''}
        </div>
      </div>
    </div>`;
  });

  html += `</div>`;
  document.getElementById('gantt-container').innerHTML = html;
}

// ─── FACTUUR LIJNEN ──────────────────────────────────────────────────────────
let facLines = [];
let facAttachments = [];

function openFacModal() {
  populateKlantSelects();
  populateFactuurProjectSelect();
  const editing = editId && db.facturen.some((f) => f.id === editId);
  if (editing) {
    const f = db.facturen.find((x) => x.id === editId);
    set('f-type', f.type || 'factuur');
    set('f-num', f.num || '');
    set('f-klant', f.klantId || '');
    populateFactuurProjectSelect();
    set('f-project', f.projectId || '');
    set('f-desc', f.desc || '');
    set('f-btw', String(f.btwPct != null ? f.btwPct : 21));
    set('f-datum', f.datum || today());
    set('f-termijn', f.termijn != null && f.termijn !== '' ? String(f.termijn) : '30');
    set('f-verval', f.verval || '');
    set('f-status', f.status || 'concept');
    set('f-ref', f.ref || '');
    set('f-betaalwijze', f.betaalwijze || 'overschrijving');
    set('f-note', f.note || '');
    const vp = document.getElementById('f-voorschot-pct');
    if (vp) vp.value = f.voorschotPct != null ? f.voorschotPct : 30;
    set('f-voorschot-type', f.voorschotType || 'algemeen');
    facLines = (f.lines && f.lines.length) ? f.lines.map((l) => ({ ...l })) : [{ omschrijving: '', aantal: 1, prijs: 0, subtotaal: 0 }];
    facAttachments = Array.isArray(f.attachments) ? f.attachments.map((a) => ({ ...a })) : [];
    const title = document.getElementById('modal-factuur-title');
    if (title) title.textContent = f.num ? `Bewerken · ${f.num}` : 'Factuur bewerken';
  } else {
    facLines = [{ omschrijving: '', aantal: 1, prijs: 0, subtotaal: 0 }];
    facAttachments = [];
    const d = document.getElementById('f-datum');
    if (d && !d.value) d.value = today();
    const title = document.getElementById('modal-factuur-title');
    if (title) title.textContent = 'Nieuwe factuur';
  }
  renderFacLines();
  renderFacAttachments();
  updateFacTotals();
  updateFactuurType();
  calcVervaldag();
}

function nextFactuurNummer() {
  const year = new Date().getFullYear();
  let maxSeq = 0;
  db.facturen.forEach(f => {
    const n = (f.num || '').trim();
    const m = n.match(/^(\d{4})[-/](\d{1,6})$/);
    if (!m) return;
    if (parseInt(m[1], 10) !== year) return;
    const seq = parseInt(m[2], 10) || 0;
    if (seq > maxSeq) maxSeq = seq;
  });
  return `${year}-${String(maxSeq + 1).padStart(3, '0')}`;
}

function suggestProjectForKlant(klantId) {
  if (!klantId) return null;
  const projects = db.projecten.filter(p => p.klantId === klantId);
  if (!projects.length) return null;
  const active = projects.find(p => p.status === 'actief');
  return active || projects[0];
}

function suggestFactuurLijn(project, type) {
  if (!project) {
    return {
      omschrijving: type === 'voorschot'
        ? `Voorschot ${new Date().toLocaleDateString('nl-BE', { month: 'long', year: 'numeric' })}`
        : `Diensten ${new Date().toLocaleDateString('nl-BE', { month: 'long', year: 'numeric' })}`,
      aantal: 1,
      prijs: 0,
      subtotaal: 0
    };
  }
  const budget = parseFloat(project.budget) || 0;
  const billed = db.facturen
    .filter(f => f.projectId === project.id && f.type !== 'creditnota')
    .reduce((s, f) => s + (f.excl || 0), 0);
  const remaining = Math.max(0, budget - billed);
  let price = 0;
  if (type === 'voorschot') {
    price = remaining > 0 ? (remaining * 0.3) : (budget > 0 ? budget * 0.3 : 0);
  } else {
    price = remaining > 0 ? remaining : (budget > 0 ? budget * 0.2 : 0);
  }
  return {
    omschrijving: type === 'voorschot'
      ? `Voorschot ${project.naam}`
      : `Diensten ${project.naam}`,
    aantal: 1,
    prijs: Math.round(price * 100) / 100,
    subtotaal: Math.round(price * 100) / 100
  };
}

function startFactuurOpstellen(type = 'factuur') {
  editId = null;
  openModal('modal-factuur');

  const klantFilter = (document.getElementById('fac-klant-filter') || {}).value || '';
  if (klantFilter) set('f-klant', klantFilter);
  populateFactuurProjectSelect();
  const project = suggestProjectForKlant(klantFilter);
  if (project) set('f-project', project.id);

  set('f-type', type);
  set('f-status', 'concept');
  set('f-num', nextFactuurNummer());
  set('f-datum', today());
  set('f-termijn', '30');
  set('f-desc', type === 'voorschot'
    ? `Voorschot ${project ? project.naam : ''}`.trim()
    : `Factuur ${project ? project.naam : ''}`.trim());

  facLines = [suggestFactuurLijn(project, type)];
  renderFacLines();
  facAttachments = suggestDefaultFacAttachments();
  renderFacAttachments();
  updateFactuurType();
  calcVervaldag();
  updateFacTotals();
}

function addFacLine() {
  facLines.push({ omschrijving: '', aantal: 1, prijs: 0, subtotaal: 0 });
  renderFacLines();
  updateFacTotals();
}

function removeFacLine(i) {
  facLines.splice(i, 1);
  renderFacLines();
  updateFacTotals();
}

function renderFacLines() {
  document.getElementById('fac-lines').innerHTML = facLines.map((l, i) => `
    <div class="fac-line">
      <input value="${l.omschrijving}" placeholder="Omschrijving dienst..." oninput="facLines[${i}].omschrijving=this.value">
      <input type="number" value="${l.aantal}" min="0.01" step="0.01" style="text-align:right" oninput="facLines[${i}].aantal=parseFloat(this.value)||0;updateFacLine(${i})">
      <input type="number" value="${l.prijs}" min="0" step="0.01" style="text-align:right" placeholder="0.00" oninput="facLines[${i}].prijs=parseFloat(this.value)||0;updateFacLine(${i})">
      <div class="line-sub" id="line-sub-${i}">€ ${(l.subtotaal||0).toLocaleString('nl-BE',{minimumFractionDigits:2})}</div>
      <button onclick="removeFacLine(${i})">✕</button>
    </div>`).join('');
}

function updateFacLine(i) {
  facLines[i].subtotaal = (facLines[i].aantal||0) * (facLines[i].prijs||0);
  const el = document.getElementById('line-sub-' + i);
  if (el) el.textContent = '€ ' + facLines[i].subtotaal.toLocaleString('nl-BE', {minimumFractionDigits:2});
  updateFacTotals();
}

function updateFacTotals() {
  const excl = facLines.reduce((s,l) => s + (l.subtotaal||0), 0);
  const btwPct = parseFloat((document.getElementById('f-btw')||{}).value) || 0;
  const btwB = excl * btwPct / 100;
  const tot = excl + btwB;
  const fmt2 = n => '€ ' + n.toLocaleString('nl-BE', {minimumFractionDigits:2});
  const setT = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  setT('f-sub-display', fmt2(excl));
  setT('f-btw-display', fmt2(btwB));
  setT('f-tot-display', fmt2(tot));
  const pct = parseFloat((document.getElementById('f-voorschot-pct')||{}).value) || 30;
  setT('f-voorschot-display', fmt2(tot * pct / 100));
}

function getFacLines() {
  return facLines.map(l => ({...l, subtotaal: (l.aantal||0)*(l.prijs||0)}));
}

function suggestDefaultFacAttachments() {
  const klantId = v('f-klant');
  const projectId = v('f-project');
  const num = v('f-num');
  const docType = v('f-type') || 'factuur';
  const k = db.klanten.find((x) => x.id === klantId);
  const p = db.projecten.find((x) => x.id === projectId);
  const typeLabels = { factuur:'Factuur', voorschot:'Voorschot', creditnota:'Creditnota', offerte:'Offerte', 'pro-forma':'Pro-forma' };
  const tl = typeLabels[docType] || 'Document';
  const subj = p ? p.naam : (k ? (k.bedrijf || `${k.voornaam || ''} ${k.achternaam || ''}`.trim()) : 'Document');
  const items = [];
  if (p && (p.githubUrl || p.githubRepo)) {
    const gh = p.githubUrl || (p.githubRepo ? `https://github.com/${normalizeGithubRepo(p.githubRepo)}` : '');
    if (gh) items.push({ naam: `Repository — ${p.naam}`, url: gh, type: 'github', note: 'Projectrepository', datum: today() });
  }
  const web = (p && p.website) || (k && k.website) || '';
  items.push({
    naam: `${tl} ${num || 'concept'} — ${subj}`.trim(),
    url: web,
    type: web ? 'link' : 'pdf',
    note: 'PDF- of Drive-link na upload',
    datum: today()
  });
  return items;
}

function renderFacAttachments() {
  const el = document.getElementById('fac-attachments-list');
  if (!el) return;
  const typeOpts = [
    { v: 'pdf', label: 'PDF' }, { v: 'figma', label: 'Figma' }, { v: 'github', label: 'GitHub' },
    { v: 'drive', label: 'Drive' }, { v: 'notion', label: 'Notion' }, { v: 'link', label: 'Link' }, { v: 'other', label: 'Overig' }
  ];
  el.innerHTML = facAttachments.length ? facAttachments.map((b, i) => `
    <div style="margin-bottom:10px">
      <div class="fac-line" style="display:grid;grid-template-columns:1fr 1fr 100px 32px;gap:6px;align-items:center">
        <input value="${escapeArchAttr(b.naam)}" placeholder="Naam" oninput="facAttachments[${i}].naam=this.value">
        <input value="${escapeArchAttr(b.url || '')}" placeholder="URL" oninput="facAttachments[${i}].url=this.value">
        <select onchange="facAttachments[${i}].type=this.value" style="padding:6px 8px;font-size:12px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text)">
          ${typeOpts.map((o) => `<option value="${o.v}"${(b.type || 'link') === o.v ? ' selected' : ''}>${o.label}</option>`).join('')}
        </select>
        <button type="button" onclick="removeFacAttachment(${i})" title="Verwijder">✕</button>
      </div>
      <input value="${escapeArchAttr(b.note || '')}" placeholder="Notitie (optioneel)" oninput="facAttachments[${i}].note=this.value"
        style="width:100%;margin-top:6px;padding:6px 10px;font-size:12px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text)">
    </div>`).join('') :
    '<div style="color:var(--text3);font-size:12px">Geen bijlagen — gebruik + of Slim invullen</div>';
}

async function addFacAttachmentPrompt() {
  const d = suggestDefaultFacAttachments();
  const first = d[0] || { naam: '', url: '', type: 'link', note: '', datum: today() };
  const data = await openArchInputModal('Bijlage / link', [
    { id: 'naam', label: 'Naam', value: first.naam },
    { id: 'url', label: 'URL', value: first.url || '', placeholder: 'https://…' },
    { id: 'type', label: 'Type', type: 'select', value: first.type || 'link', options: [
      { v: 'pdf', label: 'PDF' }, { v: 'figma', label: 'Figma' }, { v: 'github', label: 'GitHub' },
      { v: 'drive', label: 'Drive' }, { v: 'notion', label: 'Notion' }, { v: 'link', label: 'Link' }, { v: 'other', label: 'Overig' }
    ] },
    { id: 'note', label: 'Notitie (optioneel)', value: first.note || '' }
  ]);
  if (!data || !data.naam || !data.naam.trim()) return;
  facAttachments.push({
    naam: data.naam.trim(),
    url: (data.url || '').trim(),
    type: (data.type || 'link').trim() || 'link',
    note: (data.note || '').trim(),
    datum: today()
  });
  renderFacAttachments();
}

function addDefaultFacAttachments() {
  suggestDefaultFacAttachments().forEach((x) => {
    const dup = facAttachments.some((e) => e.naam === x.naam && (e.url || '') === (x.url || ''));
    if (!dup) facAttachments.push({ ...x });
  });
  renderFacAttachments();
}

function removeFacAttachment(i) {
  facAttachments.splice(i, 1);
  renderFacAttachments();
}

function editFactuur(id) {
  if (!db.facturen.find((f) => f.id === id)) return;
  editId = id;
  closeDetail();
  openModal('modal-factuur');
}

function updateFactuurType() {
  const t = v('f-type');
  const vRow = document.getElementById('f-voorschot-row');
  const vtRow = document.getElementById('f-voorschot-type-row');
  if (vRow) vRow.style.display = t === 'voorschot' ? 'flex' : 'none';
  if (vtRow) vtRow.style.display = t === 'voorschot' ? 'flex' : 'none';
  const title = document.getElementById('modal-factuur-title');
  if (!title) return;
  if (editId && db.facturen.some((f) => f.id === editId)) {
    const f = db.facturen.find((x) => x.id === editId);
    title.textContent = f && f.num ? `Bewerken · ${f.num}` : 'Factuur bewerken';
    return;
  }
  const labels = { factuur:'Nieuwe factuur', voorschot:'Nieuwe voorschotfactuur', creditnota:'Nieuwe creditnota', offerte:'Nieuw offerte', 'pro-forma':'Pro-forma factuur' };
  title.textContent = labels[t] || 'Nieuw document';
}

function calcVervaldag() {
  const datum = v('f-datum');
  const termijn = v('f-termijn');
  if (!datum || termijn === 'custom') return;
  const d = new Date(datum + 'T00:00:00');
  d.setDate(d.getDate() + parseInt(termijn));
  const el = document.getElementById('f-verval');
  if (el) el.value = d.toISOString().slice(0,10);
}

// ─── ROADMAP ─────────────────────────────────────────────────────────────────
function renderRoadmap() {
  const sel = document.getElementById('rm-project-select');
  if (!sel) return;

  // Populate project dropdown
  const cur = sel.value;
  sel.innerHTML = '<option value="">— Kies een project —</option>' + db.projecten.map(p =>
    `<option value="${p.id}"${p.id===cur?' selected':''}>${p.naam}${db.klanten.find(k=>k.id===p.klantId)?' — '+db.klanten.find(k=>k.id===p.klantId).voornaam+' '+db.klanten.find(k=>k.id===p.klantId).achternaam:''}</option>`
  ).join('');

  const pid = sel.value;
  const addBtn = document.getElementById('rm-add-milestone-btn');
  const body = document.getElementById('roadmap-body');

  if (!pid) {
    if (addBtn) addBtn.style.display = 'none';
    body.innerHTML = `<div class="empty"><div class="empty-icon">◉</div><div class="empty-text">Selecteer een project</div></div>`;
    return;
  }

  if (addBtn) addBtn.style.display = '';

  // Ensure roadmap structure exists
  if (!db.roadmaps) db.roadmaps = {};
  if (!db.roadmaps[pid]) db.roadmaps[pid] = [];

  const milestones = db.roadmaps[pid];

  if (!milestones.length) {
    body.innerHTML = `<div class="empty"><div class="empty-icon">◉</div><div class="empty-text">Nog geen mijlpalen</div><div class="empty-sub">Klik op + Mijlpaal om te beginnen</div></div>`;
    return;
  }

  body.innerHTML = milestones.map((ms, mi) => {
    const done = ms.items ? ms.items.filter(i=>i.done).length : 0;
    const total = ms.items ? ms.items.length : 0;
    const pct = total ? Math.round((done/total)*100) : 0;
    const isOpen = ms._open !== false;

    return `<div class="milestone-card" id="ms-card-${mi}">
      <div class="milestone-head" onclick="toggleMilestone(${mi})">
        <div class="milestone-dot ${ms.status||'open'}"></div>
        <div class="milestone-title">${ms.naam}</div>
        ${ms.datum ? `<div class="milestone-meta">📅 ${fmt(ms.datum)}</div>` : ''}
        <div class="ms-progress">
          <div class="ms-bar"><div class="ms-fill" style="width:${pct}%"></div></div>
          <span>${done}/${total}</span>
        </div>
        <select class="gantt-select" style="padding:3px 6px;font-size:11px;margin-left:4px" onclick="event.stopPropagation()" onchange="changeMsStatus(${mi},this.value)">
          <option value="open"${(ms.status||'open')==='open'?' selected':''}>Open</option>
          <option value="done"${ms.status==='done'?' selected':''}>Voltooid</option>
          <option value="blocked"${ms.status==='blocked'?' selected':''}>Geblokkeerd</option>
        </select>
        <button class="btn btn-ghost" style="padding:3px 8px;font-size:11px" onclick="event.stopPropagation();delMilestone(${mi})">✕</button>
        <div class="milestone-toggle ${isOpen?'open':''}">▶</div>
      </div>
      ${isOpen ? `<div class="milestone-items">
        ${ms.desc ? `<div style="font-size:12px;color:var(--text2);padding:8px 0;border-bottom:1px solid var(--border);line-height:1.5">${ms.desc}</div>` : ''}
        ${(ms.items||[]).map((item, ii) => `
          <div class="rm-item">
            <div class="rm-check ${item.done?'done':''}" onclick="toggleRmItem(${mi},${ii})"></div>
            <div class="rm-content">
              <div class="rm-name ${item.done?'done-text':''}">${item.naam}</div>
              ${item.desc ? `<div class="rm-desc">${item.desc}</div>` : ''}
              <div class="rm-foot">
                ${item.prio ? statusBadge(item.prio) : ''}
                ${item.datum ? `<span class="badge badge-gray td-mono">📅 ${fmt(item.datum)}</span>` : ''}
              </div>
            </div>
            <div class="rm-actions">
              <button class="btn btn-ghost" style="padding:3px 8px;font-size:11px" onclick="delRmItem(${mi},${ii})">✕</button>
            </div>
          </div>`).join('')}
        <div class="add-item-row">
          <input placeholder="+ Nieuwe deliverable toevoegen..." id="new-item-${mi}"
            onkeydown="if(event.key==='Enter')addRmItem(${mi})"
            style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:7px 10px;font-size:13px;color:var(--text);font-family:'Plus Jakarta Sans',sans-serif;outline:none">
          <input placeholder="Deadline (optioneel)" type="date" id="new-item-date-${mi}"
            style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:7px 10px;font-size:12px;color:var(--text);font-family:'Plus Jakarta Sans',sans-serif;outline:none;width:160px">
          <select id="new-item-prio-${mi}" style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:7px 8px;font-size:12px;color:var(--text);font-family:'Plus Jakarta Sans',sans-serif;outline:none">
            <option value="">Prio</option>
            <option value="hoog">Hoog</option>
            <option value="normaal">Normaal</option>
            <option value="laag">Laag</option>
          </select>
          <button class="btn btn-primary" onclick="addRmItem(${mi})">Toevoegen</button>
        </div>
      </div>` : ''}
    </div>`;
  }).join('');
}

async function addMilestone() {
  const pid = document.getElementById('rm-project-select').value;
  if (!pid) return;
  if (!db.roadmaps) db.roadmaps = {};
  if (!db.roadmaps[pid]) db.roadmaps[pid] = [];

  const data = await openArchInputModal('Nieuwe mijlpaal', [
    { id: 'naam', label: 'Naam', placeholder: 'Mijlpaal' },
    { id: 'datum', label: 'Deadline (optioneel)', type: 'date' },
    { id: 'desc', label: 'Beschrijving (optioneel)', placeholder: '' }
  ]);
  if (!data || !data.naam || !data.naam.trim()) return;
  const naam = data.naam.trim();
  const datum = (data.datum || '').trim();
  const desc = (data.desc || '').trim();

  db.roadmaps[pid].push({ naam, datum, desc, status: 'open', items: [], _open: true });
  save();
  renderRoadmap();
  toast('✓ Mijlpaal toegevoegd');
}

async function delMilestone(mi) {
  const pid = document.getElementById('rm-project-select').value;
  if (!(await openArchConfirmModal('Mijlpaal verwijderen?'))) return;
  db.roadmaps[pid].splice(mi, 1);
  save(); renderRoadmap();
}

function toggleMilestone(mi) {
  const pid = document.getElementById('rm-project-select').value;
  const ms = db.roadmaps[pid][mi];
  ms._open = ms._open === false ? true : false;
  save(); renderRoadmap();
}

function changeMsStatus(mi, val) {
  const pid = document.getElementById('rm-project-select').value;
  db.roadmaps[pid][mi].status = val;
  save(); renderRoadmap();
}

function addRmItem(mi) {
  const pid = document.getElementById('rm-project-select').value;
  const naam = (document.getElementById('new-item-' + mi)||{}).value;
  if (!naam || !naam.trim()) return;
  const datum = (document.getElementById('new-item-date-' + mi)||{}).value || '';
  const prio = (document.getElementById('new-item-prio-' + mi)||{}).value || '';
  db.roadmaps[pid][mi].items.push({ naam: naam.trim(), datum, prio, done: false });
  save(); renderRoadmap();
}

function toggleRmItem(mi, ii) {
  const pid = document.getElementById('rm-project-select').value;
  const item = db.roadmaps[pid][mi].items[ii];
  item.done = !item.done;
  // Auto-update milestone status
  const ms = db.roadmaps[pid][mi];
  if (ms.items.every(i=>i.done) && ms.items.length) ms.status = 'done';
  else if (ms.status === 'done') ms.status = 'open';
  save(); renderRoadmap();
}

function delRmItem(mi, ii) {
  const pid = document.getElementById('rm-project-select').value;
  db.roadmaps[pid][mi].items.splice(ii, 1);
  save(); renderRoadmap();
}

// ══════════════════════════════════════════════════════════════════════════════
// TO-DO LIJSTEN
// ══════════════════════════════════════════════════════════════════════════════
let activeTodoListId = null;
const LIST_COLORS = ['#7c6af7','#3ecf8e','#f0a500','#4a9eff','#f05050','#ed93b1','#97c459','#5dcaa5'];

function addTodoList() {
  const naam = prompt('Naam van de lijst:'); if (!naam) return;
  const color = LIST_COLORS[db.todoLists.length % LIST_COLORS.length];
  const list = { id: uid(), naam, color, items: [], datum: today() };
  db.todoLists.push(list);
  save();
  renderTodoPage();
  openTodoList(list.id);
  toast('✓ Lijst aangemaakt');
}

function renderTodoPage() {
  const sidebar = document.getElementById('todo-lists-sidebar');
  if (!sidebar) return;
  sidebar.innerHTML = db.todoLists.length ? db.todoLists.map(l => {
    const open = (l.items||[]).filter(i=>!i.done).length;
    const total = (l.items||[]).length;
    return `<div class="todo-list-item ${l.id===activeTodoListId?'active':''}" onclick="openTodoList('${l.id}')">
      <div class="todo-list-color" style="background:${l.color}"></div>
      <div class="todo-list-name">${l.naam}</div>
      <span class="todo-list-count">${open}/${total}</span>
    </div>`;
  }).join('') : `<div style="padding:20px;color:var(--text3);font-size:13px;text-align:center">Nog geen lijsten</div>`;

  if (activeTodoListId) renderTodoMain(activeTodoListId);
  updateBadges();
}

function openTodoList(id) {
  activeTodoListId = id;
  renderTodoPage();
  renderTodoMain(id);
}

function renderTodoMain(id) {
  const list = db.todoLists.find(l=>l.id===id);
  if (!list) return;
  const items = list.items || [];
  const done = items.filter(i=>i.done);
  const open = items.filter(i=>!i.done);
  const pct = items.length ? Math.round((done.length/items.length)*100) : 0;

  const container = document.getElementById('todo-main-content');
  if (!container) return;

  container.innerHTML = `
    <div class="todo-main-head">
      <div class="todo-list-color" style="background:${list.color};width:14px;height:14px;border-radius:50%"></div>
      <div class="todo-main-title" contenteditable="true" onblur="renameTodoList('${id}',this.textContent)">${list.naam}</div>
      <div style="display:flex;gap:6px">
        <select class="gantt-select" style="font-size:12px" onchange="sortTodoItems('${id}',this.value)">
          <option value="default">Volgorde</option>
          <option value="prio">Prioriteit</option>
          <option value="datum">Deadline</option>
          <option value="alfa">Alfabetisch</option>
        </select>
        <button class="btn btn-ghost" style="font-size:12px;padding:5px 10px" onclick="deleteTodoList('${id}')">🗑</button>
      </div>
    </div>

    <div class="todo-progress-bar-wrap">
      <div class="todo-count-label">
        <span>${open.length} open · ${done.length} voltooid</span>
        <span>${pct}%</span>
      </div>
      <div class="todo-progress-track"><div class="todo-progress-fill" style="width:${pct}%;background:${list.color}"></div></div>
    </div>

    <div class="todo-input-row">
      <input class="todo-add-input" id="todo-add-input-${id}" placeholder="Taak toevoegen... (Enter om op te slaan)"
        onkeydown="if(event.key==='Enter')addTodoItem('${id}')">
      <select id="todo-add-prio-${id}" class="gantt-select" style="font-size:12px">
        <option value="normaal">Normaal</option>
        <option value="hoog">Hoog</option>
        <option value="laag">Laag</option>
      </select>
      <input type="date" id="todo-add-date-${id}" class="gantt-select" style="font-size:12px;padding:6px 8px">
      <button class="btn btn-primary" onclick="addTodoItem('${id}')">+ Toevoegen</button>
    </div>

    <div class="todo-items" id="todo-items-${id}">
      ${renderTodoItems(id, open, done)}
    </div>`;
}

function renderTodoItems(id, open, done) {
  const prioOrder = { hoog: 0, normaal: 1, laag: 2 };
  const prioColor = { hoog: 'var(--red)', normaal: 'var(--text3)', laag: 'var(--blue)' };
  const prioIcon = { hoog: '🔴', normaal: '⚪', laag: '🔵' };

  const itemHtml = (item, idx, realIdx) => `
    <div class="todo-item" id="todo-item-${realIdx}">
      <div class="todo-check-box ${item.done?'checked':''}" onclick="toggleTodoItem('${id}',${realIdx})"></div>
      <div class="todo-item-body">
        <div class="todo-item-text ${item.done?'done':''}" contenteditable="${!item.done}" 
          onblur="editTodoItemText('${id}',${realIdx},this.textContent)">${item.text}</div>
        ${item.note?`<div class="todo-item-note">${item.note}</div>`:''}
        <div class="todo-item-meta">
          ${item.prio&&item.prio!=='normaal'?`<span class="badge badge-${item.prio==='hoog'?'red':'blue'}" style="font-size:10px">${prioIcon[item.prio]} ${item.prio}</span>`:''}
          ${item.datum?`<span class="badge badge-gray td-mono" style="font-size:10px">📅 ${fmt(item.datum)}</span>`:''}
          ${item.klantId?`<span class="badge badge-accent" style="font-size:10px">${klantNaam(item.klantId)}</span>`:''}
          ${item.subtasks&&item.subtasks.length?`<span class="badge badge-gray" style="font-size:10px">↳ ${item.subtasks.filter(s=>s.done).length}/${item.subtasks.length}</span>`:''}
        </div>
        ${(item.subtasks||[]).length ? `<div style="margin-top:8px;padding-left:4px;border-left:2px solid var(--border);margin-left:4px">
          ${item.subtasks.map((s,si)=>`<div style="display:flex;align-items:center;gap:8px;padding:4px 0 4px 8px;font-size:12px">
            <div class="todo-check-box ${s.done?'checked':''}" style="width:14px;height:14px;border-radius:3px" onclick="toggleSubtask('${id}',${realIdx},${si})"></div>
            <span style="color:${s.done?'var(--text3)':'var(--text)'};text-decoration:${s.done?'line-through':'none'}">${s.text}</span>
            <button onclick="delSubtask('${id}',${realIdx},${si})" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:11px;margin-left:auto">✕</button>
          </div>`).join('')}
          <div style="display:flex;align-items:center;gap:6px;padding:4px 0 0 8px">
            <input placeholder="Subtaak toevoegen..." id="sub-input-${realIdx}" onkeydown="if(event.key==='Enter')addSubtask('${id}',${realIdx})"
              style="font-size:11px;background:transparent;border:none;border-bottom:1px solid var(--border);outline:none;color:var(--text);padding:2px 4px;flex:1;font-family:'Plus Jakarta Sans',sans-serif">
            <button onclick="addSubtask('${id}',${realIdx})" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:12px">+</button>
          </div>
        </div>`:''}
      </div>
      <div class="todo-item-actions">
        <button class="todo-action-btn" title="Notitie" onclick="editTodoNote('${id}',${realIdx})">💬</button>
        <button class="todo-action-btn" title="Subtaak" onclick="addSubtaskPrompt('${id}',${realIdx})">↳</button>
        <button class="todo-action-btn del" title="Verwijder" onclick="deleteTodoItem('${id}',${realIdx})">✕</button>
      </div>
    </div>`;

  let html = '';
  if (open.length) {
    html += open.map(item => {
      const realIdx = db.todoLists.find(l=>l.id===id).items.indexOf(item);
      return itemHtml(item, 0, realIdx);
    }).join('');
  }
  if (done.length) {
    html += `<div class="todo-section-head" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'':'none'">
      ▾ &nbsp;Voltooid (${done.length})
    </div>
    <div>
      ${done.map(item => {
        const realIdx = db.todoLists.find(l=>l.id===id).items.indexOf(item);
        return itemHtml(item, 0, realIdx);
      }).join('')}
    </div>`;
  }
  if (!open.length && !done.length) {
    html = `<div class="todo-empty"><div style="font-size:32px;opacity:0.3">✓</div><div style="font-size:13px;font-weight:600;margin-top:8px">Geen taken</div><div style="font-size:12px;margin-top:4px">Voeg een taak toe hierboven</div></div>`;
  }
  return html;
}

function addTodoItem(id) {
  const input = document.getElementById('todo-add-input-'+id);
  const text = (input||{}).value?.trim();
  if (!text) return;
  const prio = (document.getElementById('todo-add-prio-'+id)||{}).value || 'normaal';
  const datum = (document.getElementById('todo-add-date-'+id)||{}).value || '';
  const list = db.todoLists.find(l=>l.id===id);
  if (!list) return;
  list.items.unshift({ id:uid(), text, prio, datum, done:false, note:'', subtasks:[] });
  if (input) input.value = '';
  save(); renderTodoMain(id); renderTodoPage();
  toast('✓ Taak toegevoegd');
}

function toggleTodoItem(id, idx) {
  const list = db.todoLists.find(l=>l.id===id);
  if (!list || !list.items[idx]) return;
  list.items[idx].done = !list.items[idx].done;
  save(); renderTodoMain(id); renderTodoPage();
}

function deleteTodoItem(id, idx) {
  const list = db.todoLists.find(l=>l.id===id);
  if (!list) return;
  list.items.splice(idx, 1);
  save(); renderTodoMain(id); renderTodoPage();
}

function editTodoItemText(id, idx, text) {
  const list = db.todoLists.find(l=>l.id===id);
  if (list && list.items[idx]) { list.items[idx].text = text.trim(); save(); }
}

function editTodoNote(id, idx) {
  const list = db.todoLists.find(l=>l.id===id);
  if (!list) return;
  const note = prompt('Notitie:', list.items[idx].note||'');
  if (note !== null) { list.items[idx].note = note; save(); renderTodoMain(id); }
}

function addSubtaskPrompt(id, idx) {
  const list = db.todoLists.find(l=>l.id===id);
  if (!list) return;
  const text = prompt('Subtaak:'); if (!text) return;
  if (!list.items[idx].subtasks) list.items[idx].subtasks = [];
  list.items[idx].subtasks.push({ text, done:false });
  save(); renderTodoMain(id);
}

function addSubtask(id, idx) {
  const list = db.todoLists.find(l=>l.id===id);
  const input = document.getElementById('sub-input-'+idx);
  const text = input?.value?.trim(); if (!text) return;
  if (!list.items[idx].subtasks) list.items[idx].subtasks = [];
  list.items[idx].subtasks.push({ text, done:false });
  save(); renderTodoMain(id);
}

function toggleSubtask(id, idx, si) {
  const list = db.todoLists.find(l=>l.id===id);
  list.items[idx].subtasks[si].done = !list.items[idx].subtasks[si].done;
  save(); renderTodoMain(id); renderTodoPage();
}

function delSubtask(id, idx, si) {
  const list = db.todoLists.find(l=>l.id===id);
  list.items[idx].subtasks.splice(si,1);
  save(); renderTodoMain(id);
}

function renameTodoList(id, name) {
  const list = db.todoLists.find(l=>l.id===id);
  if (list && name.trim()) { list.naam = name.trim(); save(); renderTodoPage(); }
}

function deleteTodoList(id) {
  if (!confirm('Lijst verwijderen?')) return;
  db.todoLists = db.todoLists.filter(l=>l.id!==id);
  activeTodoListId = null;
  save(); renderTodoPage();
  document.getElementById('todo-main-content').innerHTML = `<div class="todo-empty"><div style="font-size:40px;opacity:0.3;margin-bottom:10px">☑</div><div style="font-size:14px;font-weight:700;color:var(--text2)">Lijst verwijderd</div></div>`;
}

function sortTodoItems(id, by) {
  const list = db.todoLists.find(l=>l.id===id);
  if (!list) return;
  const p = { hoog:0, normaal:1, laag:2 };
  if (by==='prio') list.items.sort((a,b)=>(p[a.prio]||1)-(p[b.prio]||1));
  else if (by==='datum') list.items.sort((a,b)=>(a.datum||'9999').localeCompare(b.datum||'9999'));
  else if (by==='alfa') list.items.sort((a,b)=>a.text.localeCompare(b.text));
  save(); renderTodoMain(id);
}

// ══════════════════════════════════════════════════════════════════════════════
// MEETING NOTITIES
// ══════════════════════════════════════════════════════════════════════════════
let activeMeetingId = null;
let meetingSearchQ = '';

function addMeeting() {
  const meeting = {
    id: uid(), titel: 'Vergadering ' + fmt(today()),
    datum: today(), tijd: '',
    type: 'intern', status: 'gepland',
    klantId: '', projectId: '',
    aanwezig: [],
    agenda: '',
    actiepunten: [],
    beslissingen: '',
    notities: '',
    followUp: ''
  };
  db.meetings.unshift(meeting);
  save();
  renderMeetingsSidebar();
  openMeeting(meeting.id);
  toast('✓ Vergadering aangemaakt');
}

function filterMeetings(q) { meetingSearchQ = q.toLowerCase(); renderMeetingsSidebar(); }

function renderMeetingsSidebar() {
  const list = document.getElementById('meetings-sidebar-list');
  if (!list) return;
  let meetings = db.meetings;
  if (meetingSearchQ) meetings = meetings.filter(m => `${m.titel} ${m.agenda} ${m.notities}`.toLowerCase().includes(meetingSearchQ));

  const typeColor = { intern:'var(--accent)', klant:'var(--green)', extern:'var(--amber)', online:'var(--blue)' };
  list.innerHTML = meetings.length ? meetings.map(m => `
    <div class="meeting-item ${m.id===activeMeetingId?'active':''}" onclick="openMeeting('${m.id}')">
      <div class="meeting-item-title">${m.titel}</div>
      <div class="meeting-item-meta">
        <span style="color:${typeColor[m.type]||'var(--text3)'}">${m.type}</span>
        <span>${fmt(m.datum)}${m.tijd?' · '+m.tijd:''}</span>
        ${m.klantId?`<span>${klantNaam(m.klantId)}</span>`:''}
        ${m.actiepunten&&m.actiepunten.length?`<span>${m.actiepunten.filter(a=>!a.done).length} acties open</span>`:''}
      </div>
    </div>`).join('') :
    `<div style="padding:20px;color:var(--text3);font-size:13px;text-align:center">Geen vergaderingen gevonden</div>`;
  updateBadges();
}

function openMeeting(id) {
  activeMeetingId = id;
  const m = db.meetings.find(m=>m.id===id);
  if (!m) return;
  renderMeetingsSidebar();
  renderMeetingMain(m);
}

function renderMeetingMain(m) {
  const main = document.getElementById('meeting-main');
  if (!main) return;
  const typeColor = { intern:'var(--accent)', klant:'var(--green)', extern:'var(--amber)', online:'var(--blue)' };

  main.innerHTML = `
    <div class="meeting-main-head">
      <div class="meeting-main-info">
        <input class="meeting-main-title" value="${m.titel}" onblur="saveMeetingField('${m.id}','titel',this.value)" placeholder="Vergaderingtitel...">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <input type="date" value="${m.datum}" onchange="saveMeetingField('${m.id}','datum',this.value)"
            style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-size:12px;color:var(--text);outline:none;font-family:'Plus Jakarta Sans',sans-serif">
          <input type="time" value="${m.tijd||''}" onchange="saveMeetingField('${m.id}','tijd',this.value)"
            style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-size:12px;color:var(--text);outline:none;font-family:'Plus Jakarta Sans',sans-serif">
          <select onchange="saveMeetingField('${m.id}','type',this.value)"
            style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-size:12px;color:${typeColor[m.type]||'var(--text)'};outline:none">
            ${['intern','klant','extern','online'].map(t=>`<option value="${t}"${m.type===t?' selected':''}>${t}</option>`).join('')}
          </select>
          <select onchange="saveMeetingField('${m.id}','klantId',this.value)"
            style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-size:12px;color:var(--text);outline:none">
            <option value="">— Geen klant —</option>
            ${db.klanten.map(k=>`<option value="${k.id}"${k.id===m.klantId?' selected':''}>${k.voornaam} ${k.achternaam}</option>`).join('')}
          </select>
        </div>
      </div>
      <button class="btn btn-danger" onclick="deleteMeeting('${m.id}')">Verwijder</button>
    </div>

    <div class="meeting-main-body" style="overflow-y:auto;flex:1">

      <!-- AANWEZIGEN -->
      <div class="meeting-section">
        <div class="meeting-section-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          Aanwezigen
        </div>
        <div class="meeting-attendees" id="meeting-attendees-${m.id}">
          ${(m.aanwezig||[]).map((a,i)=>`<div class="attendee-chip">
            <div class="attendee-avatar">${a[0].toUpperCase()}</div>
            <span>${a}</span>
            <button class="attendee-del" onclick="removeAttendee('${m.id}',${i})">✕</button>
          </div>`).join('')}
          <button class="btn btn-ghost" style="padding:4px 10px;font-size:12px" onclick="addAttendee('${m.id}')">+ Persoon</button>
        </div>
      </div>

      <!-- AGENDA -->
      <div class="meeting-section">
        <div class="meeting-section-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          Agenda
        </div>
        <textarea class="agenda-input" rows="4" placeholder="1. Punt één&#10;2. Punt twee&#10;3. ..." onblur="saveMeetingField('${m.id}','agenda',this.value)">${m.agenda||''}</textarea>
      </div>

      <!-- NOTITIES -->
      <div class="meeting-section">
        <div class="meeting-section-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Notulen / Notities
        </div>
        <textarea class="agenda-input" rows="6" placeholder="Wat werd er besproken? Belangrijke punten, beslissingen, context..." onblur="saveMeetingField('${m.id}','notities',this.value)">${m.notities||''}</textarea>
      </div>

      <!-- BESLISSINGEN -->
      <div class="meeting-section">
        <div class="meeting-section-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          Beslissingen
        </div>
        <textarea class="agenda-input" rows="3" placeholder="Welke beslissingen werden genomen?" onblur="saveMeetingField('${m.id}','beslissingen',this.value)">${m.beslissingen||''}</textarea>
      </div>

      <!-- ACTIEPUNTEN -->
      <div class="meeting-section">
        <div class="meeting-section-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          Actiepunten
          <button class="btn btn-primary" style="padding:3px 10px;font-size:11px;margin-left:auto" onclick="addActionItem('${m.id}')">+ Actie</button>
        </div>
        <div id="meeting-actions-${m.id}">
          ${renderActionItems(m)}
        </div>
      </div>

      <!-- FOLLOW-UP -->
      <div class="meeting-section" style="border-bottom:none">
        <div class="meeting-section-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 17 4 12 9 7"/><line x1="20" y1="12" x2="4" y2="12"/></svg>
          Volgende stappen / Follow-up
        </div>
        <textarea class="agenda-input" rows="3" placeholder="Volgende meeting? Deadlines? Te versturen e-mails?" onblur="saveMeetingField('${m.id}','followUp',this.value)">${m.followUp||''}</textarea>
      </div>
    </div>`;
}

function renderActionItems(m) {
  if (!m.actiepunten || !m.actiepunten.length)
    return `<div style="color:var(--text3);font-size:13px;padding:4px 0">Geen actiepunten — klik op + Actie</div>`;
  return m.actiepunten.map((a,i) => `
    <div class="meeting-action-item">
      <div class="todo-check-box ${a.done?'checked':''}" onclick="toggleAction('${m.id}',${i})" style="margin-top:1px"></div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600;color:${a.done?'var(--text3)':'var(--text)'};text-decoration:${a.done?'line-through':'none'}">${a.text}</div>
        <div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap">
          ${a.wie?`<span class="badge badge-accent" style="font-size:10px">👤 ${a.wie}</span>`:''}
          ${a.datum?`<span class="badge badge-gray td-mono" style="font-size:10px">📅 ${fmt(a.datum)}</span>`:''}
          ${a.prio==='hoog'?`<span class="badge badge-red" style="font-size:10px">Hoog</span>`:''}
        </div>
      </div>
      <button onclick="delAction('${m.id}',${i})" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:13px;padding:2px 6px;border-radius:4px" onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--text3)'">✕</button>
    </div>`).join('');
}

function saveMeetingField(id, field, value) {
  const m = db.meetings.find(m=>m.id===id);
  if (m) { m[field] = value; save(); renderMeetingsSidebar(); }
}

function addAttendee(id) {
  const naam = prompt('Naam aanwezige:'); if (!naam) return;
  const m = db.meetings.find(m=>m.id===id);
  if (!m.aanwezig) m.aanwezig = [];
  m.aanwezig.push(naam);
  save();
  const el = document.getElementById('meeting-attendees-'+id);
  if (el) el.innerHTML = (m.aanwezig||[]).map((a,i)=>`<div class="attendee-chip">
    <div class="attendee-avatar">${a[0].toUpperCase()}</div><span>${a}</span>
    <button class="attendee-del" onclick="removeAttendee('${id}',${i})">✕</button>
  </div>`).join('') + `<button class="btn btn-ghost" style="padding:4px 10px;font-size:12px" onclick="addAttendee('${id}')">+ Persoon</button>`;
}

function removeAttendee(id, idx) {
  const m = db.meetings.find(m=>m.id===id);
  m.aanwezig.splice(idx,1); save(); openMeeting(id);
}

function addActionItem(id) {
  const m = db.meetings.find(m=>m.id===id);
  const text = prompt('Actiepunt:'); if (!text) return;
  const wie = prompt('Verantwoordelijke (optioneel):') || '';
  const datum = prompt('Deadline (YYYY-MM-DD, optioneel):') || '';
  if (!m.actiepunten) m.actiepunten = [];
  m.actiepunten.push({ text, wie, datum, prio:'normaal', done:false });
  save();
  const el = document.getElementById('meeting-actions-'+id);
  if (el) el.innerHTML = renderActionItems(m);
  renderMeetingsSidebar();
}

function toggleAction(id, idx) {
  const m = db.meetings.find(m=>m.id===id);
  m.actiepunten[idx].done = !m.actiepunten[idx].done;
  save();
  const el = document.getElementById('meeting-actions-'+id);
  if (el) el.innerHTML = renderActionItems(m);
  renderMeetingsSidebar();
}

function delAction(id, idx) {
  const m = db.meetings.find(m=>m.id===id);
  m.actiepunten.splice(idx,1); save(); openMeeting(id);
}

function deleteMeeting(id) {
  if (!confirm('Vergadering verwijderen?')) return;
  db.meetings = db.meetings.filter(m=>m.id!==id);
  activeMeetingId = null; save();
  renderMeetingsSidebar();
  document.getElementById('meeting-main').innerHTML = `<div class="meeting-empty"><div class="meeting-empty-icon">📋</div><div style="font-size:14px;font-weight:700;color:var(--text2)">Selecteer een meeting</div><button class="btn btn-primary" style="margin-top:16px" onclick="addMeeting()">+ Nieuwe vergadering</button></div>`;
  toast('✓ Vergadering verwijderd');
}

// ─── MOBILE / AGENDA UI ────────────────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('open');
  document.getElementById('sidebar-overlay')?.classList.toggle('open');
}

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('open');
}

function populateAfSelects() {
  const afk = document.getElementById('af-klant');
  const afp = document.getElementById('af-project');
  if (afk) {
    afk.innerHTML = '<option value="">— Geen —</option>' + db.klanten.map(k =>
      `<option value="${k.id}">${(k.voornaam || '')} ${(k.achternaam || '')}</option>`).join('');
  }
  if (afp) {
    afp.innerHTML = '<option value="">— Geen —</option>' + db.projecten.map(p =>
      `<option value="${p.id}">${p.naam || ''}</option>`).join('');
  }
}

function openAddAfspraakModal() {
  editId = null;
  clearForm('modal-afspraak');
  set('af-datum', selectedDay || today());
  populateAfSelects();
  document.getElementById('modal-afspraak').classList.add('open');
}

function saveAfspraak() {
  const naam = v('af-naam');
  const datum = v('af-datum');
  if (!naam || !datum) {
    toast('Titel en datum zijn verplicht');
    return;
  }
  db.afspraken.push({
    id: uid(),
    naam,
    datum,
    tijd: v('af-tijd'),
    type: v('af-type') || 'afspraak',
    klantId: v('af-klant') || '',
    projectId: v('af-project') || '',
    locatie: v('af-locatie'),
    note: v('af-note')
  });
  save();
  closeModal('modal-afspraak');
  if (currentPage === 'agenda') {
    renderCalendar();
    renderAgendaDayList();
    renderAgendaUpcoming();
  }
  toast('✓ Afspraak opgeslagen');
}

function delAfspraak(id) {
  db.afspraken = db.afspraken.filter(a => a.id !== id);
  save();
  if (currentPage === 'agenda') {
    renderCalendar();
    renderAgendaDayList();
    renderAgendaUpcoming();
  }
  toast('Verwijderd');
}

function calPrev() {
  calMonth--;
  if (calMonth < 0) {
    calMonth = 11;
    calYear--;
  }
  renderCalendar();
}

function calNext() {
  calMonth++;
  if (calMonth > 11) {
    calMonth = 0;
    calYear++;
  }
  renderCalendar();
}

function selectCalDay(ds) {
  selectedDay = ds;
  renderCalendar();
  renderAgendaDayList();
}

function renderCalendar() {
  const title = document.getElementById('cal-title');
  const grid = document.getElementById('cal-grid');
  if (!title || !grid) return;
  const monthNames = ['Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni', 'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'];
  title.textContent = `${monthNames[calMonth]} ${calYear}`;
  const wd = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
  let html = wd.map(d => `<div class="cal-day-name">${d}</div>`).join('');
  const first = new Date(calYear, calMonth, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const todayStr = today();
  for (let i = 0; i < startPad; i++) {
    html += '<div class="cal-cell other-month"></div>';
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isSel = selectedDay === ds;
    const isToday = ds === todayStr;
    const dayAfs = (db.afspraken || []).filter(a => a.datum === ds);
    html += `<div class="cal-cell ${isSel ? 'selected' : ''} ${isToday ? 'today' : ''}" onclick="selectCalDay('${ds}')">
      <div class="cal-day-num">${d}</div>
      ${dayAfs.slice(0, 3).map(a => `<div class="cal-dot type-${a.type || 'afspraak'}">${(a.naam || '').slice(0, 14)}</div>`).join('')}
      ${dayAfs.length > 3 ? `<div class="cal-more">+${dayAfs.length - 3}</div>` : ''}
    </div>`;
  }
  grid.innerHTML = html;
  renderAgendaUpcoming();
}

function renderAgendaDayList() {
  const title = document.getElementById('agenda-day-title');
  const list = document.getElementById('agenda-day-list');
  if (!title || !list) return;
  if (!selectedDay) {
    title.textContent = 'Selecteer een dag';
    list.innerHTML = '<div style="color:var(--text3);font-size:13px">Klik op een dag in de kalender</div>';
    return;
  }
  title.textContent = fmt(selectedDay);
  const items = (db.afspraken || []).filter(a => a.datum === selectedDay)
    .sort((a, b) => (a.tijd || '').localeCompare(b.tijd || ''));
  list.innerHTML = items.length ? items.map(a => `
    <div class="afspraak-item">
      <div class="afspraak-time">${a.tijd || '—'}</div>
      <div class="afspraak-dot type-${a.type || 'afspraak'}"></div>
      <div style="flex:1">
        <div class="afspraak-naam">${a.naam || 'Zonder titel'}</div>
        <div class="afspraak-meta">${a.locatie || ''}</div>
      </div>
      <button type="button" class="afspraak-del" onclick="delAfspraak('${a.id}')">✕</button>
    </div>`).join('') : '<div style="color:var(--text3);font-size:13px">Geen items op deze dag</div>';
}

function renderAgendaUpcoming() {
  const el = document.getElementById('agenda-upcoming');
  if (!el) return;
  const now = today();
  const upcoming = (db.afspraken || [])
    .filter(a => a.datum >= now)
    .sort((a, b) => (a.datum + (a.tijd || '')).localeCompare(b.datum + (b.tijd || '')))
    .slice(0, 12);
  el.innerHTML = upcoming.length ? upcoming.map(a => `
    <div class="afspraak-item" style="cursor:pointer" onclick="showPage('agenda');selectCalDay('${a.datum}')">
      <div class="afspraak-time td-mono">${fmt(a.datum)}</div>
      <div class="afspraak-dot type-${a.type || 'afspraak'}"></div>
      <div style="flex:1">
        <div class="afspraak-naam">${a.naam || ''}</div>
        <div class="afspraak-meta">${a.tijd || ''} ${a.locatie ? '· ' + a.locatie : ''}</div>
      </div>
    </div>`).join('') : '<div style="color:var(--text3);font-size:13px">Geen aankomende items</div>';
}



// ─── PEPPOL INTEGRATION ─────────────────────────────────────────────────────
const PEPPOL_SETTINGS_KEY = 'orion_peppol_config';
const PEPPOL_STATUS_CACHE_KEY = 'orion_peppol_status_cache';
/** Zout niet wijzigen — bestaande versleutelde Peppol-keys in localStorage blijven bruikbaar. */
const PEPPOL_KEY_SALT = 'nebula::peppol::2026';

function peppolSimpleKey() {
  const seed = (localStorage.getItem(ADMIN_PASSWORD_KEY) || ADMIN_DEFAULT_PASSWORD) + '|' + PEPPOL_KEY_SALT;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h += (h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24); }
  return (h >>> 0).toString(16);
}

function peppolEncrypt(text) {
  const k = peppolSimpleKey();
  let out = '';
  for (let i = 0; i < text.length; i++) out += String.fromCharCode(text.charCodeAt(i) ^ k.charCodeAt(i % k.length));
  return btoa(unescape(encodeURIComponent(out)));
}

function peppolDecrypt(enc) {
  try {
    const raw = decodeURIComponent(escape(atob(enc)));
    const k = peppolSimpleKey();
    let out = '';
    for (let i = 0; i < raw.length; i++) out += String.fromCharCode(raw.charCodeAt(i) ^ k.charCodeAt(i % k.length));
    return out;
  } catch { return ''; }
}

function loadPeppolSettings() {
  try {
    const raw =
      localStorage.getItem(PEPPOL_SETTINGS_KEY) ||
      localStorage.getItem('nebula_peppol_config') ||
      localStorage.getItem('nebula_peppol_settings_v1') ||
      '{}';
    const parsed = JSON.parse(raw);
    if (parsed.apiKeyEnc) parsed.apiKey = peppolDecrypt(parsed.apiKeyEnc);
    if (parsed.apiSecretEnc) parsed.apiSecret = peppolDecrypt(parsed.apiSecretEnc);
    return parsed;
  } catch { return {}; }
}

function savePeppolSettings() {
  if (!requireAdmin()) return;
  const obj = {
    sandbox: ((document.getElementById('peppol-sandbox')||{}).value || '1') === '1',
    webhookUrl: v('peppol-webhook').trim(),
    ownKbo: v('peppol-own-kbo').replace(/\D/g, ''),
    ownEmail: v('peppol-own-email').trim(),
    updatedAt: new Date().toISOString(),
  };
  const key = v('peppol-api-key').trim();
  const secret = v('peppol-api-secret').trim();
  if (key) obj.apiKeyEnc = peppolEncrypt(key);
  if (secret) obj.apiSecretEnc = peppolEncrypt(secret);
  localStorage.setItem(PEPPOL_SETTINGS_KEY, JSON.stringify(obj));
  const st = document.getElementById('peppol-settings-status');
  if (st) st.textContent = '✓ opgeslagen';
  toast('✓ Peppol instellingen opgeslagen');
}

function hydratePeppolSettingsForm() {
  const ps = loadPeppolSettings();
  set('peppol-api-key', ps.apiKey || '');
  set('peppol-api-secret', ps.apiSecret || '');
  set('peppol-sandbox', ps.sandbox === false ? '0' : '1');
  set('peppol-webhook', ps.webhookUrl || '');
  set('peppol-own-kbo', ps.ownKbo || '');
  set('peppol-own-email', ps.ownEmail || '');
}

function getPeppolClient() {
  const ps = loadPeppolSettings();
  if (!ps.apiKey || !ps.apiSecret) return null;
  if (typeof window.OrionPeppol !== 'function') return null;
  return new window.OrionPeppol({ apiKey: ps.apiKey, apiSecret: ps.apiSecret, sandbox: ps.sandbox !== false, webhookUrl: ps.webhookUrl || null, onLog: () => {} });
}

function peppolKlantBadge(k) {
  const st = ((k && k.peppol) ? k.peppol.status : '') || 'unknown';
  if (st === 'registered') return '<span class="badge badge-peppol-ok" style="margin-left:6px">PEPPOL ✓</span>';
  if (st === 'missing') return '<span class="badge badge-gray" style="margin-left:6px">GEEN PEPPOL</span>';
  return '<span class="badge badge-gray" style="margin-left:6px">PEPPOL ?</span>';
}

function loadPeppolStatusCache() {
  try { return JSON.parse(localStorage.getItem(PEPPOL_STATUS_CACHE_KEY) || '{}'); } catch { return {}; }
}

function savePeppolStatusCache(map) {
  localStorage.setItem(PEPPOL_STATUS_CACHE_KEY, JSON.stringify(map || {}));
}

async function refreshKlantPeppolStatus(klantId, force = false) {
  const k = db.klanten.find(x => x.id === klantId);
  if (!k) return null;
  const vat = String(k.btw || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const kbo = vat.startsWith('BE') ? vat.slice(2) : String(k.kbo || '').replace(/\D/g, '');
  if (!kbo && !vat) return null;
  const key = (kbo || vat).toLowerCase();
  const cache = loadPeppolStatusCache();
  const now = Date.now();
  const dayMs = 24 * 3600 * 1000;
  if (!force && cache[key] && now - (cache[key].ts || 0) < dayMs) {
    k.peppol = cache[key].data;
    return cache[key].data;
  }
  const client = getPeppolClient();
  if (!client) return null;
  const result = await client.checkBelgianCompany(kbo || '', vat || '');
  const data = result && result.found
    ? { status: 'registered', peppolId: result.peppolId, checkedAt: new Date().toISOString() }
    : { status: 'missing', peppolId: null, checkedAt: new Date().toISOString() };
  k.peppol = data;
  cache[key] = { ts: now, data };
  savePeppolStatusCache(cache);
  save();
  return data;
}

function buildPeppolInvoiceData(f) {
  const b = JSON.parse(invoiceBrandingRaw());
  const kl = db.klanten.find(k => k.id === f.klantId) || {};
  const sellerVat = String(b.vat || '').trim();
  const sellerKbo = sellerVat.replace(/\D/g, '').replace(/^BE/i, '').replace(/^0?/, '0').slice(-10);
  const buyerVat = String(kl.btw || '').replace(/\s/g, '').toUpperCase();
  const buyerKbo = buyerVat.replace(/^BE/i, '').replace(/\D/g, '').slice(-10);
  return {
    invoiceNumber: f.num,
    issueDate: f.datum || today(),
    dueDate: f.verval || today(),
    invoiceTypeCode: (f.type === 'creditnota' ? '381' : '380'),
    currencyCode: 'EUR',
    note: f.note || '',
    buyerReference: f.ref || '',
    seller: {
      name: b.companyName || 'Orion',
      vatNumber: sellerVat || 'BE0000000000',
      kboNumber: sellerKbo || '0000000000',
      street: (b.addressLine || 'Adres onbekend').split(',')[0],
      city: 'Brussel',
      postalCode: '1000',
      country: 'BE',
      email: b.email || '',
      phone: b.phone || '',
      iban: b.iban || '',
      bic: '',
    },
    buyer: {
      name: (kl.bedrijf || `${kl.voornaam || ''} ${kl.achternaam || ''}`).trim() || 'Klant',
      vatNumber: buyerVat || 'BE0000000000',
      kboNumber: buyerKbo || '0000000000',
      street: (kl.adres || 'Adres onbekend').split(',')[0],
      city: 'Onbekend',
      postalCode: '0000',
      country: 'BE',
      email: kl.email || '',
    },
    lines: (f.lines || []).map((l) => ({
      description: l.omschrijving || 'Dienst',
      quantity: Number(l.aantal || 1),
      unitCode: 'C62',
      unitPrice: Number(l.prijs || 0),
      vatRate: Number(f.btwPct || 21),
    })),
    paymentTerms: { note: `Betaling binnen ${f.termijn || 30} dagen na factuurdatum.` },
  };
}

function validateBelgianIban(iban) {
  const c = String(iban || '').replace(/\s/g, '').toUpperCase();
  return /^BE\d{14}$/.test(c);
}

function validateStructuredReference(ref) {
  const r = String(ref || '').replace(/[^0-9]/g, '');
  if (r.length !== 12) return false;
  const base = parseInt(r.slice(0, 10), 10);
  const cd = parseInt(r.slice(10), 10);
  let m = base % 97; if (m === 0) m = 97;
  return cd === m;
}

function validateFactuurForDefinitiveStatus(f) {
  const definitive = ['openstaand', 'deels-betaald', 'betaald', 'vervallen'];
  if (!definitive.includes(f.status)) return '';
  if (!window.OrionUBL || typeof window.OrionUBL.validateInvoiceData !== 'function') return '';
  const data = buildPeppolInvoiceData(f);
  const errs = window.OrionUBL.validateInvoiceData(data);
  if (errs.length) return `Factuurvalidatie: ${errs[0]}`;
  const b = JSON.parse(invoiceBrandingRaw());
  if (!validateBelgianIban(b.iban || '')) return 'Ongeldige Belgische IBAN in Mijn bedrijf';
  const sr = (window.OrionUBL.generateStructuredReference ? window.OrionUBL.generateStructuredReference(f.num) : '');
  if (sr && !validateStructuredReference(sr)) return 'Gestructureerde mededeling ongeldig (modulo 97)';
  return '';
}

async function peppolTestConnection() {
  const client = getPeppolClient();
  if (!client) { toast('❌ Vul eerst Digiteal API key/secret in'); return; }
  const kbo = v('peppol-own-kbo').replace(/\D/g, '') || '0123456789';
  const rs = await client.checkBelgianCompany(kbo, 'BE' + kbo);
  const ok = !!(rs && (rs.success || rs.found !== undefined));
  const st = document.getElementById('peppol-settings-status');
  if (st) st.textContent = ok ? '✓ verbinding OK' : '❌ verbinding mislukt';
  toast(ok ? '✓ Peppol verbinding werkt' : '❌ Peppol test mislukt');
}

async function peppolRegisterSelf() {
  const client = getPeppolClient();
  if (!client) { toast('❌ Vul eerst Digiteal API key/secret in'); return; }
  const kbo = v('peppol-own-kbo').replace(/\D/g, '');
  const email = v('peppol-own-email').trim();
  if (!kbo || !email) { toast('❌ Vul eigen KBO en e-mail in'); return; }
      const r = await client.registerParticipant({ kboNumber: kbo, contactEmail: email, contactFirstName: 'Orion', contactLastName: 'Admin', language: 'NL' });
  if (r.success) toast('✓ Registratie als Peppol deelnemer gestart/ok');
  else toast('❌ Registratie mislukt: ' + (r.error || 'onbekend'));
}

async function sendFactuurViaPeppol(id) {
  const f = db.facturen.find(x => x.id === id);
  if (!f) return;
  const client = getPeppolClient();
  if (!client) { toast('❌ Peppol niet geconfigureerd (Instellingen > Peppol)'); return; }
  const k = db.klanten.find(x => x.id === f.klantId);
  if (!k) { toast('❌ Geen klant gekoppeld aan factuur'); return; }
  const st = await refreshKlantPeppolStatus(k.id, true);
  if (!st || st.status !== 'registered') {
    f.peppol = { status: 'failed', error: 'Ontvanger niet op Peppol', at: new Date().toISOString() };
    save(); render();
    toast('⚠ Ontvanger niet op Peppol. Stuur voorlopig via e-mail.');
    return;
  }
  const invoiceData = buildPeppolInvoiceData(f);
  const errs = window.OrionUBL.validateInvoiceData(invoiceData);
  if (errs.length) { toast('❌ ' + errs[0]); return; }
  const flow = await window.sendInvoiceFlow(client, invoiceData, window.OrionUBL);
  if (flow.success) {
    f.peppol = { status: 'sent', documentId: flow.documentId || '', sentAt: new Date().toISOString(), peppolId: st.peppolId || '' };
    save(); render();
    toast('✓ Verstuurd via Peppol');
  } else {
    f.peppol = { status: 'failed', error: (flow.errors || []).join('; ') || 'Onbekende fout', at: new Date().toISOString() };
    save(); render();
    toast('❌ Peppol fout: ' + (f.peppol.error || 'onbekend'));
  }
}

async function peppolPullInbox() {
  const client = getPeppolClient();
  if (!client) { toast('❌ Peppol niet geconfigureerd'); return; }
  const r = await client.getInboundDocuments({ limit: 50 });
  if (!r.success) { toast('❌ Inbox ophalen mislukt'); return; }
  const docs = Array.isArray(r.data) ? r.data : (r.data && r.data.items) ? r.data.items : [];
  db.peppolInbox = docs.map((d) => ({
    id: d.id || uid(),
    from: d.sender || d.from || 'Onbekend',
    peppolId: d.senderPeppolId || d.peppolId || '',
    issueDate: d.issueDate || '',
    amount: Number(d.amount || d.total || 0),
    currency: d.currency || 'EUR',
    status: d.status || 'new',
    xmlId: d.id || '',
    processed: false,
    matchedKlantId: matchKlantByPeppolDoc(d),
  }));
  save();
  renderPeppolPage();
  toast('✓ Peppol inbox bijgewerkt');
}

function matchKlantByPeppolDoc(doc) {
  const val = String(doc.senderVat || doc.vatNumber || '').replace(/\s/g, '').toUpperCase();
  if (!val) return '';
  const k = db.klanten.find((x) => String(x.btw || '').replace(/\s/g, '').toUpperCase() === val);
  return k ? k.id : '';
}

async function peppolDownloadInboxXml(id) {
  const client = getPeppolClient();
  if (!client) { toast('❌ Peppol niet geconfigureerd'); return; }
  const item = (db.peppolInbox || []).find(x => x.id === id);
  if (!item) return;
  const r = await client.getDocument(item.xmlId || id);
  if (!r.success) { toast('❌ XML ophalen mislukt'); return; }
  const xml = typeof r.data === 'string' ? r.data : JSON.stringify(r.data, null, 2);
  const blob = new Blob([xml], { type: 'application/xml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `peppol-inbound-${id}.xml`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 800);
}

function peppolMarkInboxProcessed(id) {
  const item = (db.peppolInbox || []).find(x => x.id === id);
  if (!item) return;
  item.processed = !item.processed;
  item.status = item.processed ? 'processed' : 'new';
  save();
  renderPeppolPage();
}

function peppolFactuurBadge(f) {
  const p = f && f.peppol ? f.peppol : null;
  if (!p || !p.status) return '<span class="badge badge-gray">GEEN PEPPOL</span>';
  if (p.status === 'sent' || p.status === 'delivered') return '<span class="badge badge-peppol-sent">VERSTUURD VIA PEPPOL</span>';
  if (p.status === 'failed') return '<span class="badge badge-peppol-failed">PEPPOL FOUT</span>';
  return '<span class="badge badge-gray">PEPPOL ' + p.status + '</span>';
}

function renderPeppolPage() {
  hydratePeppolSettingsForm();
  const all = db.facturen || [];
  const sent = all.filter(f => f.peppol && (f.peppol.status === 'sent' || f.peppol.status === 'delivered')).length;
  const failed = all.filter(f => f.peppol && f.peppol.status === 'failed').length;
  const inbox = db.peppolInbox || [];
  const setT = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setT('peppol-stat-sent', String(sent));
  setT('peppol-stat-failed', String(failed));
  setT('peppol-stat-inbox', String(inbox.length));
  setT('peppol-stat-sync', inbox.length ? fmt(today()) : '—');
  const list = document.getElementById('peppol-inbox-list');
  if (list) {
    list.innerHTML = inbox.length ? inbox.map((x) => `
      <div class="api-entry" style="align-items:flex-start">
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700">${x.from || 'Onbekend'} ${x.matchedKlantId ? '<span class="badge badge-peppol-ok" style="margin-left:8px">GEMATCHT</span>' : ''}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:3px">${x.peppolId || '—'} · ${x.issueDate || '—'} · €${Number(x.amount||0).toLocaleString('nl-BE', { minimumFractionDigits: 2 })}</div>
        </div>
        <button class="btn btn-ghost" style="padding:4px 9px;font-size:11px" onclick="peppolDownloadInboxXml('${x.id}')">XML</button>
        <button class="btn btn-ghost" style="padding:4px 9px;font-size:11px" onclick="peppolMarkInboxProcessed('${x.id}')">${x.processed ? 'Verwerkt ✓' : 'Markeer verwerkt'}</button>
      </div>`).join('') : '<div class="empty"><div class="empty-icon">📥</div><div class="empty-text">Geen Peppol documenten</div><div class="empty-sub">Klik op Inbox verversen</div></div>';
  }
}

function renderFacturenWithPeppolBadges() {
  document.querySelectorAll('#facturen-tbody tr').forEach((tr) => {
    const btn = tr.querySelector('button[title="Download PDF"]');
    if (!btn) return;
    const m = (btn.getAttribute('onclick') || '').match(/downloadFactuurPdf\('([^']+)'\)/);
    if (!m) return;
    const id = m[1];
    const f = db.facturen.find(x => x.id === id);
    const statusTd = tr.children[9];
    if (statusTd && f) statusTd.innerHTML = statusBadge(f.status || 'concept') + '<div style="margin-top:4px">' + peppolFactuurBadge(f) + '</div>';
  });
}
function installClickSafetyGuards() {
  const names = [
    'showPage','openAddModal','openModal','closeModal','saveKlant','saveProject','saveTaak','saveFactuur','saveApi',
    'addTodoList','addMeeting','filterProjecten','filterFacturen','startFactuurOpstellen','openAddAfspraakModal',
    'editFactuur','populateFactuurProjectSelect','addFacAttachmentPrompt','addDefaultFacAttachments','removeFacAttachment',
    'submitArchInputModal','closeArchInputModal','closeArchConfirmModal',
    'openFinKeuzeModal','finKiesUitgave','finKiesInkomen','saveFinUitgave','saveFinInkomen',
    'delFinUitgave','delFinInkomen','openFinUitgaveModal','openFinInkomenModal','setFinJaar','updateFinUitgaveCategoryHint','showFinTab',
    'openProjectArch','openProjectDetail','editProject','editKlant','switchArchTab','saveProjectNotes',
    'saveFollowupMailSettings','downloadFactuurPdf','toggleMobileSearch','saveBranding',
    'savePeppolSettings','peppolTestConnection','peppolRegisterSelf','peppolPullInbox','sendFactuurViaPeppol','refreshKlantPeppolStatus',
    'saveArtikel','editArtikel','delArtikel'
  ];
  names.forEach((name) => {
    const fn = window[name];
    if (typeof fn !== 'function' || fn.__safeWrapped) return;
    const wrapped = function(...args) {
      try {
        return fn.apply(this, args);
      } catch (err) {
        console.error(`[UI handler failed] ${name}`, err);
        toast(`❌ Actie mislukt (${name}). Probeer opnieuw.`);
        return null;
      }
    };
    wrapped.__safeWrapped = true;
    window[name] = wrapped;
  });
}

window.addEventListener('error', (e) => {
  const msg =
    (e.error && e.error.message) ? e.error.message :
    (e.message ? String(e.message) : 'Onbekende JS fout');
  console.error('Uncaught error:', e.error || e.message);
  // In de native WKWebView zien we de console niet altijd; toon daarom ook een toast.
  try {
    if (typeof toast === 'function') toast(`❌ JS fout: ${msg}`);
  } catch {}
});

// Promise fouten (async) kunnen ook de UI "stil" laten falen.
window.addEventListener('unhandledrejection', (e) => {
  const msg =
    (e.reason && e.reason.message) ? e.reason.message :
    (e.reason ? String(e.reason) : 'Onbekende unhandled rejection');
  console.error('Unhandled rejection:', e.reason || e);
  try {
    if (typeof toast === 'function') toast(`❌ JS async fout: ${msg}`);
  } catch {}
});

// ─── INIT ─────────────────────────────────────────────────────────────────────
load();
// Maak admin meteen aan bij eerste run.
ensureAdminExistsAndAuthed(false);
try {
  const raw = localStorage.getItem(CLOUD_SYNC_AUTH_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.u === ADMIN_USERNAME && typeof parsed.p === 'string') {
      currentAdminPassword = parsed.p;
    }
  }
} catch {}
installClickSafetyGuards();
render();
if (!isAdminAuthed()) {
  showLoginScreen('');
} else if (currentAdminPassword) {
  cloudLoginAndPull(ADMIN_USERNAME, currentAdminPassword);
}
