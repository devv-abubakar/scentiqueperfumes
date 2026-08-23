/* ============================================================
   SCENTIQUE — script.js
   1.  Store settings
   2.  Catalog data
   3.  Helpers
   4.  Cart state
   5.  Cart drawer UI
   6.  WhatsApp ordering
   7.  Order modal (form + confirmation)
   8.  Navigation
   9.  Home page rendering
   10. Product detail page
   11. Scroll reveal
   12. Boot
   ============================================================ */

/* ---------- 1. STORE SETTINGS ----------
   CHANGE THIS: full number, country code first, no +, spaces or dashes.
   Pakistan example — 0300 1234567 becomes 923001234567
----------------------------------------- */
const STORE = {
  name: 'Scentique',
  whatsapp: '923001234567',
  freeShippingFrom: 10000,
  shippingFlat: 250
};

/* ---------- 2. CATALOG ---------- */
const CATALOG = [
  {
    id: 'noir-oud',
    name: 'Noir Oud',
    family: 'Woody Oriental',
    price: 8900,
    size: '50 ml',
    conc: 'Extrait de Parfum · 30%',
    lasts: '10–12 hours',
    image: 'https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=1100&q=80',
    desc: 'Oud is usually worn like armour. Here it is worn like a coat — the Laotian wood is cut with bergamot and pink pepper so it opens bright, then settles over several hours into resin, leather and a dry smoke that stays close to the skin. Best after dark, in cold weather, on someone who does not need to be noticed from across the room.',
    notes: {
      top: 'Bergamot, Pink Pepper, Saffron',
      heart: 'Laotian Oud, Bulgarian Rose, Patchouli',
      base: 'Leather, Labdanum, Vetiver, Ambergris'
    }
  },
  {
    id: 'fleur-blanche',
    name: 'Fleur Blanche',
    family: 'White Floral',
    price: 6500,
    size: '50 ml',
    conc: 'Eau de Parfum · 24%',
    lasts: '7–9 hours',
    image: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=1100&q=80',
    desc: 'Tuberose and jasmine sambac picked before sunrise, when the oil is at its heaviest. We hold them back with green pear and a thread of orange blossom so the composition reads clean rather than heady. It behaves like fresh linen in a warm room — soft up close, unmistakable at a distance.',
    notes: {
      top: 'Green Pear, Neroli, Petitgrain',
      heart: 'Tuberose, Jasmine Sambac, Orange Blossom',
      base: 'White Musk, Sandalwood, Cedar'
    }
  },
  {
    id: 'ambre-royale',
    name: 'Ambre Royale',
    family: 'Amber Gourmand',
    price: 7400,
    size: '50 ml',
    conc: 'Eau de Parfum · 26%',
    lasts: '9–11 hours',
    image: 'https://images.unsplash.com/photo-1588405748880-12d1d2a59d75?auto=format&fit=crop&w=1100&q=80',
    desc: 'Amber built on labdanum and benzoin rather than vanilla sugar, so the sweetness has weight to it. Cardamom and cinnamon warm the opening; tonka and a whisper of Madagascan vanilla close it. A winter fragrance that leaves a trace on a scarf three days later.',
    notes: {
      top: 'Cardamom, Cinnamon Bark, Mandarin',
      heart: 'Labdanum, Benzoin, Immortelle',
      base: 'Tonka Bean, Madagascan Vanilla, Cashmere Wood'
    }
  },
  {
    id: 'citrus-eclat',
    name: 'Citrus Éclat',
    family: 'Fresh Citrus',
    price: 5200,
    size: '50 ml',
    conc: 'Eau de Parfum · 22%',
    lasts: '6–8 hours',
    image: 'https://images.unsplash.com/photo-1587017539504-67cfbddac569?auto=format&fit=crop&w=1100&q=80',
    desc: 'Citrus normally disappears within the hour. We anchored Calabrian bergamot and Sicilian lemon to a base of vetiver and moss, which holds the brightness in place through a full working day. Crisp, dry, and entirely appropriate before noon.',
    notes: {
      top: 'Calabrian Bergamot, Sicilian Lemon, Grapefruit',
      heart: 'Basil, Ginger, Rosemary',
      base: 'Haitian Vetiver, Oakmoss, Ambrette Seed'
    }
  },
  {
    id: 'velours-rose',
    name: 'Velours Rose',
    family: 'Modern Chypre',
    price: 7900,
    size: '50 ml',
    conc: 'Eau de Parfum · 26%',
    lasts: '8–10 hours',
    image: 'https://images.unsplash.com/photo-1615634260167-c8cdede054de?auto=format&fit=crop&w=1100&q=80',
    desc: 'Turkish rose absolute from Isparta, layered over blackcurrant and a dark patchouli base. The fruit keeps it from turning powdery and the patchouli gives it a shadow. Reads as rose for the first ten minutes and as something far more difficult to place after that.',
    notes: {
      top: 'Blackcurrant, Lychee, Pink Peppercorn',
      heart: 'Turkish Rose Absolute, Peony, Geranium',
      base: 'Patchouli, Oakmoss, Musk'
    }
  },
  {
    id: 'bois-de-nuit',
    name: 'Bois de Nuit',
    family: 'Dry Woods',
    price: 6800,
    size: '50 ml',
    conc: 'Eau de Parfum · 25%',
    lasts: '8–10 hours',
    image: 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=1100&q=80',
    desc: 'Cedar and vetiver sharpened with juniper, then softened by plantation sandalwood. There is no sweetness anywhere in the formula. It smells like a cold room with the windows open and a fire that went out an hour ago — quiet, and slightly austere.',
    notes: {
      top: 'Juniper Berry, Elemi, Black Pepper',
      heart: 'Virginia Cedar, Cypress, Iris Root',
      base: 'Australian Sandalwood, Vetiver, Dry Amber'
    }
  },
  {
    id: 'safran-imperial',
    name: 'Safran Impérial',
    family: 'Spiced Leather',
    price: 9600,
    size: '50 ml',
    conc: 'Extrait de Parfum · 30%',
    lasts: '11–13 hours',
    image: 'https://images.unsplash.com/photo-1610461888750-10bfc601b874?auto=format&fit=crop&w=1100&q=80',
    desc: 'Our most expensive formula, and the reason is saffron — roughly four grams per batch, which is enough to change how the leather behaves. Suede, honeyed tobacco and a long resinous drydown. Two sprays is a decision; three is an announcement.',
    notes: {
      top: 'Saffron, Nutmeg, Bitter Almond',
      heart: 'Suede, Honeyed Tobacco, Osmanthus',
      base: 'Styrax, Myrrh, Oud, Castoreum Accord'
    }
  },
  {
    id: 'brume-marine',
    name: 'Brume Marine',
    family: 'Aromatic Aquatic',
    price: 5800,
    size: '50 ml',
    conc: 'Eau de Parfum · 23%',
    lasts: '6–8 hours',
    image: 'https://images.unsplash.com/photo-1547887538-e3a2f32cb1cc?auto=format&fit=crop&w=1100&q=80',
    desc: 'Salt, driftwood and sea lavender, without the sharp synthetic edge most marine fragrances carry. Sage and clary keep the opening herbal; a mineral ambergris base gives it depth. Made for humidity, and the only thing in the collection we recommend for June in Karachi.',
    notes: {
      top: 'Sea Salt, Bergamot, Clary Sage',
      heart: 'Sea Lavender, Rosemary, Driftwood',
      base: 'Mineral Ambergris, Grey Musk, Cedar'
    }
  }
];

/* ---------- 3. HELPERS ---------- */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** 8900 -> "Rs. 8,900" */
const money = n => 'Rs. ' + n.toLocaleString('en-PK');

const findProduct = id => CATALOG.find(p => p.id === id);

/** Escapes user-entered text before it reaches innerHTML. */
const esc = str => String(str).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

/** SCQ-4F2A81 */
const orderRef = () =>
  'SCQ-' + Math.random().toString(36).slice(2, 8).toUpperCase();

const waIcon = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.6 2 2.2 6.4 2.2 11.84c0 1.74.46 3.44 1.32 4.94L2 22l5.36-1.4a9.9 9.9 0 0 0 4.68 1.18h.01c5.43 0 9.84-4.4 9.84-9.84S17.47 2 12.04 2Zm0 18.02a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.18.83.85-3.1-.2-.32a8.16 8.16 0 1 1 7.01 3.91Zm4.5-6.12c-.25-.12-1.46-.72-1.68-.8-.23-.09-.39-.13-.56.12-.16.25-.64.8-.78.97-.15.16-.29.18-.53.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.7-.15-.25-.02-.38.11-.5.11-.11.25-.29.37-.44.13-.15.17-.25.25-.41.09-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42h-.48c-.16 0-.43.06-.65.31-.23.25-.86.84-.86 2.05s.88 2.38 1 2.54c.13.17 1.74 2.65 4.2 3.72.59.25 1.05.4 1.4.52.59.18 1.13.16 1.55.1.47-.07 1.46-.6 1.66-1.17.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.28Z"/></svg>`;

/* ---------- 4. CART STATE ---------- */
const STORE_KEY = 'scentique.cart';
let cart = [];

function loadCart(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    cart = raw ? JSON.parse(raw) : [];
  }catch(e){ cart = []; }
}

function saveCart(){
  try{ localStorage.setItem(STORE_KEY, JSON.stringify(cart)); }
  catch(e){ /* storage blocked — cart lives in memory for this session */ }
}

const cartCount = () => cart.reduce((n, l) => n + l.qty, 0);

const cartSubtotal = () => cart.reduce((sum, l) => {
  const p = findProduct(l.id);
  return p ? sum + p.price * l.qty : sum;
}, 0);

const shippingCost = () => {
  const sub = cartSubtotal();
  if(sub === 0 || sub >= STORE.freeShippingFrom) return 0;
  return STORE.shippingFlat;
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

/** Repaint every cart-dependent piece of UI. */
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
  void el.offsetWidth;              // restart the animation
  el.classList.add('bump');
}

/* ---------- 5. CART DRAWER ---------- */
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
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2400);
}

/* ---------- 6. WHATSAPP ORDERING ---------- */
function waLink(text){
  return `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(text)}`;
}

function openWhatsApp(text){
  window.open(waLink(text), '_blank', 'noopener');
}

/** Message for the whole cart, optionally with delivery details attached. */
function cartMessage(details){
  const lines = [
    `*New order — ${STORE.name}*`,
    ''
  ];

  cart.forEach(l => {
    const p = findProduct(l.id);
    if(p) lines.push(`• ${p.name} (${p.size}) × ${l.qty} — ${money(p.price * l.qty)}`);
  });

  lines.push('');
  lines.push(`Subtotal: ${money(cartSubtotal())}`);
  lines.push(`Delivery: ${shippingCost() === 0 ? 'Free' : money(shippingCost())}`);
  lines.push(`*Total: ${money(cartTotal())}*`);

  if(details){
    lines.push('');
    lines.push(`Order ref: ${details.ref}`);
    lines.push(`Name: ${details.name}`);
    lines.push(`Phone: ${details.phone}`);
    lines.push(`City: ${details.city}`);
    lines.push(`Address: ${details.address}`);
    if(details.note) lines.push(`Note: ${details.note}`);
  }

  return lines.join('\n');
}

/** Message for a single fragrance, straight from the product page. */
function productMessage(product, qty){
  return [
    `*New order — ${STORE.name}*`,
    '',
    `• ${product.name} (${product.size}) × ${qty} — ${money(product.price * qty)}`,
    '',
    `Total: ${money(product.price * qty)}`,
    '',
    'Please confirm availability and delivery time.'
  ].join('\n');
}

/* ---------- 7. ORDER MODAL ---------- */
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

function openModal(){
  buildModal();
  renderOrderForm();
  const m = $('#orderModal');
  m.classList.add('is-open');
  m.setAttribute('aria-hidden', 'false');
  document.body.classList.add('no-scroll');
  setTimeout(() => $('#fName')?.focus(), 420);
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

function renderOrderForm(){
  $('#modalContent').innerHTML = `
    <p class="eyebrow">Checkout</p>
    <h2 class="modal-title" id="modalTitle">Place your order</h2>
    <p class="modal-lead">Cash on delivery. We confirm every order by phone or WhatsApp before it ships.</p>

    ${summaryMarkup()}

    <div class="field" id="wName">
      <label for="fName">Full name</label>
      <input id="fName" type="text" autocomplete="name" placeholder="Ayesha Khan">
      <p class="field-hint">Please enter your name.</p>
    </div>

    <div class="field-row">
      <div class="field" id="wPhone">
        <label for="fPhone">Phone</label>
        <input id="fPhone" type="tel" autocomplete="tel" inputmode="tel" placeholder="0300 1234567">
        <p class="field-hint">Enter a valid phone number.</p>
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
      <label for="fNote">Note <span style="text-transform:none;letter-spacing:0">(optional)</span></label>
      <input id="fNote" type="text" placeholder="Gift wrap, preferred delivery time…">
    </div>

    <div class="modal-actions">
      <button class="btn-solid btn-block" id="confirmOrder">Confirm Order</button>
    </div>

    <div class="modal-divider">or</div>

    <button class="btn-wa" id="waFormBtn">${waIcon} Send order on WhatsApp</button>
  `;

  $('#confirmOrder').addEventListener('click', submitOrder);
  $('#waFormBtn').addEventListener('click', () => {
    const details = readForm(false);
    openWhatsApp(cartMessage(details && details.name ? details : null));
  });
}

function readForm(validate = true){
  const get = id => ($(id)?.value || '').trim();
  const details = {
    name: get('#fName'),
    phone: get('#fPhone'),
    city: get('#fCity'),
    address: get('#fAddress'),
    note: get('#fNote'),
    ref: orderRef()
  };

  if(!validate) return details;

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

function submitOrder(){
  const details = readForm(true);
  if(!details) return;

  const message = cartMessage(details);
  renderOrderDone(details, message);

  /* Order is captured — clear the basket. */
  cart = [];
  saveCart();
  syncCart();
  closeDrawer();
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
      <p class="modal-lead">Thank you, ${esc(details.name.split(' ')[0])}. We'll call ${esc(details.phone)} within a few hours to confirm. Send the details across on WhatsApp to speed that up.</p>

      <div class="modal-actions">
        <button class="btn-wa" id="waDoneBtn">${waIcon} Send details on WhatsApp</button>
        <a class="btn-line" href="index.html#collection">Continue browsing</a>
      </div>
    </div>`;

  $('#waDoneBtn').addEventListener('click', () => openWhatsApp(message));
}

/* ---------- 8. NAVIGATION ---------- */
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

    /* hide on the way down, reveal on the way up */
    const menuOpen = links?.classList.contains('is-open');
    header.classList.toggle('is-hidden', y > 320 && y > lastY && !menuOpen);
    lastY = y;

    /* floating WhatsApp button appears past the hero */
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

/* ---------- 9. PRODUCT GRID ---------- */
function cardMarkup(p, i){
  return `
    <article class="card reveal" style="--d:${(i % 4) * 90}ms">
      <div class="card-media">
        <span class="card-img" style="background-image:url('${p.image}')"></span>
        <a class="card-link" href="product.html?id=${p.id}" aria-label="View ${p.name}"></a>
        <button class="quick-add" data-add="${p.id}">Quick Add</button>
      </div>
      <a class="card-body" href="product.html?id=${p.id}">
        <span>
          <span class="card-name">${p.name}</span>
          <span class="card-family">${p.family}</span>
        </span>
        <span class="card-price">${money(p.price)}</span>
      </a>
    </article>`;
}

function renderGrid(target, items){
  const grid = $(target);
  if(!grid) return;
  grid.innerHTML = items.map(cardMarkup).join('');
}

/* ---------- 10. PRODUCT DETAIL PAGE ---------- */
function initPDP(){
  if(!$('#pdp')) return;

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

  /* Quantity selector */
  const qtyValue = $('#qtyValue');
  let qty = 1;
  const setLocalQty = n => { qty = Math.min(10, Math.max(1, n)); qtyValue.value = qty; };

  $('#qtyMinus').addEventListener('click', () => setLocalQty(qty - 1));
  $('#qtyPlus').addEventListener('click',  () => setLocalQty(qty + 1));

  const add = () => { addToCart(product.id, qty); openDrawer(); };
  $('#addToCart').addEventListener('click', add);
  $('#buyBarAdd').addEventListener('click', add);

  $('#waProductBtn').addEventListener('click', () => openWhatsApp(productMessage(product, qty)));

  /* Sticky buy bar appears once the main CTA has scrolled past */
  const cta = $('#addToCart');
  const bar = $('#buyBar');
  if('IntersectionObserver' in window){
    new IntersectionObserver(([entry]) => {
      bar.classList.toggle('is-visible', !entry.isIntersecting && entry.boundingClientRect.top < 0);
    }, { threshold: 0 }).observe(cta);
  }

  /* Related — four other fragrances */
  renderGrid('#relatedGrid', CATALOG.filter(p => p.id !== product.id).slice(0, 4));
}

/* ---------- 11. SCROLL REVEAL ---------- */
function initReveal(){
  const items = $$('.reveal');
  if(!items.length) return;

  if(!('IntersectionObserver' in window)){
    items.forEach(el => el.classList.add('is-in'));
    return;
  }

  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: .12, rootMargin: '0px 0px -8% 0px' });

  items.forEach(el => io.observe(el));
}

/* ---------- 12. BOOT ---------- */
document.addEventListener('DOMContentLoaded', () => {
  loadCart();
  initNav();

  renderGrid('#productGrid', CATALOG);
  initPDP();

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

  /* Checkout paths */
  $('#checkoutBtn')?.addEventListener('click', () => {
    if(cart.length === 0){ showToast('Add a fragrance first'); return; }
    openModal();
  });

  $('#waCartBtn')?.addEventListener('click', () => {
    if(cart.length === 0){ showToast('Add a fragrance first'); return; }
    openWhatsApp(cartMessage(null));
  });

  /* Floating button + footer link — general enquiry */
  const generalMsg = `Hello ${STORE.name}, I'd like to ask about your fragrances.`;
  $('#waFloat')?.setAttribute('href', waLink(generalMsg));
  $('#waFloat')?.setAttribute('target', '_blank');
  $('#waFloat')?.setAttribute('rel', 'noopener');

  $$('[data-wa-general]').forEach(a => {
    a.setAttribute('href', waLink(generalMsg));
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener');
  });

  /* Delegated: Quick Add, drawer steppers, remove */
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
});
