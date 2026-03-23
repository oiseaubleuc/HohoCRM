// ─── STATE ───────────────────────────────────────────────────────────────────
let db = {
  klanten: [], projecten: [], taken: [], facturen: [],
  apis: [], afspraken: [], todoLists: [], meetings: []
};

let currentPage = 'dashboard';
let editId = null;
let projectFilter = 'alle';
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let selectedDay = null;

// ─── PERSISTENCE ─────────────────────────────────────────────────────────────
function save() {
  localStorage.setItem('mijncrm', JSON.stringify(db));
}

function load() {
  const raw = localStorage.getItem('mijncrm');
  if (raw) {
    try { db = JSON.parse(raw); } catch(e) {}
  }
  // Ensure arrays
  ['klanten','projecten','taken','facturen','apis','afspraken','todoLists','meetings'].forEach(k => {
    if (!Array.isArray(db[k])) db[k] = [];
  });
  if (!db.roadmaps) db.roadmaps = {};
  if (!db.arch) db.arch = {};
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
function showPage(name) {
  closeSidebar();
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(b => {
    if (b.textContent.toLowerCase().includes(name.slice(0,4))) b.classList.add('active');
  });
  currentPage = name;
  document.getElementById('topbar-title').textContent = {
    dashboard: 'Dashboard', klanten: 'Klanten', projecten: 'Projecten',
    taken: 'Taken', facturen: 'Facturen', apilog: 'API & Tools',
    tijdlijn: 'Tijdlijn', roadmap: 'Roadmap', agenda: 'Agenda & Afspraken',
    todo: 'To-Do Lijsten', meetings: 'Meeting Notities'
  }[name] || name;
  render();
  closeDetail();
}

// ─── OPEN MODAL ──────────────────────────────────────────────────────────────
function openAddModal() {
  editId = null;
  const map = {
    dashboard: 'klant', klanten: 'klant', projecten: 'project',
    taken: 'taak', facturen: 'factuur', apilog: 'api',
    tijdlijn: 'project', roadmap: 'project', agenda: 'afspraak'
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
}

function saveProject() {
  const repoNorm = normalizeGithubRepo(v('p-github'));
  const prev = editId ? (db.projecten.find(p=>p.id===editId) || {}) : {};
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
    note: v('f-note')
  };
  if (!obj.num || !obj.klantId) { toast('❌ Vul nummer en klant in'); return; }
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

function v(id) { return (document.getElementById(id)||{}).value || ''; }

function upsert(col, obj) {
  const idx = db[col].findIndex(r => r.id === obj.id);
  if (idx >= 0) db[col][idx] = obj;
  else db[col].unshift(obj);
  save();
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
function del(col, id) {
  if (!confirm('Verwijderen?')) return;
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
    hoog: 'badge-red', normaal: 'badge-gray', laag: 'badge-blue'
  };
  return `<span class="badge ${map[s]||'badge-gray'}">${s}</span>`;
}

// ─── RENDER ───────────────────────────────────────────────────────────────────
function render() {
  updateBadges();
  if (currentPage === 'dashboard') renderDashboard();
  if (currentPage === 'klanten') renderKlanten();
  if (currentPage === 'projecten') renderProjecten();
  if (currentPage === 'taken') renderTaken();
  if (currentPage === 'facturen') renderFacturen();
  if (currentPage === 'tijdlijn') renderTijdlijn();
  if (currentPage === 'roadmap') renderRoadmap();
  if (currentPage === 'apilog') renderApi();
  if (currentPage === 'todo') renderTodoPage();
  if (currentPage === 'meetings') renderMeetingsSidebar();
  if (currentPage === 'agenda') {
    renderCalendar();
    renderAgendaDayList();
    renderAgendaUpcoming();
  }
}

function updateBadges() {
  document.getElementById('badge-klanten').textContent = db.klanten.length;
  document.getElementById('badge-projecten').textContent = db.projecten.filter(p=>p.status==='actief').length;
  document.getElementById('badge-taken').textContent = db.taken.filter(t=>!t.done).length;
  const openTodo = db.todoLists.reduce((s,l)=>(l.items||[]).filter(i=>!i.done).length+s,0);
  document.getElementById('badge-todo').textContent = openTodo || '';
  document.getElementById('badge-meetings').textContent = db.meetings.length || '';
}

function renderDashboard() {
  document.getElementById('stat-klanten').textContent = db.klanten.length;
  document.getElementById('stat-projecten').textContent = db.projecten.filter(p=>p.status==='actief').length;
  document.getElementById('stat-taken').textContent = db.taken.filter(t=>!t.done).length;
  const open = db.facturen.filter(f=>f.status==='openstaand').reduce((s,f)=>s+(f.totaal||0),0);
  document.getElementById('stat-facturen').textContent = '€' + open.toLocaleString('nl-BE', {minimumFractionDigits:0});

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

function renderKlanten(data) {
  const rows = (data || db.klanten).map(k => {
    const np = db.projecten.filter(p=>p.klantId===k.id).length;
    return `<tr onclick="openKlantDetail('${k.id}')">
      <td><strong>${k.voornaam} ${k.achternaam}</strong></td>
      <td>${k.bedrijf || '—'}</td>
      <td class="td-mono">${k.email || '—'}</td>
      <td>${statusBadge(k.status)}</td>
      <td>${k.sector || '—'}</td>
      <td><span class="badge badge-gray">${np}</span></td>
      <td class="td-mono">${fmt(k.datum)}</td>
    </tr>`;
  });
  document.getElementById('klanten-tbody').innerHTML = rows.join('') ||
    `<tr><td colspan="7"><div class="empty"><div class="empty-icon">◈</div><div class="empty-text">Geen klanten gevonden</div><div class="empty-sub">Klik op + Toevoegen</div></div></td></tr>`;
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
    `<div class="empty" style="grid-column:1/-1"><div class="empty-icon">◇</div><div class="empty-text">Geen projecten</div></div>`;
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
    `<div class="empty"><div class="empty-icon">○</div><div class="empty-text">Geen taken</div></div>`;
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
      <td><button class="btn btn-ghost" style="padding:3px 8px;font-size:11px" onclick="event.stopPropagation();del('facturen','${f.id}')">✕</button></td>
    </tr>`;
  });
  document.getElementById('facturen-tbody').innerHTML = rows.join('') ||
    `<tr><td colspan="11"><div class="empty"><div class="empty-icon">📄</div><div class="empty-text">Geen facturen gevonden</div></div></td></tr>`;
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
    <div style="display:flex;gap:8px;margin-top:16px">
      <button class="btn btn-primary" onclick="changeFactuurStatus('${id}','betaald')">✓ Betaald</button>
      <button class="btn btn-ghost" onclick="changeFactuurStatus('${id}','vervallen')">Vervallen</button>
      <button class="btn btn-danger" onclick="del('facturen','${id}')">Verwijder</button>
    </div>`;
  openDetail();
}

function changeFactuurStatus(id, status) {
  const f = db.facturen.find(f=>f.id===id);
  if (f) { f.status = status; save(); closeDetail(); render(); toast('✓ Status bijgewerkt'); }
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
  document.querySelector('.proj-arch-tab').classList.add('active');
  document.querySelectorAll('.proj-arch-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('arch-panel-overview').classList.add('active');

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
  btn.classList.add('active');
  document.querySelectorAll('.proj-arch-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('arch-panel-'+tab).classList.add('active');
  const id = currentArchProjectId;
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
    </div>`;

  document.getElementById('arch-details').innerHTML = `
    ${rowArch('Status', statusBadge(p.status))}
    ${rowArch('Klant', klantNaam(p.klantId))}
    ${rowArch('Start', fmt(p.start)||'—')}
    ${rowArch('Deadline', fmt(p.deadline)||'—')}
    ${rowArch('Budget', p.budget?'€'+parseFloat(p.budget).toLocaleString('nl-BE'):'—')}
    ${rowArch('Tags', (p.tags||[]).map(t=>`<span class="tag">${t}</span>`).join(' ')||'—')}
    ${rowArch('Beschrijving', p.desc||'—')}
    <div style="padding:12px 16px;display:flex;gap:8px">
      <button class="btn btn-primary" onclick="switchArchTab('kanban',document.querySelectorAll('.proj-arch-tab')[1])">Open Kanban</button>
      <button class="btn btn-ghost" onclick="switchArchTab('roadmap',document.querySelectorAll('.proj-arch-tab')[2])">Roadmap</button>
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

function addKanbanCard(pid, col) {
  const naam = prompt('Taaknaam:'); if(!naam) return;
  const desc = prompt('Beschrijving (optioneel):') || '';
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

function addArchMilestone() {
  const id = currentArchProjectId;
  const naam = prompt('Naam van de mijlpaal:'); if(!naam) return;
  const datum = prompt('Deadline (YYYY-MM-DD, optioneel):') || '';
  const desc = prompt('Beschrijving (optioneel):') || '';
  db.roadmaps[id].push({ naam, datum, desc, status:'open', items:[], _open:true });
  save(); renderArchRoadmap(id);
}
function delArchMs(mi) {
  if(!confirm('Verwijderen?')) return;
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

function addTijdlijnEvent() {
  const id = currentArchProjectId;
  const naam = prompt('Event naam:'); if(!naam) return;
  const datum = prompt('Datum (YYYY-MM-DD):') || today();
  const desc = prompt('Beschrijving (optioneel):') || '';
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

function addTechItem() {
  const id = currentArchProjectId;
  const naam = prompt('Technologie / Tool:'); if(!naam) return;
  const cat = prompt('Categorie (frontend/backend/database/devops/api/design/testing/other):') || 'other';
  const versie = prompt('Versie (optioneel):') || '';
  const note = prompt('Notitie (optioneel):') || '';
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
        <div class="file-meta">${b.type||'link'} ${b.datum?'· '+fmt(b.datum):''}</div>
        ${b.note?`<div style="font-size:11px;color:var(--text2);margin-top:2px">${b.note}</div>`:''}
      </div>
      ${b.url?`<a href="${b.url}" target="_blank" class="btn btn-ghost" style="padding:4px 10px;font-size:12px">Openen</a>`:''}
      <button onclick="delBestand(${i})" class="btn btn-ghost" style="padding:4px 8px;font-size:12px;color:var(--text3)">✕</button>
    </div>`).join('') :
    `<div class="empty"><div class="empty-icon">📁</div><div class="empty-text">Nog geen bestanden of links</div></div>`;
}

function addBestand() {
  const id = currentArchProjectId;
  const naam = prompt('Naam / beschrijving:'); if(!naam) return;
  const url = prompt('URL / link (optioneel):') || '';
  const type = prompt('Type (pdf/figma/github/drive/notion/link/other):') || 'link';
  const note = prompt('Notitie (optioneel):') || '';
  if (!db.arch[id]) db.arch[id] = { kanban:{todo:[],inprogress:[],review:[],done:[]}, tech:[], bestanden:[], tijdlijn:[], notities:'' };
  db.arch[id].bestanden.push({ naam, url, type, note, datum:today() });
  save(); renderArchBestanden(id);
}
function delBestand(i) {
  db.arch[currentArchProjectId].bestanden.splice(i,1);
  save(); renderArchBestanden(currentArchProjectId);
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
}

// ─── EXPORT / IMPORT ─────────────────────────────────────────────────────────
function exportData() {
  const blob = new Blob([JSON.stringify(db, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'mijncrm-backup-' + today() + '.json';
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
      if (data.klanten || data.projecten) {
        db = data;
        ['klanten','projecten','taken','facturen','apis','afspraken'].forEach(k => {
          if (!Array.isArray(db[k])) db[k] = [];
        });
        if (!db.roadmaps) db.roadmaps = {};
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

function openFacModal() {
  facLines = [{ omschrijving: '', aantal: 1, prijs: 0, subtotaal: 0 }];
  renderFacLines();
  updateFacTotals();
  populateKlantSelects();
  populateProjectSelect();
  // Set default datum & vervaldag
  const d = document.getElementById('f-datum');
  if (d && !d.value) d.value = today();
  calcVervaldag();
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

function updateFactuurType() {
  const t = v('f-type');
  const vRow = document.getElementById('f-voorschot-row');
  const vtRow = document.getElementById('f-voorschot-type-row');
  if (vRow) vRow.style.display = t === 'voorschot' ? 'flex' : 'none';
  if (vtRow) vtRow.style.display = t === 'voorschot' ? 'flex' : 'none';
  const title = document.getElementById('modal-factuur-title');
  const labels = { factuur:'Nieuwe factuur', voorschot:'Nieuwe voorschotfactuur', creditnota:'Nieuwe creditnota', offerte:'Nieuw offerte', 'pro-forma':'Pro-forma factuur' };
  if (title) title.textContent = labels[t] || 'Nieuw document';
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

function addMilestone() {
  const pid = document.getElementById('rm-project-select').value;
  if (!pid) return;
  if (!db.roadmaps) db.roadmaps = {};
  if (!db.roadmaps[pid]) db.roadmaps[pid] = [];

  const naam = prompt('Naam van de mijlpaal:');
  if (!naam) return;
  const datum = prompt('Deadline (YYYY-MM-DD, optioneel):') || '';
  const desc = prompt('Beschrijving (optioneel):') || '';

  db.roadmaps[pid].push({ naam, datum, desc, status: 'open', items: [], _open: true });
  save();
  renderRoadmap();
  toast('✓ Mijlpaal toegevoegd');
}

function delMilestone(mi) {
  const pid = document.getElementById('rm-project-select').value;
  if (!confirm('Mijlpaal verwijderen?')) return;
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
  document.getElementById('meeting-main').innerHTML = `<div class="meeting-empty"><div class="meeting-empty-icon">📋</div><div style="font-size:14px;font-weight:700;color:var(--text2)">Selecteer een vergadering</div><button class="btn btn-primary" style="margin-top:16px" onclick="addMeeting()">+ Nieuwe vergadering</button></div>`;
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

function setBottomNav(btn) {
  document.querySelectorAll('.bottom-nav-item').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
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

// ─── INIT ─────────────────────────────────────────────────────────────────────
load();
render();
