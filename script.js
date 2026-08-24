/* ============================================================
   SCENTIQUE — script.js  (storefront)
   1.  Imports & state
   2.  Cart
   3.  Cart drawer
   4.  WhatsApp messages
   5.  Order modal (online order + WhatsApp order)
   6.  Reviews
   7.  Navigation
   8.  Product cards
   9.  Product detail page
   10. Scroll reveal
   11. Boot
   ============================================================ */

import {
  supabase, STORE, loadSettings,
  CATALOG, findProduct,
  money, esc, waLink, orderRef, waIcon
} from './supabase.js';

/* ---------- 1. HELPERS & STATE ---------- */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const STORE_KEY = 'scentique.cart';
let cart = [];
let reviewStats = {};        // { productId: { avg, count } }

/* ---------- 2. CART ---------- */
function loadCart(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    cart = raw ? JSON.parse(raw) : [];
  }catch(e){ cart = []; }
}

function saveCart(){
  try{ localStorage.setItem(STORE_KEY, JSON.stringify(cart)); }
  catch(e){ /* storage blocked — cart lives in memory this session */ }
}

const cartCount = () => cart.reduce((n, l) => n + l.qty, 0);

const cartSubtotal = () => cart.reduce((sum, l) => {
  const p = findProduct(l.id);
  return p ? sum + p.price * l.qty : sum;
}, 0);

const shippingCost = () => {
  const sub = cartSubtotal();
  return (sub === 0 || sub >= STORE.freeShippingFrom) ? 0 : STORE.shippingFlat;
};

const cartTotal = () => cartSubtotal() + shippingCost();

function addToCart(id, qty = 1){
  const line = cart.find(l => l.id === id);
  if(line) line.qty = Math.min(20, line.qty + qty);
  else cart.push({ id, qty });

  saveCart();
  syncCart();
  bumpCounter();
  showToast(`${findProduct(id).name} added`);
}

function setQty(id, qty){
  const line = cart.find(l => l.id === id);
  if(!line) return;
  line.qty = qty;
  if(line.qty < 1) cart = cart.filter(l => l.id !== id);
  saveCart();
  syncCart();
}

function removeFromCart(id){
  cart = cart.filter(l => l.id !== id);
  saveCart();
  syncCart();
}

function syncCart(){
  const countEl = $('#cartCount');
  if(countEl){
    const n = cartCount();
    countEl.textContent = n;
    countEl.classList.toggle('is-empty', n === 0);
  }
  renderDrawer();
}

function bumpCounter(){
  const el = $('#cartCount');
  if(!el) return;
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

/* ---------- 3. CART DRAWER ---------- */
function renderDrawer(){
  const body = $('#drawerBody');
  const total = $('#cartTotal');
  if(!body) return;

  if(cart.length === 0){
    body.innerHTML = '<p class="drawer-empty">Your cart is empty.<br>Browse the collection to begin.</p>';
  }else{
    body.innerHTML = cart.map((line, i) => {
      const p = findProduct(line.id);
      if(!p) return '';
      return `
        <div class="line-item" style="animation-delay:${i * 60}ms">
          <div class="line-thumb" style="background-image:url('${p.image}')"></div>
          <div>
            <a class="line-name" href="product.html?id=${p.id}">${p.name}</a>
            <p class="line-sub">${p.size} · ${p.family}</p>
            <div class="line-qty">
              <button data-step="-1" data-id="${p.id}" aria-label="Decrease quantity">&minus;</button>
              <span>${line.qty}</span>
              <button data-step="1" data-id="${p.id}" aria-label="Increase quantity">+</button>
            </div>
            <button class="line-remove" data-remove="${p.id}">Remove</button>
          </div>
          <p class="line-price">${money(p.price * line.qty)}</p>
        </div>`;
    }).join('');
  }

  if(total) total.textContent = money(cartSubtotal());
}

function openDrawer(){
  const drawer = $('#cartDrawer');
  const scrim = $('#drawerScrim');
  drawer?.classList.add('is-open');
  drawer?.setAttribute('aria-hidden', 'false');
  if(scrim){
    scrim.hidden = false;
    requestAnimationFrame(() => scrim.classList.add('is-visible'));
  }
  document.body.classList.add('no-scroll');
}

function closeDrawer(){
  const drawer = $('#cartDrawer');
  const scrim = $('#drawerScrim');
  drawer?.classList.remove('is-open');
  drawer?.setAttribute('aria-hidden', 'true');
  if(scrim){
    scrim.classList.remove('is-visible');
    setTimeout(() => { scrim.hidden = true; }, 450);
  }
  if(!$('#orderModal')?.classList.contains('is-open')){
    document.body.classList.remove('no-scroll');
  }
}

let toastTimer;
function showToast(message){
  const el = $('#toast');
  if(!el) return;
  el.textContent = message;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2600);
}

/* ---------- 4. WHATSAPP MESSAGES ---------- */
function openWhatsApp(text){
  window.open(waLink(STORE.whatsapp, text), '_blank', 'noopener');
}

function cartMessage(details){
  const lines = [`*New order — ${STORE.name}*`, ''];

  cart.forEach(l => {
    const p = findProduct(l.id);
    if(p) lines.push(`• ${p.name} (${p.size}) × ${l.qty} — ${money(p.price * l.qty)}`);
  });

  lines.push('');
  lines.push(`Subtotal: ${money(cartSubtotal())}`);
  lines.push(`Delivery: ${shippingCost() === 0 ? 'Free' : money(shippingCost())}`);
  lines.push(`*Total: ${money(cartTotal())}*`);

  if(details){
    lines.push('', `Order ref: ${details.ref}`);
    lines.push(`Name: ${details.name}`);
    lines.push(`Phone: ${details.phone}`);
    lines.push(`City: ${details.city}`);
    lines.push(`Address: ${details.address}`);
    if(details.note) lines.push(`Note: ${details.note}`);
  }
  return lines.join('\n');
}

function productMessage(product, qty){
  return [
    `*New order — ${STORE.name}*`, '',
    `• ${product.name} (${product.size}) × ${qty} — ${money(product.price * qty)}`,
    '', `Total: ${money(product.price * qty)}`,
    '', 'Please confirm availability and delivery time.'
  ].join('\n');
}

/* ---------- 5. ORDER MODAL ---------- */
function buildModal(){
  if($('#orderModal')) return;

  const el = document.createElement('div');
  el.className = 'modal';
  el.id = 'orderModal';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <button class="modal-close" id="modalClose" aria-label="Close">&times;</button>
      <div id="modalContent"></div>
    </div>`;
  document.body.appendChild(el);

  el.addEventListener('click', e => { if(e.target === el) closeModal(); });
  $('#modalClose').addEventListener('click', closeModal);
}

function openModal(render = renderChoice){
  buildModal();
  render();
  const m = $('#orderModal');
  m.classList.add('is-open');
  m.setAttribute('aria-hidden', 'false');
  document.body.classList.add('no-scroll');
}

function closeModal(){
  const m = $('#orderModal');
  if(!m) return;
  m.classList.remove('is-open');
  m.setAttribute('aria-hidden', 'true');
  if(!$('#cartDrawer')?.classList.contains('is-open')){
    document.body.classList.remove('no-scroll');
  }
}

function summaryMarkup(){
  const rows = cart.map(l => {
    const p = findProduct(l.id);
    return p
      ? `<div class="order-summary-row"><span>${p.name} × ${l.qty}</span><span>${money(p.price * l.qty)}</span></div>`
      : '';
  }).join('');

  return `
    <div class="order-summary">
      ${rows}
      <div class="order-summary-row"><span>Delivery</span><span>${shippingCost() === 0 ? 'Free' : money(shippingCost())}</span></div>
      <div class="order-summary-row is-total"><span>Total</span><strong>${money(cartTotal())}</strong></div>
    </div>`;
}

/* Step 1 — how would you like to order? */
function renderChoice(){
  $('#modalContent').innerHTML = `
    <p class="eyebrow">Checkout</p>
    <h2 class="modal-title" id="modalTitle">How would you like to order?</h2>
    <p class="modal-lead">Both routes reach us. Cash on delivery either way.</p>

    ${summaryMarkup()}

    <div class="choice-list">
      <button class="choice" id="choiceOnline">
        <span class="choice-mark">01</span>
        <span class="choice-text">
          <strong>Order on this website</strong>
          Fill in your delivery details. We confirm by phone or WhatsApp, usually within a few hours.
        </span>
        <span class="choice-arrow" aria-hidden="true">→</span>
      </button>

      <button class="choice is-wa" id="choiceWa">
        <span class="choice-mark">02</span>
        <span class="choice-text">
          <strong>Order on WhatsApp</strong>
          Opens a chat with your order already written out. Send it and we take it from there.
        </span>
        <span class="choice-arrow" aria-hidden="true">→</span>
      </button>
    </div>`;

  $('#choiceOnline').addEventListener('click', () => renderOrderForm());
  $('#choiceWa').addEventListener('click', () => {
    openWhatsApp(cartMessage(null));
    closeModal();
  });
}

/* Step 2 — delivery details */
function renderOrderForm(){
  $('#modalContent').innerHTML = `
    <button class="modal-back" id="modalBack">← Back</button>
    <p class="eyebrow">Delivery details</p>
    <h2 class="modal-title" id="modalTitle">Where should it go?</h2>
    <p class="modal-lead">Cash on delivery. Nothing is charged until the parcel reaches you.</p>

    ${summaryMarkup()}

    <div class="field" id="wName">
      <label for="fName">Full name</label>
      <input id="fName" type="text" autocomplete="name" placeholder="Ayesha Khan">
      <p class="field-hint">Please enter your name.</p>
    </div>

    <div class="field-row">
      <div class="field" id="wPhone">
        <label for="fPhone">WhatsApp number</label>
        <input id="fPhone" type="tel" autocomplete="tel" inputmode="tel" placeholder="0300 1234567">
        <p class="field-hint">Enter a valid number — we confirm on this.</p>
      </div>
      <div class="field" id="wCity">
        <label for="fCity">City</label>
        <input id="fCity" type="text" autocomplete="address-level2" placeholder="Lahore">
        <p class="field-hint">Please enter your city.</p>
      </div>
    </div>

    <div class="field" id="wAddress">
      <label for="fAddress">Delivery address</label>
      <textarea id="fAddress" autocomplete="street-address" placeholder="House / street, area, landmark"></textarea>
      <p class="field-hint">Please enter a delivery address.</p>
    </div>

    <div class="field">
      <label for="fNote">Note <span class="label-soft">(optional)</span></label>
      <input id="fNote" type="text" placeholder="Gift wrap, preferred delivery time…">
    </div>

    <div class="modal-actions">
      <button class="btn-solid btn-block" id="confirmOrder">Place Order</button>
    </div>
    <p class="modal-fineprint">By placing the order you agree to be contacted on the number above.</p>`;

  $('#modalBack').addEventListener('click', renderChoice);
  $('#confirmOrder').addEventListener('click', submitOrder);
  setTimeout(() => $('#fName')?.focus(), 80);
}

function readForm(){
  const get = id => ($(id)?.value || '').trim();
  const details = {
    name: get('#fName'),
    phone: get('#fPhone'),
    city: get('#fCity'),
    address: get('#fAddress'),
    note: get('#fNote'),
    ref: orderRef()
  };

  const checks = [
    ['#wName',    details.name.length >= 2],
    ['#wPhone',   details.phone.replace(/\D/g, '').length >= 10],
    ['#wCity',    details.city.length >= 2],
    ['#wAddress', details.address.length >= 8]
  ];

  let ok = true;
  checks.forEach(([wrap, valid]) => {
    $(wrap)?.classList.toggle('is-error', !valid);
    if(!valid) ok = false;
  });

  if(!ok){
    $('.field.is-error input, .field.is-error textarea')?.focus();
    return null;
  }
  return details;
}

async function submitOrder(){
  const details = readForm();
  if(!details) return;

  const btn = $('#confirmOrder');
  btn.disabled = true;
  btn.textContent = 'Placing order…';

  const items = cart.map(l => {
    const p = findProduct(l.id);
    return {
      product_id: p.id,
      product_name: p.name,
      size: p.size,
      unit_price: p.price,
      qty: l.qty,
      line_total: p.price * l.qty
    };
  });

  const message = cartMessage(details);

  try{
    const { data: order, error } = await supabase
      .from('perfumeswebsite_orders')
      .insert({
        ref: details.ref,
        customer_name: details.name,
        phone: details.phone,
        city: details.city,
        address: details.address,
        note: details.note || null,
        subtotal: cartSubtotal(),
        shipping: shippingCost(),
        total: cartTotal(),
        source: 'website'
      })
      .select('id')
      .single();

    if(error) throw error;

    await supabase
      .from('perfumeswebsite_order_items')
      .insert(items.map(i => ({ ...i, order_id: order.id })));

    renderOrderDone(details, message, true);

    cart = [];
    saveCart();
    syncCart();
    closeDrawer();

  }catch(err){
    console.error('Order failed:', err);
    btn.disabled = false;
    btn.textContent = 'Place Order';
    renderOrderFailed(details, message);
  }
}

function renderOrderDone(details, message){
  $('#modalContent').innerHTML = `
    <div class="order-done">
      <div class="order-seal">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
          <path d="M4 12.5 9.5 18 20 6.5"/>
        </svg>
      </div>
      <h2 class="modal-title" id="modalTitle">Order received</h2>
      <p class="order-ref">${esc(details.ref)}</p>
      <p class="modal-lead">Thank you, ${esc(details.name.split(' ')[0])}. Your order is with us and we'll message ${esc(details.phone)} on WhatsApp to confirm it.</p>

      <div class="modal-actions">
        <button class="btn-wa" id="waDoneBtn">${waIcon} Message us now</button>
        <a class="btn-line" href="index.html#collection">Continue browsing</a>
      </div>
    </div>`;

  $('#waDoneBtn').addEventListener('click', () => openWhatsApp(message));
}

function renderOrderFailed(details, message){
  $('#modalContent').innerHTML = `
    <div class="order-done">
      <h2 class="modal-title" id="modalTitle">We couldn't save that order</h2>
      <p class="modal-lead">The connection to our system failed, so nothing was recorded. Your cart is untouched — send the order on WhatsApp instead and we'll enter it manually.</p>

      <div class="modal-actions">
        <button class="btn-wa" id="waRetryBtn">${waIcon} Send on WhatsApp</button>
        <button class="btn-line" id="retryBtn">Try again</button>
      </div>
    </div>`;

  $('#waRetryBtn').addEventListener('click', () => openWhatsApp(message));
  $('#retryBtn').addEventListener('click', renderOrderForm);
}

/* ---------- 6. REVIEWS ---------- */
const stars = n => '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);

async function loadReviewStats(){
  try{
    const { data } = await supabase
      .from('perfumeswebsite_reviews')
      .select('product_id, rating')
      .eq('approved', true)
      .is('deleted_at', null);

    if(!data) return;

    const buckets = {};
    data.forEach(r => {
      if(!r.product_id) return;
      (buckets[r.product_id] ||= []).push(r.rating);
    });

    reviewStats = Object.fromEntries(
      Object.entries(buckets).map(([id, list]) => [id, {
        avg: list.reduce((a, b) => a + b, 0) / list.length,
        count: list.length
      }])
    );
  }catch(e){ /* reviews are optional decoration */ }
}

async function renderHomeReviews(){
  const wrap = $('#reviewList');
  if(!wrap) return;

  const { data } = await supabase
    .from('perfumeswebsite_reviews')
    .select('*')
    .eq('approved', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(3);

  if(!data || data.length === 0){
    $('#reviewSection')?.remove();
    return;
  }

  wrap.innerHTML = data.map((r, i) => `
    <figure class="review reveal" style="--d:${i * 100}ms">
      <div class="review-stars" aria-label="${r.rating} out of 5">${stars(r.rating)}</div>
      <blockquote>${esc(r.body)}</blockquote>
      <figcaption>
        <span class="review-author">${esc(r.author)}</span>
        <span class="review-meta">${esc([r.city, r.product_name].filter(Boolean).join(' · '))}</span>
      </figcaption>
    </figure>`).join('');

  initReveal();
}

async function renderProductReviews(product){
  const wrap = $('#pdpReviews');
  if(!wrap) return;

  const { data } = await supabase
    .from('perfumeswebsite_reviews')
    .select('*')
    .eq('product_id', product.id)
    .eq('approved', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const list = data || [];

  wrap.innerHTML = `
    <div class="section-head reveal">
      <p class="eyebrow">Wearer Notes</p>
      <h2 class="section-title">${list.length ? 'What people report' : 'Be the first to review'}</h2>
    </div>

    <div class="review-grid">
      ${list.length ? list.map((r, i) => `
        <figure class="review reveal" style="--d:${(i % 3) * 90}ms">
          <div class="review-stars">${stars(r.rating)}</div>
          <blockquote>${esc(r.body)}</blockquote>
          <figcaption>
            <span class="review-author">${esc(r.author)}</span>
            <span class="review-meta">${esc(r.city || '')}</span>
          </figcaption>
        </figure>`).join('')
      : '<p class="review-empty">No reviews for this fragrance yet.</p>'}
    </div>

    <div class="review-form reveal">
      <h3>Leave a review</h3>
      <p class="review-form-note">Reviews appear once we've checked them.</p>

      <div class="field-row">
        <div class="field" id="wRvName">
          <label for="rvName">Your name</label>
          <input id="rvName" type="text" placeholder="Ayesha K.">
          <p class="field-hint">Please enter a name.</p>
        </div>
        <div class="field">
          <label for="rvCity">City <span class="label-soft">(optional)</span></label>
          <input id="rvCity" type="text" placeholder="Lahore">
        </div>
      </div>

      <div class="field">
        <label>Rating</label>
        <div class="star-input" id="starInput" role="radiogroup" aria-label="Rating">
          ${[1,2,3,4,5].map(n => `<button type="button" data-star="${n}" aria-label="${n} stars">★</button>`).join('')}
        </div>
      </div>

      <div class="field" id="wRvBody">
        <label for="rvBody">Your review</label>
        <textarea id="rvBody" placeholder="How does it wear? How long does it last?"></textarea>
        <p class="field-hint">Please write at least a sentence.</p>
      </div>

      <button class="btn-solid" id="rvSubmit">Submit Review</button>
    </div>`;

  /* star picker */
  let rating = 5;
  const paint = () => $$('#starInput button').forEach(b =>
    b.classList.toggle('is-on', Number(b.dataset.star) <= rating));
  paint();

  $$('#starInput button').forEach(b => b.addEventListener('click', () => {
    rating = Number(b.dataset.star);
    paint();
  }));

  $('#rvSubmit').addEventListener('click', async () => {
    const name = $('#rvName').value.trim();
    const city = $('#rvCity').value.trim();
    const body = $('#rvBody').value.trim();

    $('#wRvName').classList.toggle('is-error', name.length < 2);
    $('#wRvBody').classList.toggle('is-error', body.length < 12);
    if(name.length < 2 || body.length < 12) return;

    const btn = $('#rvSubmit');
    btn.disabled = true;
    btn.textContent = 'Sending…';

    const { error } = await supabase.from('perfumeswebsite_reviews').insert({
      product_id: product.id,
      product_name: product.name,
      author: name,
      city: city || null,
      rating,
      body,
      approved: false
    });

    btn.disabled = false;
    btn.textContent = 'Submit Review';

    if(error){
      showToast('Review could not be sent');
      return;
    }

    $('.review-form').innerHTML =
      '<h3>Thank you</h3><p class="review-form-note">Your review is with us and will appear once approved.</p>';
  });

  initReveal();
}

/* ---------- 7. NAVIGATION ---------- */
function initNav(){
  const header = $('#siteHeader');
  const menuBtn = $('#menuBtn');
  const links = $('#navLinks');
  if(!header) return;

  const alwaysSolid = header.classList.contains('is-solid');
  let lastY = window.scrollY;

  const onScroll = () => {
    const y = window.scrollY;
    if(!alwaysSolid) header.classList.toggle('is-solid', y > 60);

    const menuOpen = links?.classList.contains('is-open');
    header.classList.toggle('is-hidden', y > 320 && y > lastY && !menuOpen);
    lastY = y;

    $('#waFloat')?.classList.toggle('is-visible', y > 400);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  menuBtn?.addEventListener('click', () => {
    const open = links.classList.toggle('is-open');
    menuBtn.classList.toggle('is-open', open);
    header.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
  });

  $$('#navLinks a').forEach(a => a.addEventListener('click', () => {
    links.classList.remove('is-open');
    menuBtn?.classList.remove('is-open');
    header.classList.remove('menu-open');
    menuBtn?.setAttribute('aria-expanded', 'false');
  }));
}

/* ---------- 8. PRODUCT CARDS ---------- */
function cardMarkup(p, i){
  const stat = reviewStats[p.id];
  const rating = stat
    ? `<span class="card-rating">${stars(Math.round(stat.avg))}<em>${stat.count}</em></span>`
    : '';

  return `
    <article class="card reveal" style="--d:${(i % 4) * 90}ms">
      <div class="card-media">
        <span class="card-img" style="background-image:url('${p.image}')"></span>
        <span class="card-frame" aria-hidden="true"></span>
        <span class="card-tag">${p.family}</span>
        <a class="card-link" href="product.html?id=${p.id}" aria-label="View ${p.name}"></a>
        <button class="quick-add" data-add="${p.id}">Quick Add</button>
      </div>

      <a class="card-body" href="product.html?id=${p.id}">
        <div class="card-row">
          <h3 class="card-name">${p.name}</h3>
          <span class="card-price">${money(p.price)}</span>
        </div>
        <p class="card-notes"><em>${p.notes.top.split(',')[0]}</em> · ${p.notes.heart.split(',')[0]} · ${p.notes.base.split(',')[0]}</p>
        <div class="card-foot">
          <span class="card-size">${p.size} · ${p.conc.split('·')[1]?.trim() || p.conc}</span>
          ${rating}
        </div>
      </a>
    </article>`;
}

function renderGrid(target, items){
  const grid = $(target);
  if(!grid) return;
  grid.innerHTML = items.map(cardMarkup).join('');
  initReveal();
}

/* ---------- 9. PRODUCT DETAIL PAGE ---------- */
function initPDP(){
  if(!$('#pdp')) return null;

  const params = new URLSearchParams(location.search);
  const product = findProduct(params.get('id')) || CATALOG[0];

  document.title = `${product.name} — SCENTIQUE`;
  $('#crumbName').textContent = product.name;
  $('#pdpFamily').textContent = product.family;
  $('#pdpTitle').textContent  = product.name;
  $('#pdpPrice').textContent  = money(product.price);
  $('#pdpDesc').textContent   = product.desc;
  $('#pdpImage').style.backgroundImage = `url('${product.image}')`;

  $('#noteTop').textContent   = product.notes.top;
  $('#noteHeart').textContent = product.notes.heart;
  $('#noteBase').textContent  = product.notes.base;

  $('#pdpSize').textContent = product.size;
  $('#pdpConc').textContent = product.conc;
  $('#pdpLast').textContent = product.lasts;
  $('#buyBarPrice').textContent = money(product.price);

  let qty = 1;
  const qtyValue = $('#qtyValue');
  const setLocalQty = n => { qty = Math.min(10, Math.max(1, n)); qtyValue.value = qty; };

  $('#qtyMinus').addEventListener('click', () => setLocalQty(qty - 1));
  $('#qtyPlus').addEventListener('click',  () => setLocalQty(qty + 1));

  const add = () => { addToCart(product.id, qty); openDrawer(); };
  $('#addToCart').addEventListener('click', add);
  $('#buyBarAdd').addEventListener('click', add);

  $('#waProductBtn').addEventListener('click', () => openWhatsApp(productMessage(product, qty)));

  const cta = $('#addToCart');
  const bar = $('#buyBar');
  if('IntersectionObserver' in window && bar){
    new IntersectionObserver(([entry]) => {
      bar.classList.toggle('is-visible', !entry.isIntersecting && entry.boundingClientRect.top < 0);
    }, { threshold: 0 }).observe(cta);
  }

  renderGrid('#relatedGrid', CATALOG.filter(p => p.id !== product.id).slice(0, 4));
  return product;
}

/* ---------- 10. SCROLL REVEAL ---------- */
let revealObserver;
function initReveal(){
  const items = $$('.reveal:not(.is-watched)');
  if(!items.length) return;

  if(!('IntersectionObserver' in window)){
    items.forEach(el => el.classList.add('is-in'));
    return;
  }

  revealObserver ||= new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        entry.target.classList.add('is-in');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: .12, rootMargin: '0px 0px -8% 0px' });

  items.forEach(el => { el.classList.add('is-watched'); revealObserver.observe(el); });
}

/* ---------- 11. BOOT ---------- */
async function boot(){
  loadCart();
  initNav();
  syncCart();
  initReveal();

  const y = $('#year');
  if(y) y.textContent = new Date().getFullYear();

  /* Drawer controls */
  $('#cartBtn')?.addEventListener('click', openDrawer);
  $('#drawerClose')?.addEventListener('click', closeDrawer);
  $('#drawerScrim')?.addEventListener('click', closeDrawer);

  document.addEventListener('keydown', e => {
    if(e.key !== 'Escape') return;
    if($('#orderModal')?.classList.contains('is-open')) closeModal();
    else closeDrawer();
  });

  $('#checkoutBtn')?.addEventListener('click', () => {
    if(cart.length === 0){ showToast('Add a fragrance first'); return; }
    openModal();
  });

  $('#waCartBtn')?.addEventListener('click', () => {
    if(cart.length === 0){ showToast('Add a fragrance first'); return; }
    openWhatsApp(cartMessage(null));
  });

  /* Delegated card / drawer actions */
  document.addEventListener('click', e => {
    const add = e.target.closest('[data-add]');
    if(add){
      addToCart(add.dataset.add, 1);
      add.textContent = 'Added';
      add.classList.add('is-added');
      setTimeout(() => {
        add.textContent = 'Quick Add';
        add.classList.remove('is-added');
      }, 1400);
      return;
    }

    const step = e.target.closest('[data-step]');
    if(step){
      const line = cart.find(l => l.id === step.dataset.id);
      if(line) setQty(step.dataset.id, line.qty + Number(step.dataset.step));
      return;
    }

    const rm = e.target.closest('[data-remove]');
    if(rm) removeFromCart(rm.dataset.remove);
  });

  /* Settings and review counts drive the rest of the render */
  await loadSettings();
  await loadReviewStats();

  renderGrid('#productGrid', CATALOG);
  const product = initPDP();

  /* WhatsApp shortcuts, now that the real number is known */
  const generalMsg = `Hello ${STORE.name}, I'd like to ask about your fragrances.`;
  const link = waLink(STORE.whatsapp, generalMsg);

  const float = $('#waFloat');
  if(float){
    float.href = link;
    float.target = '_blank';
    float.rel = 'noopener';
  }
  $$('[data-wa-general]').forEach(a => {
    a.href = link;
    a.target = '_blank';
    a.rel = 'noopener';
  });
  $$('[data-store-email]').forEach(a => {
    a.href = `mailto:${STORE.email}`;
    a.textContent = STORE.email;
  });

  /* Announcement bar */
  const ann = $('#announcement');
  if(ann && STORE.announcement){
    ann.textContent = STORE.announcement;
    ann.hidden = false;
    document.body.classList.add('has-announce');
  }

  renderHomeReviews();
  if(product) renderProductReviews(product);
}

document.addEventListener('DOMContentLoaded', boot);
