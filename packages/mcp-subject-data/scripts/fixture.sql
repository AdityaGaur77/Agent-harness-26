-- LOCAL VERIFICATION FIXTURE ONLY.
-- The real seeded database (Faker, ~50k customers) belongs to demo/seed (Nishad).
-- This exists so packages/mcp-subject-data/scripts/smoke.mjs can verify the
-- tools end-to-end against the same foreign-key trap the real seed will carry.
-- All data is synthetic.

DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

CREATE TABLE customers (
  id         bigint PRIMARY KEY,
  email      text NOT NULL,
  full_name  text NOT NULL,
  phone      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE addresses (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id bigint NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  line1       text,
  city        text
);

CREATE TABLE uploads (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id  bigint NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  filename     text,
  content_type text
);

CREATE TABLE support_tickets (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id bigint REFERENCES customers(id) ON DELETE SET NULL,
  subject     text,
  status      text
);

CREATE TABLE audit_log (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_customer_id bigint REFERENCES customers(id) ON DELETE SET NULL,
  action            text,
  occurred_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id   bigint REFERENCES customers(id) ON DELETE CASCADE,
  total_cents   integer NOT NULL,
  placed_at     timestamptz NOT NULL DEFAULT now(),
  billing_email text
);

CREATE TABLE order_items (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id         bigint NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sku              text NOT NULL,
  qty              integer NOT NULL,
  unit_price_cents integer NOT NULL
);

CREATE TABLE retention_policies (
  table_name        text PRIMARY KEY,
  basis             text NOT NULL,
  retain_years      integer NOT NULL,
  pii_columns       text[] NOT NULL DEFAULT '{}',
  anonymise_columns text[] NOT NULL DEFAULT '{}'
);

INSERT INTO retention_policies (table_name, basis, retain_years, pii_columns, anonymise_columns) VALUES
  ('customers',       'none', 0, '{email,full_name,phone}', '{}'),
  ('addresses',       'none', 0, '{line1}',                 '{}'),
  ('uploads',         'none', 0, '{filename}',              '{}'),
  ('support_tickets', 'none', 0, '{subject}',               '{}'),
  ('audit_log',       'none', 0, '{}',                      '{}'),
  ('orders',          'tax',  7, '{billing_email}',         '{billing_email}'),
  ('order_items',     'tax',  7, '{}',                      '{sku}');

-- customer 4471: the erasure target
INSERT INTO customers (id, email, full_name, phone) VALUES
  (4471, 'customer4471@example.test', 'Jane Q Synthetic', '+1-555-0100');

INSERT INTO addresses (customer_id, line1, city)
  SELECT 4471, '1 Test St', 'Springfield' FROM generate_series(1, 3);
INSERT INTO uploads (customer_id, filename, content_type)
  SELECT 4471, 'invoice-' || g || '.pdf', 'application/pdf' FROM generate_series(1, 5) g;
INSERT INTO support_tickets (customer_id, subject, status)
  SELECT 4471, 'Ticket ' || g, 'open' FROM generate_series(1, 2) g;
INSERT INTO audit_log (actor_customer_id, action)
  SELECT 4471, 'login' FROM generate_series(1, 7) g;
INSERT INTO orders (customer_id, total_cents, billing_email)
  SELECT 4471, 1000 * g, 'billing4471@example.test' FROM generate_series(1, 12) g;
INSERT INTO order_items (order_id, sku, qty, unit_price_cents)
  SELECT o.id, 'SKU-' || o.id, 2, 500 FROM orders o WHERE o.customer_id = 4471;

-- filler subjects so blast radius is distinguishable from background noise
INSERT INTO customers (id, email, full_name)
  SELECT 10000 + g, 'filler' || g || '@example.test', 'Filler ' || g FROM generate_series(1, 200) g;
INSERT INTO orders (customer_id, total_cents, billing_email)
  SELECT 10000 + g, 999, 'billing' || g || '@example.test' FROM generate_series(1, 200) g;
