/* ============================================================
   SCENTIQUE — supabase.js
   Shared client, store settings and the product catalog.
   Imported by both script.js (shop) and admin.js (panel).
   ============================================================ */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

/* ---------- Project credentials ----------
   The publishable key is safe in the browser: Row Level Security
   in schema.sql decides what it is actually allowed to do.
------------------------------------------- */
export const SUPABASE_URL = 'https://ptwgiadzpzawjftfxwwf.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_Qoy-USZ2VP94_n5x1BcjWQ_HV5deVBB';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/* Admin username maps to this Supabase Auth email. */
export const ADMIN_EMAIL = 'abubakar@scentique.store';

/* ---------- Store settings ----------
   Defaults are used until the settings table answers. The admin
   panel writes to that table, so the site picks changes up on
   the next page load.
-------------------------------------- */
export const STORE = {
  name: 'Scentique',
  whatsapp: '923001234567',
  email: 'hello@scentiqueperfumes.store',
  freeShippingFrom: 10000,
  shippingFlat: 250,
  announcement: '',
  ordersOpen: true
};

export async function loadSettings(){
  try{
    const { data, error } = await supabase
      .from('perfumeswebsite_settings')
      .select('key, value');

    if(error || !data) return STORE;

    const map = Object.fromEntries(data.map(r => [r.key, r.value]));
    if(map.whatsapp_number)    STORE.whatsapp = map.whatsapp_number;
    if(map.store_email)        STORE.email = map.store_email;
    if(map.free_shipping_from) STORE.freeShippingFrom = Number(map.free_shipping_from);
    if(map.shipping_flat)      STORE.shippingFlat = Number(map.shipping_flat);
    if(map.announcement)       STORE.announcement = map.announcement;
    if(map.orders_open)        STORE.ordersOpen = map.orders_open === 'true';
  }catch(e){
    /* offline or blocked — the defaults above keep the shop usable */
  }
  return STORE;
}

/* ---------- Catalog ----------
   These are fallbacks only. The real catalog lives in
   perfumeswebsite_products and is managed from the admin panel;
   loadCatalog() replaces the list below at page load. If the
   database is unreachable, the shop still works off these.
-------------------------------- */
const DEFAULT_CATALOG = [
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

/* Mutated in place by loadCatalog(), so every module that imported
   CATALOG sees the same up-to-date array. */
export const CATALOG = [...DEFAULT_CATALOG];

export const findProduct = id => CATALOG.find(p => p.id === id);

/** Turns a database row into the shape the shop expects. */
export function rowToProduct(r){
  /* images[] is the source of truth; fall back to the old single
     column so older rows keep working. */
  const images = (Array.isArray(r.images) && r.images.length)
    ? r.images.filter(Boolean)
    : (r.image ? [r.image] : []);

  return {
    id: r.id,
    name: r.name,
    family: r.family || '',
    price: Number(r.price) || 0,
    size: r.size || '50 ml',
    conc: r.conc || 'Eau de Parfum',
    lasts: r.lasts || '',
    images,
    image: images[0] || '',
    desc: r.description || '',
    notes: {
      top: r.note_top || '',
      heart: r.note_heart || '',
      base: r.note_base || ''
    }
  };
}

/** Loads the live catalog.

   An empty result means the shop genuinely has no products — the
   defaults are only used when the database cannot be reached at all.
   (Falling back on an empty result is why deleted products used to
   reappear on the site.) */
export async function loadCatalog(){
  try{
    const { data, error } = await supabase
      .from('perfumeswebsite_products')
      .select('*')
      .is('deleted_at', null)
      .eq('active', true)
      .order('sort_order', { ascending: true });

    if(error) throw error;

    CATALOG.length = 0;
    (data || []).forEach(r => CATALOG.push(rowToProduct(r)));
    catalogLoaded = true;
  }catch(e){
    console.warn('Catalog could not be loaded, using built-in list:', e?.message || e);
  }
  return CATALOG;
}

/* True once the database answered, however many rows it returned. */
export let catalogLoaded = false;

/* ---------- Image storage ---------- */
export const IMAGE_BUCKET = 'perfumeswebsite-images';

/** Uploads one file and returns its public URL. */
export async function uploadImage(file, productId = 'misc'){
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const safe = String(productId || 'misc').replace(/[^a-z0-9-]/gi, '') || 'misc';
  const path = `${safe}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false });

  if(error) throw error;

  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Removes an uploaded image. Ignores files hosted elsewhere. */
export async function deleteImage(url){
  const marker = `/${IMAGE_BUCKET}/`;
  const at = String(url).indexOf(marker);
  if(at === -1) return;

  const path = url.slice(at + marker.length).split('?')[0];
  await supabase.storage.from(IMAGE_BUCKET).remove([decodeURIComponent(path)]);
}

/* ---------- Shared helpers ---------- */
export const money = n => 'Rs. ' + Number(n || 0).toLocaleString('en-PK');

export const esc = str => String(str ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

/** 0300 1234567 / +92 300 1234567 -> 923001234567 */
export function normalisePhone(raw){
  let d = String(raw || '').replace(/\D/g, '');
  if(d.startsWith('0'))   d = '92' + d.slice(1);
  if(d.startsWith('920')) d = '92' + d.slice(3);
  if(d.length === 10 && d.startsWith('3')) d = '92' + d;
  return d;
}

export const waLink = (number, text) =>
  `https://wa.me/${normalisePhone(number)}?text=${encodeURIComponent(text)}`;

export const orderRef = () =>
  'SCQ-' + Math.random().toString(36).slice(2, 8).toUpperCase();

export const waIcon = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.6 2 2.2 6.4 2.2 11.84c0 1.74.46 3.44 1.32 4.94L2 22l5.36-1.4a9.9 9.9 0 0 0 4.68 1.18h.01c5.43 0 9.84-4.4 9.84-9.84S17.47 2 12.04 2Zm0 18.02a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.18.83.85-3.1-.2-.32a8.16 8.16 0 1 1 7.01 3.91Zm4.5-6.12c-.25-.12-1.46-.72-1.68-.8-.23-.09-.39-.13-.56.12-.16.25-.64.8-.78.97-.15.16-.29.18-.53.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.7-.15-.25-.02-.38.11-.5.11-.11.25-.29.37-.44.13-.15.17-.25.25-.41.09-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42h-.48c-.16 0-.43.06-.65.31-.23.25-.86.84-.86 2.05s.88 2.38 1 2.54c.13.17 1.74 2.65 4.2 3.72.59.25 1.05.4 1.4.52.59.18 1.13.16 1.55.1.47-.07 1.46-.6 1.66-1.17.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.28Z"/></svg>`;
