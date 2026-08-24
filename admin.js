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
  supabase, ADMIN_EMAIL, STORE, loadSettings,
  money, esc, waLink, normalisePhone
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

/* ---------- 2. AUTH ---------- */
/* Supabase returns the same "Invalid login credentials" for a wrong
   password, a missing user and an unconfirmed email, so we test the
   connection first and spell out what actually went wrong. */
async function signIn(){
  const user = $('#liUser').value.trim().toLowerCase();
  const pass = $('#liPass').value;
  const err  = $('#loginError');
  const btn  = $('#loginBtn');

  err.hidden = true;
  err.innerHTML = '';

  if(user !== 'abubakar'){
    showLoginError('Unknown username. It should be <b>abubakar</b>.');
    return;
  }
  if(!pass){
    showLoginError('Enter the password.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Signing in…';

  /* 1. Can we reach the project at all? */
  const reachable = await testConnection();
  if(!reachable.ok){
    btn.disabled = false;
    btn.textContent = 'Sign In';
    showLoginError(`Cannot reach Supabase — ${esc(reachable.message)}<br><br>
      Check that <b>setup.sql</b> has been run and that the URL and key in
      <b>supabase.js</b> match your project.`);
    return;
  }

  /* 2. Try the actual sign-in. */
  const { data, error } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: pass
  });

  btn.disabled = false;
  btn.textContent = 'Sign In';

  if(!error && data?.session){
    enterApp();
    return;
  }

  console.error('Sign-in failed:', error);
  const msg = (error?.message || '').toLowerCase();

  if(msg.includes('email logins are disabled') || msg.includes('provider is not enabled')){
    showLoginError(`Email sign-in is switched off for this project.<br><br>
      Supabase → <b>Authentication → Sign In / Providers → Email</b> → turn it on.`);

  }else if(msg.includes('not confirmed')){
    showLoginError(`The account exists but its email is not confirmed.<br><br>
      Supabase → <b>Authentication → Users</b> → open
      <b>${esc(ADMIN_EMAIL)}</b> → confirm the email
      (or delete the user and add it again with
      <b>Auto Confirm User</b> ticked).`);

  }else if(msg.includes('invalid login credentials')){
    showLoginError(`Either the password is wrong, or the admin account was never created.<br><br>
      Expected email: <b>${esc(ADMIN_EMAIL)}</b><br>
      Expected password: <b>@bubakar</b><br><br>
      In Supabase → <b>Authentication → Users</b>, check that this exact
      email exists and is confirmed.
      <button class="a-mini" id="makeAdmin" style="margin:12px 0 0">Create this account now</button>`);

    $('#makeAdmin')?.addEventListener('click', createAdmin);

  }else{
    showLoginError(`Sign-in failed — ${esc(error?.message || 'unknown error')}`);
  }
}

function showLoginError(html){
  const err = $('#loginError');
  err.innerHTML = html;
  err.hidden = false;
}

/* A read that anon is always allowed to do, so a failure here means
   the project, key or schema is the problem — not the password. */
async function testConnection(){
  try{
    const { error } = await supabase
      .from('perfumeswebsite_settings')
      .select('key')
      .limit(1);

    if(error){
      if(error.message.includes('does not exist') || error.code === '42P01'){
        return { ok: false, message: 'the perfumeswebsite_ tables are missing (run setup.sql)' };
      }
      return { ok: false, message: error.message };
    }
    return { ok: true };
  }catch(e){
    return { ok: false, message: e.message || 'network error' };
  }
}

/* Creates the admin user from the browser. Works only while Supabase
   allows sign-ups; otherwise add the user in the dashboard instead. */
async function createAdmin(){
  showLoginError('Creating the admin account…');

  const { data, error } = await supabase.auth.signUp({
    email: ADMIN_EMAIL,
    password: '@bubakar'
  });

  if(error){
    showLoginError(`Could not create the account — ${esc(error.message)}<br><br>
      Add it manually instead: Supabase → <b>Authentication → Users → Add user</b>,
      email <b>${esc(ADMIN_EMAIL)}</b>, password <b>@bubakar</b>,
      with <b>Auto Confirm User</b> ticked.`);
    return;
  }

  if(data.session){
    enterApp();
    return;
  }

  showLoginError(`Account created, but Supabase is waiting on email confirmation.<br><br>
    Go to <b>Authentication → Users</b>, open <b>${esc(ADMIN_EMAIL)}</b> and confirm it,
    then sign in again. To skip this in future, turn off
    <b>Confirm email</b> under Authentication → Sign In / Providers → Email.`);
}

async function signOut(){
  await supabase.auth.signOut();
  location.reload();
}

function enterApp(){
  $('#loginView').hidden = true;
  $('#appView').hidden = false;
  bootApp();
}

/* ---------- 3. DATA ---------- */
async function fetchAll(){
  const [ordersRes, reviewsRes, settingsRes] = await Promise.all([
    supabase.from('perfumeswebsite_orders')
      .select('*, perfumeswebsite_order_items(*)')
      .order('created_at', { ascending: false }),
    supabase.from('perfumeswebsite_reviews')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase.from('perfumeswebsite_settings').select('*')
  ]);

  if(ordersRes.error) console.error(ordersRes.error);

  const orders = ordersRes.data || [];
  state.orders  = orders.filter(o => !o.deleted_at);
  state.trashed = orders.filter(o =>  o.deleted_at);

  const reviews = reviewsRes.data || [];
  state.reviews        = reviews.filter(r => !r.deleted_at);
  state.trashedReviews = reviews.filter(r =>  r.deleted_at);

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

function initRealtime(){
  supabase
    .channel('perfumeswebsite-admin')
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
    .subscribe(status => {
      $('#liveDot').classList.toggle('is-off', status !== 'SUBSCRIBED');
    });
}

/* ---------- 4. ROUTER ---------- */
const TITLES = {
  dashboard: 'Dashboard',
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

/* ---------- 9. REVIEWS ---------- */
function renderReviews(host){
  const pending  = state.reviews.filter(r => !r.approved);
  const approved = state.reviews.filter(r =>  r.approved);

  host.innerHTML = `
    ${pending.length ? `
      <div class="a-card" style="margin-bottom:16px">
        <div class="a-card-head">
          <h2>Waiting for approval</h2>
          <span>${pending.length} pending</span>
        </div>
        <div class="a-table-wrap">${reviewsTable(pending)}</div>
      </div>` : ''}

    <div class="a-card">
      <div class="a-card-head">
        <h2>Published reviews</h2>
        <span>${approved.length} live on the site</span>
      </div>
      <div class="a-table-wrap">${reviewsTable(approved)}</div>
    </div>`;

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
        <p class="a-field-hint" style="margin-bottom:14px">Signed in as abubakar. Password changes are made in the Supabase dashboard under Authentication → Users.</p>
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
async function bootApp(){
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

document.addEventListener('DOMContentLoaded', async () => {
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

  /* already signed in? skip the login screen */
  const { data } = await supabase.auth.getSession();
  if(data.session) enterApp();
});
