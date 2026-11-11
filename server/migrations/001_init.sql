-- Начальная схема PC Market (Postgres / Neon).
-- Суммы в сумах хранятся как bigint, характеристики и параметры FPS — как jsonb.

CREATE TABLE IF NOT EXISTS categories (
  key      text PRIMARY KEY,
  name_ru  text NOT NULL,
  name_uz  text NOT NULL,
  sort     integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id             integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category       text NOT NULL REFERENCES categories(key),
  slug           text NOT NULL UNIQUE,
  brand          text NOT NULL,
  name           text NOT NULL,
  price_uzs      bigint NOT NULL CHECK (price_uzs >= 0),
  stock          integer NOT NULL DEFAULT 10 CHECK (stock >= 0),
  image          text,
  specs          jsonb NOT NULL DEFAULT '{}'::jsonb,
  description_ru text,
  description_uz text,
  model_url      text,
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category, active);

CREATE TABLE IF NOT EXISTS games (
  id       integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug     text NOT NULL UNIQUE,
  title    text NOT NULL,
  year     integer,
  cover    text,
  gpu_fps  jsonb NOT NULL,
  cpu_fps  jsonb NOT NULL,
  vram     jsonb NOT NULL,
  ram_gb   integer NOT NULL DEFAULT 16,
  builtin  boolean NOT NULL DEFAULT true,
  active   boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS orders (
  id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_name   text NOT NULL,
  phone           text NOT NULL,
  address         text,
  comment         text,
  lang            text NOT NULL DEFAULT 'ru',
  total_uzs       bigint NOT NULL,
  status          text NOT NULL DEFAULT 'new' CHECK (status IN ('new','paid','shipped','done','cancelled')),
  receipt_file    text NOT NULL,          -- ключ объекта в бакете receipts
  receipt_mime    text NOT NULL,
  receipt_name    text,
  telegram_status text NOT NULL DEFAULT 'pending' CHECK (telegram_status IN ('pending','sent','failed','disabled')),
  telegram_error  text,
  admin_note      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status, created_at);

CREATE TABLE IF NOT EXISTS order_items (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id   integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  brand      text NOT NULL,
  name       text NOT NULL,
  price_uzs  bigint NOT NULL,
  qty        integer NOT NULL CHECK (qty > 0)
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id);

CREATE TABLE IF NOT EXISTS settings (
  key   text PRIMARY KEY,
  value text NOT NULL
);
