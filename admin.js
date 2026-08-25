/* ============================================================
   SCENTIQUE — admin.js
   1.  Imports, state, helpers
   2.  Auth
   3.  Data loading + realtime
   4.  Router
   5.  Dashboard (KPIs + charts)
   6.  Charts (hand-drawn on canvas)
   7.  Orders
   8.  Order detail drawer
   9.  Reviews
   10. Trash
   11. Settings
   12. Boot
   ============================================================ */

import {
  supabase, STORE, loadSettings,
  money, esc, waLink, normalisePhone,
  uploadImage, deleteImage
} from './supabase.js';

/* ---------- 1. STATE & HELPERS ---------- */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const state = {
  view: 'dashboard',
  orders: [],       // live orders (deleted_at is null)
  trashed: [],      // soft-deleted orders
  reviews: [],
  trashedReviews: [],
  products: [],
  trashedProducts: [],
  settings: {},
  filter: { status: 'all', search: '', source: 'all' }
};

const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];

const fmtDate = iso => new Date(iso).toLocaleString('en-PK', {
  day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit'
});

const fmtDay = iso => new Date(iso).toLocaleDateString('en-PK', {
  day: '2-digit', month: 'short'
});

let toastTimer;
function toast(msg){
  const el = $('#aToast');
  el.textContent = msg;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2600);
}

async function logActivity(entity, entityId, action, detail){
  try{
    await supabase.from('perfumeswebsite_activity')
      .insert({ entity, entity_id: entityId, action, detail });
  }catch(e){ /* the log is a convenience, never a blocker */ }
}

/* ---------- 2. AUTH ----------
   Simple mode: the username and password are checked here in the
   browser. There is no Supabase Auth user involved.

   ⚠ This is a gate, not a lock. Both values below are readable by
   anyone who opens this file in developer tools, and the database
   policies (setup-simple-login.sql) let the public key read orders.
   Change ADMIN_USER / ADMIN_PASS here whenever you like.
------------------------------------ */
const ADMIN_USER = 'abubakar';
const ADMIN_PASS = '@bubakar';
const SESSION_KEY = 'scentique.admin';

function isSignedIn(){
  try{ return sessionStorage.getItem(SESSION_KEY) === 'yes'; }
  catch(e){ return false; }
}

async function signIn(){
  const user = $('#liUser').value.trim().toLowerCase();
  /* Phone keyboards capitalise the letter after "@" and autocomplete
     often leaves a trailing space, so trim before comparing. */
  const pass = $('#liPass').value.trim();
  const btn  = $('#loginBtn');

  $('#loginError').hidden = true;

  if(user !== ADMIN_USER){
    showLoginError(`Wrong username. It should be <b>${esc(ADMIN_USER)}</b>.`);
    $('#liUser').focus();
    return;
  }

  if(pass !== ADMIN_PASS){
    /* Case is the usual culprit — say so instead of just "wrong". */
    const nearMiss = pass.toLowerCase() === ADMIN_PASS.toLowerCase();
    showLoginError(nearMiss
      ? 'Almost — the password is all lowercase. Your keyboard may have capitalised a letter.'
      : 'Wrong password.');
    $('#liPass').value = '';
    $('#liPass').focus();
    return;
  }

  if(btn.disabled) return;
  btn.disabled = true;
  btn.textContent = 'Signing in…';

  /* Confirm the database is actually reachable before showing an
     empty dashboard and leaving you guessing. */
  const check = await testConnection();

  btn.disabled = false;
  btn.textContent = 'Sign In';

  if(!check.ok){
    showLoginError(`Signed in, but the database is unreachable — ${esc(check.message)}<br><br>
      Run <b>setup.sql</b> and then <b>setup-simple-login.sql</b> in the
      Supabase SQL editor, and check the URL and key in <b>supabase.js</b>.`);
    return;
  }

  try{ sessionStorage.setItem(SESSION_KEY, 'yes'); }catch(e){}
  enterApp();
}

function showLoginError(html){
  const err = $('#loginError');
  err.innerHTML = html;
  err.hidden = false;
}

/* A read anon is allowed to do, so a failure means the project, key
   or schema is wrong — not the password. */
async function testConnection(){
  try{
    const { error } = await supabase
      .from('perfumeswebsite_settings')
      .select('key')
      .limit(1);

    if(error){
      if(error.code === '42P01' || error.message.includes('does not exist')){
        return { ok: false, message: 'the perfumeswebsite_ tables are missing (run setup.sql)' };
      }
      if(error.code === '42501' || error.message.toLowerCase().includes('policy')){
        return { ok: false, message: 'blocked by row level security (run setup-simple-login.sql)' };
      }
      return { ok: false, message: error.message };
    }
    return { ok: true };
  }catch(e){
    return { ok: false, message: e.message || 'network error' };
  }
}

function signOut(){
  try{ sessionStorage.removeItem(SESSION_KEY); }catch(e){}
  location.reload();
}

function enterApp(){
  $('#loginView').hidden = true;
  $('#appView').hidden = false;
  bootApp();
}

/* ---------- 3. DATA ---------- */
async function fetchAll(){
  const [ordersRes, reviewsRes, settingsRes, productsRes] = await Promise.all([
    supabase.from('perfumeswebsite_orders')
      .select('*, perfumeswebsite_order_items(*)')
      .order('created_at', { ascending: false }),
    supabase.from('perfumeswebsite_reviews')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase.from('perfumeswebsite_settings').select('*'),
    supabase.from('perfumeswebsite_products')
      .select('*')
      .order('sort_order', { ascending: true })
  ]);

  if(ordersRes.error) console.error(ordersRes.error);

  const orders = ordersRes.data || [];
  state.orders  = orders.filter(o => !o.deleted_at);
  state.trashed = orders.filter(o =>  o.deleted_at);

  const reviews = reviewsRes.data || [];
  state.reviews        = reviews.filter(r => !r.deleted_at);
  state.trashedReviews = reviews.filter(r =>  r.deleted_at);

  const products = productsRes.data || [];
  state.products        = products.filter(p => !p.deleted_at);
  state.trashedProducts = products.filter(p =>  p.deleted_at);

  state.settings = Object.fromEntries((settingsRes.data || []).map(r => [r.key, r.value]));

  paintBadges();
}

function paintBadges(){
  const pending = state.orders.filter(o => o.status === 'pending').length;
  const unapproved = state.reviews.filter(r => !r.approved).length;

  const bp = $('#badgePending');
  const br = $('#badgeReviews');
  bp.textContent = pending;
  bp.dataset.zero = pending === 0 ? '1' : '0';
  br.textContent = unapproved;
  br.dataset.zero = unapproved === 0 ? '1' : '0';
}

let realtimeChannel = null;

function initRealtime(){
  /* A channel can only take listeners before subscribe(), so tear down
     any previous one instead of adding to it. */
  if(realtimeChannel){
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  realtimeChannel = supabase
    .channel('perfumeswebsite-admin-' + Date.now())
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'perfumeswebsite_orders' },
      async payload => {
        await fetchAll();
        render();
        if(payload.eventType === 'INSERT'){
          toast(`New order — ${payload.new.ref}`);
        }
      })
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'perfumeswebsite_reviews' },
      async () => { await fetchAll(); render(); })
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'perfumeswebsite_products' },
      async () => { await fetchAll(); render(); })
    .subscribe(status => {
      $('#liveDot').classList.toggle('is-off', status !== 'SUBSCRIBED');
    });
}

/* ---------- 4. ROUTER ---------- */
const TITLES = {
  dashboard: 'Dashboard',
  products: 'Products',
  orders: 'Orders',
  reviews: 'Reviews',
  trash: 'Trash',
  settings: 'Settings'
};

function go(view){
  state.view = view;
  $('#viewTitle').textContent = TITLES[view];
  $$('.side-link').forEach(b => b.classList.toggle('is-active', b.dataset.view === view));
  $('#side').classList.remove('is-open');
  render();
}

function render(){
  const host = $('#views');
  if(state.view === 'dashboard') return renderDashboard(host);
  if(state.view === 'products')  return renderProducts(host);
  if(state.view === 'orders')    return renderOrders(host);
  if(state.view === 'reviews')   return renderReviews(host);
  if(state.view === 'trash')     return renderTrash(host);
  if(state.view === 'settings')  return renderSettings(host);
}

/* ---------- 5. DASHBOARD ---------- */
function renderDashboard(host){
  const live = state.orders.filter(o => o.status !== 'cancelled');
  const revenue = live.reduce((s, o) => s + o.total, 0);

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const today = live.filter(o => new Date(o.created_at) >= startOfDay);

  const last7 = live.filter(o => new Date(o.created_at) >= new Date(Date.now() - 7 * 864e5));
  const prev7 = live.filter(o => {
    const t = new Date(o.created_at).getTime();
    return t >= Date.now() - 14 * 864e5 && t < Date.now() - 7 * 864e5;
  });

  const rev7 = last7.reduce((s, o) => s + o.total, 0);
  const revPrev = prev7.reduce((s, o) => s + o.total, 0);
  const delta = revPrev === 0 ? (rev7 > 0 ? 100 : 0) : Math.round(((rev7 - revPrev) / revPrev) * 100);

  const avg = live.length ? Math.round(revenue / live.length) : 0;
  const pending = state.orders.filter(o => o.status === 'pending').length;

  host.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi">
        <p class="kpi-label">Revenue (all time)</p>
        <p class="kpi-value">${money(revenue)}</p>
        <p class="kpi-sub">${live.length} order${live.length === 1 ? '' : 's'} counted</p>
      </div>
      <div class="kpi">
        <p class="kpi-label">Last 7 days</p>
        <p class="kpi-value">${money(rev7)}</p>
        <p class="kpi-sub ${delta >= 0 ? 'is-up' : 'is-down'}">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}% vs previous week</p>
      </div>
      <div class="kpi">
        <p class="kpi-label">Awaiting confirmation</p>
        <p class="kpi-value">${pending}</p>
        <p class="kpi-sub">${today.length} placed today</p>
      </div>
      <div class="kpi">
        <p class="kpi-label">Average order</p>
        <p class="kpi-value">${money(avg)}</p>
        <p class="kpi-sub">${state.reviews.filter(r => !r.approved).length} review(s) to approve</p>
      </div>
    </div>

    <div class="chart-grid">
      <div class="a-card">
        <div class="a-card-head">
          <h2>Revenue, last 14 days</h2>
          <span>Cancelled orders excluded</span>
        </div>
        <div class="chart-box"><canvas id="revChart"></canvas></div>
      </div>

      <div class="a-card">
        <div class="a-card-head"><h2>Orders by status</h2></div>
        <div class="chart-box"><canvas id="statusChart"></canvas></div>
        <div class="legend" id="statusLegend"></div>
      </div>
    </div>

    <div class="chart-grid">
      <div class="a-card">
        <div class="a-card-head">
          <h2>Best sellers</h2>
          <span>By units sold</span>
        </div>
        <div class="bar-list" id="topProducts"></div>
      </div>

      <div class="a-card">
        <div class="a-card-head">
          <h2>Where orders come from</h2>
        </div>
        <div class="bar-list" id="cityList"></div>
      </div>
    </div>

    <div class="a-card" style="margin-top:16px">
      <div class="a-card-head">
        <h2>Latest orders</h2>
        <span><button class="a-mini" data-goto="orders">See all</button></span>
      </div>
      <div class="a-table-wrap">
        ${ordersTable(state.orders.slice(0, 6))}
      </div>
    </div>`;

  drawRevenueChart(live);
  drawStatusChart();
  drawTopProducts(live);
  drawCities(live);

  $('[data-goto]')?.addEventListener('click', () => go('orders'));
  wireOrderRows();
}

/* ---------- 6. CHARTS ---------- */
/* Canvas sized for the device pixel ratio so lines stay crisp. */
function prepCanvas(canvas){
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, w: rect.width, h: rect.height };
}

function drawRevenueChart(orders){
  const canvas = $('#revChart');
  if(!canvas) return;
  const { ctx, w, h } = prepCanvas(canvas);

  /* bucket the last 14 days */
  const days = [];
  for(let i = 13; i >= 0; i--){
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push({ date: d, total: 0 });
  }

  orders.forEach(o => {
    const t = new Date(o.created_at);
    t.setHours(0, 0, 0, 0);
    const slot = days.find(d => d.date.getTime() === t.getTime());
    if(slot) slot.total += o.total;
  });

  const max = Math.max(1000, ...days.map(d => d.total));
  const padL = 54, padR = 12, padT = 16, padB = 30;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const x = i => padL + (plotW / (days.length - 1)) * i;
  const y = v => padT + plotH - (v / max) * plotH;

  ctx.clearRect(0, 0, w, h);

  /* horizontal gridlines + axis labels */
  ctx.font = '11px Lato, sans-serif';
  ctx.fillStyle = '#a8a49c';
  ctx.strokeStyle = '#eceae6';
  ctx.lineWidth = 1;

  for(let g = 0; g <= 3; g++){
    const val = (max / 3) * g;
    const gy = y(val);
    ctx.beginPath();
    ctx.moveTo(padL, gy);
    ctx.lineTo(w - padR, gy);
    ctx.stroke();
    ctx.textAlign = 'right';
    ctx.fillText(val >= 1000 ? Math.round(val / 1000) + 'k' : Math.round(val), padL - 10, gy + 4);
  }

  /* area fill */
  const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
  grad.addColorStop(0, 'rgba(212,175,55,.26)');
  grad.addColorStop(1, 'rgba(212,175,55,0)');

  ctx.beginPath();
  ctx.moveTo(x(0), y(days[0].total));
  days.forEach((d, i) => ctx.lineTo(x(i), y(d.total)));
  ctx.lineTo(x(days.length - 1), padT + plotH);
  ctx.lineTo(x(0), padT + plotH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  /* the line itself */
  ctx.beginPath();
  days.forEach((d, i) => i === 0 ? ctx.moveTo(x(i), y(d.total)) : ctx.lineTo(x(i), y(d.total)));
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.stroke();

  /* points */
  days.forEach((d, i) => {
    ctx.beginPath();
    ctx.arc(x(i), y(d.total), 3, 0, Math.PI * 2);
    ctx.fillStyle = d.total > 0 ? '#17171a' : '#d8d5cf';
    ctx.fill();
  });

  /* day labels, every other one to avoid crowding */
  ctx.fillStyle = '#a8a49c';
  ctx.textAlign = 'center';
  days.forEach((d, i) => {
    if(i % 3 !== 0 && i !== days.length - 1) return;
    ctx.fillText(fmtDay(d.date), x(i), h - 10);
  });
}

function drawStatusChart(){
  const canvas = $('#statusChart');
  if(!canvas) return;
  const { ctx, w, h } = prepCanvas(canvas);

  const colors = {
    pending: '#b57e10',
    confirmed: '#2c5f8a',
    completed: '#1f7a5c',
    cancelled: '#b5372b'
  };

  const counts = STATUSES.map(s => ({
    key: s,
    n: state.orders.filter(o => o.status === s).length
  }));
  const total = counts.reduce((a, b) => a + b.n, 0);

  ctx.clearRect(0, 0, w, h);

  const cx = w / 2, cy = h / 2;
  const r = Math.min(w, h) / 2 - 14;
  const inner = r * 0.62;

  if(total === 0){
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#eceae6';
    ctx.lineWidth = r - inner;
    ctx.stroke();
  }else{
    let start = -Math.PI / 2;
    counts.forEach(c => {
      if(c.n === 0) return;
      const angle = (c.n / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, (r + inner) / 2, start, start + angle);
      ctx.strokeStyle = colors[c.key];
      ctx.lineWidth = r - inner;
      ctx.stroke();
      start += angle;
    });
  }

  /* centre label */
  ctx.fillStyle = '#17171a';
  ctx.textAlign = 'center';
  ctx.font = '400 26px "Playfair Display", serif';
  ctx.fillText(String(total), cx, cy + 4);
  ctx.font = '10px Lato, sans-serif';
  ctx.fillStyle = '#a8a49c';
  ctx.fillText('ORDERS', cx, cy + 22);

  $('#statusLegend').innerHTML = counts.map(c =>
    `<span><i style="background:${colors[c.key]}"></i>${c.key} · ${c.n}</span>`).join('');
}

function drawTopProducts(orders){
  const host = $('#topProducts');
  if(!host) return;

  const tally = {};
  orders.forEach(o => (o.perfumeswebsite_order_items || []).forEach(it => {
    tally[it.product_name] = (tally[it.product_name] || 0) + it.qty;
  }));

  const rows = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if(rows.length === 0){
    host.innerHTML = '<p class="cell-muted">No sales recorded yet.</p>';
    return;
  }

  const max = rows[0][1];
  host.innerHTML = rows.map(([name, n]) => `
    <div class="bar-row">
      <span>${esc(name)}</span>
      <span class="cell-muted">${n} sold</span>
      <div class="bar-track"><div class="bar-fill" data-w="${(n / max) * 100}"></div></div>
    </div>`).join('');

  requestAnimationFrame(() =>
    $$('#topProducts .bar-fill').forEach(b => { b.style.width = b.dataset.w + '%'; }));
}

function drawCities(orders){
  const host = $('#cityList');
  if(!host) return;

  const tally = {};
  orders.forEach(o => {
    const city = (o.city || 'Unknown').trim();
    tally[city] = (tally[city] || 0) + 1;
  });

  const rows = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if(rows.length === 0){
    host.innerHTML = '<p class="cell-muted">No orders yet.</p>';
    return;
  }

  const max = rows[0][1];
  host.innerHTML = rows.map(([city, n]) => `
    <div class="bar-row">
      <span>${esc(city)}</span>
      <span class="cell-muted">${n} order${n === 1 ? '' : 's'}</span>
      <div class="bar-track"><div class="bar-fill" data-w="${(n / max) * 100}"></div></div>
    </div>`).join('');

  requestAnimationFrame(() =>
    $$('#cityList .bar-fill').forEach(b => { b.style.width = b.dataset.w + '%'; }));
}

/* ---------- 7. ORDERS ---------- */
function ordersTable(list, { trash = false } = {}){
  if(list.length === 0){
    return `<p class="a-empty">${trash ? 'Trash is empty.' : 'No orders match this filter.'}</p>`;
  }

  return `
    <table class="a-table">
      <thead>
        <tr>
          <th>Ref</th>
          <th>Customer</th>
          <th>City</th>
          <th>Items</th>
          <th class="cell-num">Total</th>
          <th>Status</th>
          <th>Placed</th>
          <th class="cell-actions">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(o => {
          const items = o.perfumeswebsite_order_items || [];
          const units = items.reduce((s, i) => s + i.qty, 0);
          return `
            <tr data-order="${o.id}">
              <td class="cell-ref">${esc(o.ref)}</td>
              <td>
                ${esc(o.customer_name)}
                <div class="cell-muted">${esc(o.phone)}</div>
              </td>
              <td>${esc(o.city)}</td>
              <td class="cell-muted">${units} unit${units === 1 ? '' : 's'}</td>
              <td class="cell-num">${money(o.total)}</td>
              <td><span class="tag tag-${o.status}">${o.status}</span></td>
              <td class="cell-muted">${fmtDate(o.created_at)}</td>
              <td class="cell-actions">
                ${trash
                  ? `<button class="a-mini is-go" data-restore="${o.id}">Restore</button>
                     <button class="a-mini is-danger" data-purge="${o.id}">Delete forever</button>`
                  : `<button class="a-mini" data-open="${o.id}">Open</button>
                     ${o.status !== 'completed'
                       ? `<button class="a-mini is-go" data-complete="${o.id}">Complete</button>` : ''}
                     <button class="a-mini is-danger" data-trash="${o.id}">Trash</button>`}
              </td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

function filteredOrders(){
  const { status, search, source } = state.filter;
  const q = search.toLowerCase();

  return state.orders.filter(o => {
    if(status !== 'all' && o.status !== status) return false;
    if(source !== 'all' && o.source !== source) return false;
    if(!q) return true;
    return [o.ref, o.customer_name, o.phone, o.city, o.address]
      .join(' ').toLowerCase().includes(q);
  });
}

function renderOrders(host){
  host.innerHTML = `
    <div class="table-tools">
      <input id="fSearch" type="search" placeholder="Search ref, name, phone, city…" value="${esc(state.filter.search)}">
      <select id="fStatus">
        <option value="all">All statuses</option>
        ${STATUSES.map(s => `<option value="${s}" ${state.filter.status === s ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
      <select id="fSource">
        <option value="all">All sources</option>
        <option value="website"  ${state.filter.source === 'website'  ? 'selected' : ''}>Website</option>
        <option value="whatsapp" ${state.filter.source === 'whatsapp' ? 'selected' : ''}>WhatsApp</option>
      </select>
      <button class="a-btn a-btn-ghost" id="exportBtn">Export CSV</button>
    </div>

    <div class="a-table-wrap">${ordersTable(filteredOrders())}</div>`;

  $('#fSearch').addEventListener('input', e => {
    state.filter.search = e.target.value;
    $('.a-table-wrap').innerHTML = ordersTable(filteredOrders());
    wireOrderRows();
  });

  $('#fStatus').addEventListener('change', e => { state.filter.status = e.target.value; renderOrders(host); });
  $('#fSource').addEventListener('change', e => { state.filter.source = e.target.value; renderOrders(host); });
  $('#exportBtn').addEventListener('click', exportCsv);

  wireOrderRows();
}

function wireOrderRows(){
  $$('[data-open]').forEach(b => b.addEventListener('click', () => openOrder(b.dataset.open)));
  $$('[data-complete]').forEach(b => b.addEventListener('click', () => setStatus(b.dataset.complete, 'completed')));
  $$('[data-trash]').forEach(b => b.addEventListener('click', () => trashOrder(b.dataset.trash)));
  $$('[data-restore]').forEach(b => b.addEventListener('click', () => restoreOrder(b.dataset.restore)));
  $$('[data-purge]').forEach(b => b.addEventListener('click', () => purgeOrder(b.dataset.purge)));
}

async function setStatus(id, status){
  const { error } = await supabase
    .from('perfumeswebsite_orders')
    .update({ status })
    .eq('id', id);

  if(error){ toast('Update failed'); return; }

  logActivity('order', id, 'status', status);
  toast(`Marked ${status}`);
  await fetchAll();
  render();
  if($('#aDrawer').classList.contains('is-open')) openOrder(id);
}

async function trashOrder(id){
  const { error } = await supabase
    .from('perfumeswebsite_orders')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if(error){ toast('Could not move to trash'); return; }

  logActivity('order', id, 'deleted', 'moved to trash');
  toast('Moved to trash');
  closeDrawer();
  await fetchAll();
  render();
}

async function restoreOrder(id){
  const { error } = await supabase
    .from('perfumeswebsite_orders')
    .update({ deleted_at: null })
    .eq('id', id);

  if(error){ toast('Restore failed'); return; }

  logActivity('order', id, 'restored', null);
  toast('Order restored');
  await fetchAll();
  render();
}

async function purgeOrder(id){
  if(!confirm('Delete this order permanently? This cannot be undone.')) return;

  const { error } = await supabase
    .from('perfumeswebsite_orders')
    .delete()
    .eq('id', id);

  if(error){ toast('Delete failed'); return; }

  toast('Deleted permanently');
  await fetchAll();
  render();
}

function exportCsv(){
  const rows = filteredOrders();
  if(rows.length === 0){ toast('Nothing to export'); return; }

  const head = ['Ref','Name','Phone','City','Address','Items','Subtotal','Shipping','Total','Status','Source','Placed'];
  const csv = [head.join(',')].concat(rows.map(o => {
    const items = (o.perfumeswebsite_order_items || [])
      .map(i => `${i.product_name} x${i.qty}`).join(' | ');
    return [
      o.ref, o.customer_name, o.phone, o.city, o.address, items,
      o.subtotal, o.shipping, o.total, o.status, o.source,
      new Date(o.created_at).toISOString()
    ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
  })).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `scentique-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------- 8. ORDER DETAIL DRAWER ---------- */
function openDrawer(title, html){
  $('#aDrawerTitle').textContent = title;
  $('#aDrawerBody').innerHTML = html;
  $('#aDrawer').classList.add('is-open');
  $('#aDrawer').setAttribute('aria-hidden', 'false');
  const scrim = $('#aScrim');
  scrim.hidden = false;
  requestAnimationFrame(() => scrim.classList.add('is-visible'));
}

function closeDrawer(){
  $('#aDrawer').classList.remove('is-open');
  $('#aDrawer').setAttribute('aria-hidden', 'true');
  const scrim = $('#aScrim');
  scrim.classList.remove('is-visible');
  setTimeout(() => { scrim.hidden = true; }, 350);
}

function confirmationMessage(order){
  return [
    `*${STORE.name} — order confirmed*`,
    '',
    `Assalam o Alaikum ${order.customer_name},`,
    `Your order *${order.ref}* is confirmed.`,
    '',
    ...(order.perfumeswebsite_order_items || [])
      .map(i => `• ${i.product_name} × ${i.qty} — ${money(i.line_total)}`),
    '',
    `Total: ${money(order.total)} (cash on delivery)`,
    `Shipping to: ${order.city}`,
    '',
    'We are dispatching it by courier and will share the tracking number shortly.',
    'Thank you for choosing us.'
  ].join('\n');
}

function openOrder(id){
  const o = [...state.orders, ...state.trashed].find(x => x.id === id);
  if(!o) return;

  const items = o.perfumeswebsite_order_items || [];

  openDrawer(o.ref, `
    <dl>
      <div class="detail-row"><dt>Status</dt><dd><span class="tag tag-${o.status}">${o.status}</span></dd></div>
      <div class="detail-row"><dt>Placed</dt><dd>${fmtDate(o.created_at)}</dd></div>
      <div class="detail-row"><dt>Source</dt><dd><span class="tag tag-${o.source}">${o.source}</span></dd></div>
      <div class="detail-row"><dt>Customer</dt><dd>${esc(o.customer_name)}</dd></div>
      <div class="detail-row"><dt>Phone</dt><dd><a href="tel:${esc(o.phone)}">${esc(o.phone)}</a></dd></div>
      <div class="detail-row"><dt>City</dt><dd>${esc(o.city)}</dd></div>
      <div class="detail-row"><dt>Address</dt><dd>${esc(o.address)}</dd></div>
      ${o.note ? `<div class="detail-row"><dt>Note</dt><dd>${esc(o.note)}</dd></div>` : ''}
    </dl>

    <div class="detail-items">
      ${items.map(i => `
        <div class="detail-item">
          <span>${esc(i.product_name)} <span class="cell-muted">${esc(i.size || '')} × ${i.qty}</span></span>
          <span>${money(i.line_total)}</span>
        </div>`).join('')}
      <div class="detail-item"><span>Subtotal</span><span>${money(o.subtotal)}</span></div>
      <div class="detail-item"><span>Delivery</span><span>${o.shipping === 0 ? 'Free' : money(o.shipping)}</span></div>
      <div class="detail-item detail-total"><span>Total</span><span>${money(o.total)}</span></div>
    </div>

    <div class="a-field">
      <label for="dStatus">Change status</label>
      <select id="dStatus">
        ${STATUSES.map(s => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
    </div>

    <div class="drawer-actions">
      <button class="a-btn a-btn-wa" id="dWaConfirm">Send confirmation on WhatsApp</button>
      <button class="a-btn a-btn-ghost" id="dCopy">Copy order details</button>
      ${o.deleted_at
        ? `<button class="a-btn a-btn-primary" id="dRestore">Restore order</button>`
        : `<button class="a-btn a-btn-danger" id="dTrash">Move to trash</button>`}
    </div>`);

  $('#dStatus').addEventListener('change', e => setStatus(o.id, e.target.value));

  $('#dWaConfirm').addEventListener('click', () => {
    window.open(waLink(o.phone, confirmationMessage(o)), '_blank', 'noopener');
    if(o.status === 'pending') setStatus(o.id, 'confirmed');
  });

  $('#dCopy').addEventListener('click', async () => {
    const text = [
      `${o.ref} — ${o.customer_name} (${o.phone})`,
      `${o.address}, ${o.city}`,
      ...items.map(i => `${i.product_name} x${i.qty}`),
      `Total: ${money(o.total)}`
    ].join('\n');
    try{
      await navigator.clipboard.writeText(text);
      toast('Copied');
    }catch(e){ toast('Copy failed'); }
  });

  $('#dTrash')?.addEventListener('click', () => trashOrder(o.id));
  $('#dRestore')?.addEventListener('click', () => { restoreOrder(o.id); closeDrawer(); });
}

/* ---------- 8b. PRODUCTS ---------- */
const slugify = str => String(str).toLowerCase().trim()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // strip accents
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 48);

const BLANK_PRODUCT = {
  id: '', name: '', family: '', price: 0, size: '50 ml',
  conc: 'Eau de Parfum · 24%', lasts: '8–10 hours',
  image: '', images: [],
  description: '', note_top: '', note_heart: '', note_base: '',
  active: true, sort_order: 100
};

const MAX_IMAGES = 5;
/* Images being edited right now. Uploaded straight away so the
   preview is real, then written to the row when you save. */
let draftImages = [];

function renderProducts(host){
  host.innerHTML = `
    <div class="table-tools">
      <input id="pSearch" type="search" placeholder="Search fragrance name or family…">
      <button class="a-btn a-btn-primary" id="addProduct">+ Add Fragrance</button>
    </div>

    <div class="a-table-wrap" id="productTable">${productsTable(state.products)}</div>

    <p class="a-field-hint" style="margin-top:14px">
      Hidden fragrances stay in the database but disappear from the shop.
      Trashed ones can be restored from the Trash tab.
    </p>`;

  $('#addProduct').addEventListener('click', () => editProduct(null));

  $('#pSearch').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    const list = state.products.filter(p =>
      (p.name + ' ' + p.family).toLowerCase().includes(q));
    $('#productTable').innerHTML = productsTable(list);
    wireProductRows();
  });

  wireProductRows();
}

function productsTable(list, { trash = false } = {}){
  if(list.length === 0){
    return `<p class="a-empty">${trash ? 'No trashed fragrances.' : 'No fragrances yet — add your first one.'}</p>`;
  }

  return `
    <table class="a-table">
      <thead>
        <tr>
          <th></th><th>Fragrance</th><th>Family</th>
          <th class="cell-num">Price</th><th>Status</th>
          <th class="cell-actions">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(p => `
          <tr>
            <td>
              <span class="prod-thumb" style="background-image:url('${esc((p.images && p.images[0]) || p.image)}')"></span>
              ${(p.images?.length || 0) > 1 ? `<span class="prod-count">${p.images.length}</span>` : ''}
            </td>
            <td>
              ${esc(p.name)}
              <div class="cell-muted">${esc(p.size)} · ${esc(p.id)}</div>
            </td>
            <td class="cell-muted">${esc(p.family)}</td>
            <td class="cell-num">${money(p.price)}</td>
            <td>
              <span class="tag ${p.active ? 'tag-completed' : 'tag-pending'}">
                ${p.active ? 'live' : 'hidden'}
              </span>
            </td>
            <td class="cell-actions">
              ${trash
                ? `<button class="a-mini is-go" data-restoreprod="${p.id}">Restore</button>
                   <button class="a-mini is-danger" data-purgeprod="${p.id}">Delete forever</button>`
                : `<button class="a-mini" data-editprod="${p.id}">Edit</button>
                   <button class="a-mini" data-toggleprod="${p.id}">${p.active ? 'Hide' : 'Show'}</button>
                   <button class="a-mini is-danger" data-trashprod="${p.id}">Trash</button>`}
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function wireProductRows(){
  $$('[data-editprod]').forEach(b => b.addEventListener('click', () => editProduct(b.dataset.editprod)));
  $$('[data-toggleprod]').forEach(b => b.addEventListener('click', () => toggleProduct(b.dataset.toggleprod)));
  $$('[data-trashprod]').forEach(b => b.addEventListener('click', () => trashProduct(b.dataset.trashprod)));
  $$('[data-restoreprod]').forEach(b => b.addEventListener('click', () => restoreProduct(b.dataset.restoreprod)));
  $$('[data-purgeprod]').forEach(b => b.addEventListener('click', () => purgeProduct(b.dataset.purgeprod)));
}

/** id = null for a new fragrance. */
function editProduct(id){
  const all = [...state.products, ...state.trashedProducts];
  const p = id ? all.find(x => x.id === id) : { ...BLANK_PRODUCT };
  if(!p) return;

  const isNew = !id;

  openDrawer(isNew ? 'New fragrance' : p.name, `
    <div class="a-field">
      <label>Photographs <span class="label-soft">(1 minimum, ${MAX_IMAGES} maximum)</span></label>
      <div class="upload-grid" id="uploadGrid"></div>
      <input type="file" id="imageInput" accept="image/*" multiple hidden>
      <p class="a-field-hint">
        JPG, PNG or WebP up to 5 MB each. A tall photo (3:4) fits the card best.
        The first image is the one shown on the collection page — drag is not needed,
        just remove and re-add to reorder.
      </p>
    </div>

    <div class="a-field">
      <label for="pName">Name</label>
      <input id="pName" type="text" value="${esc(p.name)}" placeholder="Noir Oud">
    </div>

    <div class="a-grid-2">
      <div class="a-field">
        <label for="pFamily">Fragrance family</label>
        <input id="pFamily" type="text" value="${esc(p.family)}" placeholder="Woody Oriental">
      </div>
      <div class="a-field">
        <label for="pPrice">Price (Rs.)</label>
        <input id="pPrice" type="number" min="0" value="${esc(p.price)}">
      </div>
    </div>

    <div class="a-grid-2">
      <div class="a-field">
        <label for="pSize">Bottle size</label>
        <input id="pSize" type="text" value="${esc(p.size)}" placeholder="50 ml">
      </div>
      <div class="a-field">
        <label for="pLasts">Longevity</label>
        <input id="pLasts" type="text" value="${esc(p.lasts)}" placeholder="8–10 hours">
      </div>
    </div>

    <div class="a-field">
      <label for="pConc">Concentration</label>
      <input id="pConc" type="text" value="${esc(p.conc)}" placeholder="Eau de Parfum · 24%">
    </div>

    <div class="a-field">
      <label for="pDesc">Description</label>
      <textarea id="pDesc" rows="5" placeholder="How does it open, settle and dry down?">${esc(p.description)}</textarea>
    </div>

    <div class="a-field">
      <label for="pTop">Top notes</label>
      <input id="pTop" type="text" value="${esc(p.note_top)}" placeholder="Bergamot, Pink Pepper, Saffron">
    </div>
    <div class="a-field">
      <label for="pHeart">Heart notes</label>
      <input id="pHeart" type="text" value="${esc(p.note_heart)}" placeholder="Oud, Rose, Patchouli">
    </div>
    <div class="a-field">
      <label for="pBase">Base notes</label>
      <input id="pBase" type="text" value="${esc(p.note_base)}" placeholder="Leather, Vetiver, Amber">
    </div>

    <div class="a-grid-2">
      <div class="a-field">
        <label for="pActive">Shown on the shop</label>
        <select id="pActive">
          <option value="true"  ${p.active ? 'selected' : ''}>Yes — live</option>
          <option value="false" ${!p.active ? 'selected' : ''}>No — hidden</option>
        </select>
      </div>
      <div class="a-field">
        <label for="pOrder">Sort order</label>
        <input id="pOrder" type="number" value="${esc(p.sort_order)}">
        <p class="a-field-hint">Lower shows first.</p>
      </div>
    </div>

    <p class="login-error" id="pError" hidden></p>

    <div class="drawer-actions">
      <button class="a-btn a-btn-primary" id="pSave">${isNew ? 'Add fragrance' : 'Save changes'}</button>
      ${isNew ? '' : `<button class="a-btn a-btn-danger" id="pTrash">Move to trash</button>`}
    </div>`);

  draftImages = (p.images && p.images.length) ? [...p.images] : (p.image ? [p.image] : []);
  paintUploads();

  $('#imageInput').addEventListener('change', e => handleFiles(e.target.files, id || slugify($('#pName').value) || 'new'));

  $('#pSave').addEventListener('click', () => saveProduct(id));
  $('#pTrash')?.addEventListener('click', () => trashProduct(id));
}

function paintUploads(){
  const grid = $('#uploadGrid');
  if(!grid) return;

  const slots = draftImages.map((src, i) => `
    <div class="upload-item${i === 0 ? ' is-primary' : ''}">
      <span class="upload-thumb" style="background-image:url('${esc(src)}')"></span>
      ${i === 0 ? '<span class="upload-badge">Main</span>' : ''}
      <button class="upload-remove" data-rmimg="${i}" aria-label="Remove image">&times;</button>
    </div>`).join('');

  const adder = draftImages.length < MAX_IMAGES
    ? `<button class="upload-add" id="uploadAdd">
         <span>+</span>
         Add photo
         <em>${draftImages.length}/${MAX_IMAGES}</em>
       </button>`
    : `<p class="upload-full">Maximum of ${MAX_IMAGES} photos reached.</p>`;

  grid.innerHTML = slots + adder;

  $('#uploadAdd')?.addEventListener('click', () => $('#imageInput').click());
  $$('[data-rmimg]').forEach(b => b.addEventListener('click', () => {
    draftImages.splice(Number(b.dataset.rmimg), 1);
    paintUploads();
  }));
}

async function handleFiles(fileList, productId){
  const files = Array.from(fileList || []);
  if(files.length === 0) return;

  const room = MAX_IMAGES - draftImages.length;
  if(room <= 0){ toast(`Only ${MAX_IMAGES} photos allowed`); return; }

  const batch = files.slice(0, room);
  if(files.length > room) toast(`Only ${room} more photo(s) fit`);

  const grid = $('#uploadGrid');
  grid.insertAdjacentHTML('beforeend',
    `<div class="upload-item is-busy" id="uploadBusy"><span>Uploading…</span></div>`);

  for(const file of batch){
    if(!file.type.startsWith('image/')){ toast(`${file.name} is not an image`); continue; }
    if(file.size > 5 * 1024 * 1024){ toast(`${file.name} is over 5 MB`); continue; }

    try{
      const url = await uploadImage(file, productId);
      draftImages.push(url);
    }catch(err){
      console.error(err);
      toast(`Upload failed: ${err.message || 'unknown error'}`);
    }
  }

  $('#imageInput').value = '';
  paintUploads();
}

async function saveProduct(id){
  const val = sel => ($(sel)?.value || '').trim();
  const name = val('#pName');
  const price = Number($('#pPrice').value);

  const err = $('#pError');
  const fail = msg => { err.textContent = msg; err.hidden = false; };
  err.hidden = true;

  if(name.length < 2)         return fail('Give the fragrance a name.');
  if(!(price >= 0))           return fail('Enter a valid price.');
  if(draftImages.length === 0) return fail('Add at least one photograph.');

  const row = {
    id: id || slugify(name),
    name,
    family: val('#pFamily'),
    price,
    size: val('#pSize') || '50 ml',
    conc: val('#pConc'),
    lasts: val('#pLasts'),
    images: draftImages,
    image: draftImages[0],          /* kept in step for older code paths */
    description: val('#pDesc'),
    note_top: val('#pTop'),
    note_heart: val('#pHeart'),
    note_base: val('#pBase'),
    active: $('#pActive').value === 'true',
    sort_order: Number($('#pOrder').value) || 100,
    deleted_at: null
  };

  if(!row.id) return fail('That name cannot be turned into a web address. Use letters or numbers.');

  /* A new fragrance must not reuse an existing slug. */
  if(!id){
    const taken = [...state.products, ...state.trashedProducts].some(p => p.id === row.id);
    if(taken) return fail(`"${row.id}" already exists. Pick a slightly different name.`);
  }

  const btn = $('#pSave');
  btn.disabled = true;

  const { error } = await supabase
    .from('perfumeswebsite_products')
    .upsert(row, { onConflict: 'id' });

  btn.disabled = false;

  if(error){ fail(error.message); return; }

  logActivity('product', row.id, id ? 'updated' : 'created', row.name);
  toast(id ? 'Fragrance saved' : 'Fragrance added');
  closeDrawer();
  await fetchAll();
  render();
}

async function toggleProduct(id){
  const p = state.products.find(x => x.id === id);
  if(!p) return;
  await patchProduct(id, { active: !p.active }, p.active ? 'Hidden from shop' : 'Live on shop');
}

async function trashProduct(id){
  await patchProduct(id, { deleted_at: new Date().toISOString() }, 'Moved to trash');
  closeDrawer();
}

async function restoreProduct(id){
  await patchProduct(id, { deleted_at: null }, 'Fragrance restored');
}

async function patchProduct(id, patch, message){
  const { error } = await supabase
    .from('perfumeswebsite_products')
    .update(patch)
    .eq('id', id);

  if(error){ toast('Update failed'); console.error(error); return; }

  toast(message);
  await fetchAll();
  render();
}

async function purgeProduct(id){
  if(!confirm('Delete this fragrance permanently? Past orders keep their own copy of the name and price, so they stay intact.')) return;

  const { error } = await supabase.from('perfumeswebsite_products').delete().eq('id', id);
  if(error){ toast('Delete failed'); return; }

  toast('Deleted permanently');
  await fetchAll();
  render();
}

/* ---------- 9. REVIEWS ---------- */
function renderReviews(host){
  const pending = state.reviews.filter(r => !r.approved);

  /* group everything by fragrance so each product has its own list */
  const groups = new Map();
  state.reviews.forEach(r => {
    const key = r.product_id || '__general';
    if(!groups.has(key)){
      groups.set(key, {
        id: key,
        name: r.product_name || 'General store reviews',
        list: []
      });
    }
    groups.get(key).list.push(r);
  });

  /* products with no reviews yet still deserve a row */
  state.products.forEach(p => {
    if(!groups.has(p.id)) groups.set(p.id, { id: p.id, name: p.name, list: [] });
  });

  const ordered = [...groups.values()].sort((a, b) => b.list.length - a.list.length);

  host.innerHTML = `
    ${pending.length ? `
      <div class="a-card a-card-alert" style="margin-bottom:16px">
        <div class="a-card-head">
          <h2>Waiting for approval</h2>
          <span>${pending.length} pending across all fragrances</span>
        </div>
        <div class="a-table-wrap">${reviewsTable(pending)}</div>
      </div>` : ''}

    <div class="a-card">
      <div class="a-card-head">
        <h2>Reviews by fragrance</h2>
        <span>Click a fragrance to open its reviews</span>
      </div>

      <div class="accordion">
        ${ordered.map(g => {
          const live = g.list.filter(r => r.approved).length;
          const wait = g.list.length - live;
          const avg = g.list.length
            ? (g.list.reduce((a, r) => a + r.rating, 0) / g.list.length).toFixed(1)
            : '—';

          return `
            <div class="acc-item" data-group="${esc(g.id)}">
              <button class="acc-head" data-acc="${esc(g.id)}">
                <span class="acc-caret" aria-hidden="true">›</span>
                <span class="acc-name">${esc(g.name)}</span>
                <span class="acc-meta">
                  <span class="acc-stars">${avg === '—' ? '' : '★'} ${avg}</span>
                  <span class="tag tag-completed">${live} live</span>
                  ${wait ? `<span class="tag tag-pending">${wait} pending</span>` : ''}
                </span>
              </button>
              <div class="acc-body" hidden>
                ${g.list.length
                  ? `<div class="a-table-wrap">${reviewsTable(g.list)}</div>`
                  : '<p class="a-empty">No reviews for this fragrance yet.</p>'}
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>`;

  $$('[data-acc]').forEach(btn => btn.addEventListener('click', () => {
    const item = btn.closest('.acc-item');
    const body = $('.acc-body', item);
    const open = !body.hidden;
    body.hidden = open;
    item.classList.toggle('is-open', !open);
  }));

  wireReviewRows();
}

function reviewsTable(list){
  if(list.length === 0) return '<p class="a-empty">Nothing here yet.</p>';

  return `
    <table class="a-table">
      <thead>
        <tr>
          <th>Author</th><th>Fragrance</th><th>Rating</th>
          <th>Review</th><th>Received</th><th class="cell-actions">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(r => `
          <tr>
            <td>${esc(r.author)}<div class="cell-muted">${esc(r.city || '—')}</div></td>
            <td class="cell-muted">${esc(r.product_name || 'General')}</td>
            <td style="color:var(--gold)">${'★'.repeat(r.rating)}</td>
            <td class="cell-muted">${esc(r.body.slice(0, 90))}${r.body.length > 90 ? '…' : ''}</td>
            <td class="cell-muted">${fmtDate(r.created_at)}</td>
            <td class="cell-actions">
              ${r.approved
                ? `<button class="a-mini" data-unapprove="${r.id}">Unpublish</button>`
                : `<button class="a-mini is-go" data-approve="${r.id}">Approve</button>`}
              <button class="a-mini" data-editrv="${r.id}">Edit</button>
              <button class="a-mini is-danger" data-trashrv="${r.id}">Trash</button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function wireReviewRows(){
  $$('[data-approve]').forEach(b => b.addEventListener('click', () => setReview(b.dataset.approve, { approved: true })));
  $$('[data-unapprove]').forEach(b => b.addEventListener('click', () => setReview(b.dataset.unapprove, { approved: false })));
  $$('[data-trashrv]').forEach(b => b.addEventListener('click', () => setReview(b.dataset.trashrv, { deleted_at: new Date().toISOString() })));
  $$('[data-editrv]').forEach(b => b.addEventListener('click', () => editReview(b.dataset.editrv)));
  $$('[data-restorerv]').forEach(b => b.addEventListener('click', () => setReview(b.dataset.restorerv, { deleted_at: null })));
  $$('[data-purgerv]').forEach(b => b.addEventListener('click', () => purgeReview(b.dataset.purgerv)));
}

async function setReview(id, patch){
  const { error } = await supabase
    .from('perfumeswebsite_reviews')
    .update(patch)
    .eq('id', id);

  if(error){ toast('Update failed'); return; }

  toast('Review updated');
  closeDrawer();
  await fetchAll();
  render();
}

async function purgeReview(id){
  if(!confirm('Delete this review permanently?')) return;
  const { error } = await supabase.from('perfumeswebsite_reviews').delete().eq('id', id);
  if(error){ toast('Delete failed'); return; }
  toast('Deleted permanently');
  await fetchAll();
  render();
}

function editReview(id){
  const r = [...state.reviews, ...state.trashedReviews].find(x => x.id === id);
  if(!r) return;

  openDrawer('Edit review', `
    <div class="a-field">
      <label for="evAuthor">Author</label>
      <input id="evAuthor" type="text" value="${esc(r.author)}">
    </div>
    <div class="a-grid-2">
      <div class="a-field">
        <label for="evCity">City</label>
        <input id="evCity" type="text" value="${esc(r.city || '')}">
      </div>
      <div class="a-field">
        <label for="evRating">Rating</label>
        <select id="evRating">
          ${[5,4,3,2,1].map(n => `<option value="${n}" ${r.rating === n ? 'selected' : ''}>${n} star${n === 1 ? '' : 's'}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="a-field">
      <label for="evBody">Review</label>
      <textarea id="evBody" rows="6">${esc(r.body)}</textarea>
    </div>
    <div class="a-field">
      <label for="evApproved">Visibility</label>
      <select id="evApproved">
        <option value="true"  ${r.approved ? 'selected' : ''}>Published</option>
        <option value="false" ${!r.approved ? 'selected' : ''}>Hidden</option>
      </select>
    </div>

    <div class="drawer-actions">
      <button class="a-btn a-btn-primary" id="evSave">Save changes</button>
      <button class="a-btn a-btn-danger" id="evTrash">Move to trash</button>
    </div>`);

  $('#evSave').addEventListener('click', () => setReview(r.id, {
    author: $('#evAuthor').value.trim(),
    city: $('#evCity').value.trim() || null,
    rating: Number($('#evRating').value),
    body: $('#evBody').value.trim(),
    approved: $('#evApproved').value === 'true'
  }));

  $('#evTrash').addEventListener('click', () => setReview(r.id, { deleted_at: new Date().toISOString() }));
}

/* ---------- 10. TRASH ---------- */
function renderTrash(host){
  host.innerHTML = `
    <div class="a-card" style="margin-bottom:16px">
      <div class="a-card-head">
        <h2>Deleted orders</h2>
        <span>${state.trashed.length} in trash</span>
      </div>
      <div class="a-table-wrap">${ordersTable(state.trashed, { trash: true })}</div>
    </div>

    <div class="a-card" style="margin-bottom:16px">
      <div class="a-card-head">
        <h2>Deleted fragrances</h2>
        <span>${state.trashedProducts.length} in trash</span>
      </div>
      <div class="a-table-wrap">${productsTable(state.trashedProducts, { trash: true })}</div>
    </div>

    <div class="a-card">
      <div class="a-card-head">
        <h2>Deleted reviews</h2>
        <span>${state.trashedReviews.length} in trash</span>
      </div>
      <div class="a-table-wrap">
        ${state.trashedReviews.length === 0
          ? '<p class="a-empty">No deleted reviews.</p>'
          : `<table class="a-table">
              <thead><tr><th>Author</th><th>Fragrance</th><th>Review</th><th class="cell-actions">Actions</th></tr></thead>
              <tbody>
                ${state.trashedReviews.map(r => `
                  <tr>
                    <td>${esc(r.author)}</td>
                    <td class="cell-muted">${esc(r.product_name || 'General')}</td>
                    <td class="cell-muted">${esc(r.body.slice(0, 80))}…</td>
                    <td class="cell-actions">
                      <button class="a-mini is-go" data-restorerv="${r.id}">Restore</button>
                      <button class="a-mini is-danger" data-purgerv="${r.id}">Delete forever</button>
                    </td>
                  </tr>`).join('')}
              </tbody>
            </table>`}
      </div>
    </div>`;

  wireOrderRows();
  wireReviewRows();
  wireProductRows();
}

/* ---------- 11. SETTINGS ---------- */
function renderSettings(host){
  const s = state.settings;

  host.innerHTML = `
    <div class="settings-grid">
      <div class="a-card">
        <div class="a-card-head"><h2>Contact &amp; ordering</h2></div>

        <div class="a-field">
          <label for="stWa">WhatsApp number</label>
          <input id="stWa" type="tel" value="${esc(s.whatsapp_number || '')}" placeholder="923001234567">
          <p class="a-field-hint">Country code first, no +, spaces or dashes. Every WhatsApp button on the shop uses this.</p>
        </div>

        <div class="a-field">
          <label for="stEmail">Store email</label>
          <input id="stEmail" type="email" value="${esc(s.store_email || '')}">
        </div>

        <div class="a-field">
          <label for="stAnn">Announcement bar</label>
          <input id="stAnn" type="text" value="${esc(s.announcement || '')}" placeholder="Free delivery above Rs. 10,000">
          <p class="a-field-hint">Leave empty to hide the bar.</p>
        </div>

        <button class="a-btn a-btn-primary a-btn-block" id="saveContact">Save</button>
      </div>

      <div class="a-card">
        <div class="a-card-head"><h2>Delivery charges</h2></div>

        <div class="a-grid-2">
          <div class="a-field">
            <label for="stFree">Free delivery from (Rs.)</label>
            <input id="stFree" type="number" value="${esc(s.free_shipping_from || 10000)}">
          </div>
          <div class="a-field">
            <label for="stFlat">Flat rate (Rs.)</label>
            <input id="stFlat" type="number" value="${esc(s.shipping_flat || 250)}">
          </div>
        </div>

        <div class="a-field">
          <label for="stOpen">Accepting orders</label>
          <select id="stOpen">
            <option value="true"  ${s.orders_open !== 'false' ? 'selected' : ''}>Yes — shop is open</option>
            <option value="false" ${s.orders_open === 'false' ? 'selected' : ''}>No — pause new orders</option>
          </select>
        </div>

        <button class="a-btn a-btn-primary a-btn-block" id="saveShipping">Save</button>

        <div class="a-card-head" style="margin-top:32px"><h2>Session</h2></div>
        <p class="a-field-hint" style="margin-bottom:14px">Signed in as abubakar. To change the username or password, edit ADMIN_USER and ADMIN_PASS at the top of admin.js.</p>
        <button class="a-btn a-btn-ghost a-btn-block" id="signOutBtn2">Sign out</button>
      </div>
    </div>`;

  $('#saveContact').addEventListener('click', () => saveSettings({
    whatsapp_number: normalisePhone($('#stWa').value),
    store_email: $('#stEmail').value.trim(),
    announcement: $('#stAnn').value.trim()
  }));

  $('#saveShipping').addEventListener('click', () => saveSettings({
    free_shipping_from: $('#stFree').value,
    shipping_flat: $('#stFlat').value,
    orders_open: $('#stOpen').value
  }));

  $('#signOutBtn2').addEventListener('click', signOut);
}

async function saveSettings(patch){
  const rows = Object.entries(patch).map(([key, value]) => ({
    key,
    value: String(value),
    updated_at: new Date().toISOString()
  }));

  const { error } = await supabase
    .from('perfumeswebsite_settings')
    .upsert(rows, { onConflict: 'key' });

  if(error){ toast('Save failed'); console.error(error); return; }

  logActivity('settings', null, 'updated', Object.keys(patch).join(', '));
  toast('Settings saved');
  await fetchAll();
  await loadSettings();
  render();
}

/* ---------- 12. BOOT ---------- */
let appStarted = false;

async function bootApp(){
  if(appStarted) return;          // Enter and click can both fire sign-in
  appStarted = true;

  await loadSettings();
  await fetchAll();
  go('dashboard');
  initRealtime();

  /* charts need a redraw when the layout changes */
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if(state.view === 'dashboard') render(); }, 250);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  $('#loginBtn').addEventListener('click', signIn);
  $('#liPass').addEventListener('keydown', e => { if(e.key === 'Enter') signIn(); });
  $('#liUser').addEventListener('keydown', e => { if(e.key === 'Enter') $('#liPass').focus(); });

  $('#logoutBtn').addEventListener('click', signOut);
  $('#refreshBtn').addEventListener('click', async () => {
    await fetchAll();
    render();
    toast('Refreshed');
  });

  $('#sideToggle').addEventListener('click', () => $('#side').classList.toggle('is-open'));
  $$('.side-link').forEach(b => b.addEventListener('click', () => go(b.dataset.view)));

  $('#aDrawerClose').addEventListener('click', closeDrawer);
  $('#aScrim').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => { if(e.key === 'Escape') closeDrawer(); });

  /* already signed in this tab? skip the login screen */
  if(isSignedIn()) enterApp();
  else $('#liUser').focus();
});
