-- ============================================================
--  SCENTIQUE — Supabase schema
--  Project: ptwgiadzpzawjftfxwwf
--
--  HOW TO RUN
--  1. Supabase Dashboard -> SQL Editor -> New query
--  2. Paste this whole file and press Run
--  3. Then go to Authentication -> Users -> Add user:
--        Email:    abubakar@scentique.store
--        Password: @bubakar
--        Tick "Auto Confirm User"
--     (The admin panel asks for the username "abubakar" and maps it
--      to this email behind the scenes.)
--
--  Every table is prefixed perfumeswebsite_
-- ============================================================

-- ------------------------------------------------------------
-- 1. ORDERS
-- ------------------------------------------------------------
create table if not exists perfumeswebsite_orders (
  id            uuid primary key default gen_random_uuid(),
  ref           text unique not null,
  customer_name text not null,
  phone         text not null,
  city          text not null,
  address       text not null,
  note          text,
  subtotal      integer not null default 0,
  shipping      integer not null default 0,
  total         integer not null default 0,
  status        text not null default 'pending'
                check (status in ('pending','confirmed','completed','cancelled')),
  source        text not null default 'website'
                check (source in ('website','whatsapp')),
  confirmed_at  timestamptz,
  completed_at  timestamptz,
  deleted_at    timestamptz,          -- soft delete; null = live
  created_at    timestamptz not null default now()
);

create index if not exists perfumeswebsite_orders_created_idx
  on perfumeswebsite_orders (created_at desc);
create index if not exists perfumeswebsite_orders_status_idx
  on perfumeswebsite_orders (status);
create index if not exists perfumeswebsite_orders_deleted_idx
  on perfumeswebsite_orders (deleted_at);

-- ------------------------------------------------------------
-- 2. ORDER ITEMS
--    Name and price are snapshotted so past orders stay correct
--    even if the catalog changes later.
-- ------------------------------------------------------------
create table if not exists perfumeswebsite_order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references perfumeswebsite_orders(id) on delete cascade,
  product_id   text not null,
  product_name text not null,
  size         text,
  unit_price   integer not null,
  qty          integer not null check (qty > 0),
  line_total   integer not null,
  created_at   timestamptz not null default now()
);

create index if not exists perfumeswebsite_order_items_order_idx
  on perfumeswebsite_order_items (order_id);

-- ------------------------------------------------------------
-- 3. REVIEWS
-- ------------------------------------------------------------
create table if not exists perfumeswebsite_reviews (
  id           uuid primary key default gen_random_uuid(),
  product_id   text,                  -- null = general store review
  product_name text,
  author       text not null,
  city         text,
  rating       smallint not null check (rating between 1 and 5),
  body         text not null,
  approved     boolean not null default false,
  deleted_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists perfumeswebsite_reviews_product_idx
  on perfumeswebsite_reviews (product_id);
create index if not exists perfumeswebsite_reviews_approved_idx
  on perfumeswebsite_reviews (approved, deleted_at);

-- ------------------------------------------------------------
-- 4. SETTINGS  (key/value — WhatsApp number, shipping rules, etc.)
-- ------------------------------------------------------------
create table if not exists perfumeswebsite_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

insert into perfumeswebsite_settings (key, value) values
  ('whatsapp_number',    '923001234567'),
  ('store_email',        'hello@scentiqueperfumes.store'),
  ('free_shipping_from', '10000'),
  ('shipping_flat',      '250'),
  ('announcement',       'Free delivery on orders above Rs. 10,000'),
  ('orders_open',        'true')
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- 5. ACTIVITY LOG (who changed what, for the admin timeline)
-- ------------------------------------------------------------
create table if not exists perfumeswebsite_activity (
  id         uuid primary key default gen_random_uuid(),
  entity     text not null,           -- 'order' | 'review' | 'settings'
  entity_id  text,
  action     text not null,           -- 'created' | 'status' | 'deleted' | ...
  detail     text,
  created_at timestamptz not null default now()
);

create index if not exists perfumeswebsite_activity_created_idx
  on perfumeswebsite_activity (created_at desc);

-- ------------------------------------------------------------
-- 6. ROW LEVEL SECURITY
--    Public (anon key, used by the shop) can only INSERT orders
--    and reviews, and READ approved reviews + settings.
--    Everything else needs a logged-in admin.
-- ------------------------------------------------------------
alter table perfumeswebsite_orders      enable row level security;
alter table perfumeswebsite_order_items enable row level security;
alter table perfumeswebsite_reviews     enable row level security;
alter table perfumeswebsite_settings    enable row level security;
alter table perfumeswebsite_activity    enable row level security;

-- Orders: shoppers may place them, only admins may read or change them.
drop policy if exists "public can place orders" on perfumeswebsite_orders;
create policy "public can place orders"
  on perfumeswebsite_orders for insert to anon with check (true);

drop policy if exists "admin manages orders" on perfumeswebsite_orders;
create policy "admin manages orders"
  on perfumeswebsite_orders for all to authenticated
  using (true) with check (true);

-- Order items: same shape.
drop policy if exists "public can add order items" on perfumeswebsite_order_items;
create policy "public can add order items"
  on perfumeswebsite_order_items for insert to anon with check (true);

drop policy if exists "admin manages order items" on perfumeswebsite_order_items;
create policy "admin manages order items"
  on perfumeswebsite_order_items for all to authenticated
  using (true) with check (true);

-- Reviews: anyone can submit (unapproved), anyone can read approved ones.
drop policy if exists "public can submit reviews" on perfumeswebsite_reviews;
create policy "public can submit reviews"
  on perfumeswebsite_reviews for insert to anon
  with check (approved = false and deleted_at is null);

drop policy if exists "public reads approved reviews" on perfumeswebsite_reviews;
create policy "public reads approved reviews"
  on perfumeswebsite_reviews for select to anon
  using (approved = true and deleted_at is null);

drop policy if exists "admin manages reviews" on perfumeswebsite_reviews;
create policy "admin manages reviews"
  on perfumeswebsite_reviews for all to authenticated
  using (true) with check (true);

-- Settings: readable by the shop, writable by admins only.
drop policy if exists "public reads settings" on perfumeswebsite_settings;
create policy "public reads settings"
  on perfumeswebsite_settings for select to anon using (true);

drop policy if exists "admin manages settings" on perfumeswebsite_settings;
create policy "admin manages settings"
  on perfumeswebsite_settings for all to authenticated
  using (true) with check (true);

-- Activity: admin only.
drop policy if exists "admin reads activity" on perfumeswebsite_activity;
create policy "admin reads activity"
  on perfumeswebsite_activity for all to authenticated
  using (true) with check (true);

-- ------------------------------------------------------------
-- 7. ORDER REFERENCE + TIMESTAMP AUTOMATION
-- ------------------------------------------------------------
create or replace function perfumeswebsite_touch_status()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'confirmed' and new.confirmed_at is null then
      new.confirmed_at := now();
    end if;
    if new.status = 'completed' and new.completed_at is null then
      new.completed_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists perfumeswebsite_orders_status_trg on perfumeswebsite_orders;
create trigger perfumeswebsite_orders_status_trg
  before update on perfumeswebsite_orders
  for each row execute function perfumeswebsite_touch_status();

-- ------------------------------------------------------------
-- 8. DASHBOARD VIEW — daily revenue for the chart
-- ------------------------------------------------------------
create or replace view perfumeswebsite_daily_sales as
select
  date_trunc('day', created_at)::date as day,
  count(*)                            as orders,
  coalesce(sum(total), 0)             as revenue
from perfumeswebsite_orders
where deleted_at is null
  and status <> 'cancelled'
group by 1
order by 1;

-- ------------------------------------------------------------
-- 9. REALTIME — so new orders appear in the dashboard live
-- ------------------------------------------------------------
alter publication supabase_realtime add table perfumeswebsite_orders;
alter publication supabase_realtime add table perfumeswebsite_reviews;

-- ------------------------------------------------------------
-- 10. SAMPLE REVIEWS (delete these once real ones arrive)
-- ------------------------------------------------------------
insert into perfumeswebsite_reviews (product_id, product_name, author, city, rating, body, approved)
values
  ('noir-oud',      'Noir Oud',      'Hamza R.',  'Lahore',    5,
   'Wore this to a winter wedding and three people asked what it was. The opening is sharp, but after twenty minutes it settles into something much warmer. Lasts the whole night.', true),
  ('fleur-blanche', 'Fleur Blanche', 'Sana M.',   'Karachi',   5,
   'I usually find tuberose too heavy. This one stays soft and clean on my skin, and the sillage is polite rather than loud. My everyday now.', true),
  ('citrus-eclat',  'Citrus Éclat',  'Bilal A.',  'Islamabad', 4,
   'Excellent for office mornings and it genuinely lasts past lunch, which most citrus scents do not. Only wish the bottle were larger.', true)
on conflict do nothing;
