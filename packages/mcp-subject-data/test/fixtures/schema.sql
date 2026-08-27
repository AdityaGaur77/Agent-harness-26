-- Test fixture for the subject-data MCP server.
--
-- SCOPE: this file exists ONLY so this package's tests (and a developer poking
-- at the server by hand) have a local Postgres to talk to. It is NOT the demo
-- seed — the production/demo seed is owned by another teammate and lives
-- outside this package. Do not point the demo at this file, and do not treat
-- anything in here as the real data or the real rules.
--
-- Load with:  psql "$DATABASE_URL" -f test/fixtures/schema.sql
--
-- Idempotent: every table is dropped first, so re-running resets the world.
-- Primary keys are written out explicitly rather than generated, so tests can
-- assert on exact ids and exact counts.

BEGIN;

DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS support_tickets CASCADE;
DROP TABLE IF EXISTS uploads CASCADE;
DROP TABLE IF EXISTS addresses CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS retention_policies CASCADE;

-- ---------------------------------------------------------------------------
-- Tables
--
-- The mix of ON DELETE actions is the point of the fixture: CASCADE edges make
-- a naive delete destroy rows nobody named, SET NULL edges orphan rows instead,
-- and the two-hop orders -> order_items path exercises transitive linkage.
-- ---------------------------------------------------------------------------

CREATE TABLE customers (
  id         INTEGER PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  full_name  TEXT NOT NULL,
  phone      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE addresses (
  id          INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
  line1       TEXT NOT NULL,
  postcode    TEXT
);

CREATE TABLE uploads (
  id          INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
  filename    TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Nullable FK: ON DELETE SET NULL needs somewhere to put the NULL.
CREATE TABLE support_tickets (
  id          INTEGER PRIMARY KEY,
  customer_id INTEGER REFERENCES customers (id) ON DELETE SET NULL,
  subject     TEXT NOT NULL,
  body        TEXT
);

CREATE TABLE audit_log (
  id                INTEGER PRIMARY KEY,
  actor_customer_id INTEGER REFERENCES customers (id) ON DELETE SET NULL,
  action            TEXT NOT NULL,
  at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  id          INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
  total_cents INTEGER NOT NULL,
  placed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
  id               INTEGER PRIMARY KEY,
  order_id         INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  sku              TEXT NOT NULL,
  qty              INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL
);

CREATE TABLE retention_policies (
  table_name         TEXT PRIMARY KEY,
  basis              TEXT NOT NULL,
  retain_years       INTEGER NOT NULL,
  pii_columns        TEXT[] NOT NULL DEFAULT '{}',
  anonymise_columns  TEXT[] NOT NULL DEFAULT '{}'
);

-- ---------------------------------------------------------------------------
-- Retention policies
--
-- These are THE FIXTURE'S values, chosen to make the tests deterministic. The
-- production seed owns the real ones and may differ in every column. Nothing in
-- the server hardcodes any of this: the agent is expected to discover it by
-- reading this table, which is exactly what the tests check.
-- ---------------------------------------------------------------------------

INSERT INTO retention_policies
  (table_name, basis, retain_years, pii_columns, anonymise_columns)
VALUES
  ('orders',          'tax',  7, '{}',                      '{}'),
  ('order_items',     'tax',  7, '{}',                      '{}'),
  ('customers',       'none', 0, '{email,full_name,phone}', '{email,full_name,phone}'),
  ('support_tickets', 'none', 0, '{}',                      '{}');

-- ---------------------------------------------------------------------------
-- Synthetic data. Every name and address is invented; every email uses the
-- reserved .invalid TLD so none of it can ever resolve to a real person.
--
-- Subject 4471 is the fixture's worked example: 3 addresses, 2 uploads,
-- 1 support ticket, 2 audit_log rows, 3 orders, 7 order_items.
-- ---------------------------------------------------------------------------

INSERT INTO customers (id, email, full_name, phone, created_at) VALUES
  (1001, 'ada.fake@example.invalid',      'Ada Fakename',      '+44 7000 900001', '2021-03-04T09:00:00Z'),
  (1002, 'brendan.fake@example.invalid',  'Brendan Notreal',   '+44 7000 900002', '2021-07-19T14:30:00Z'),
  (4471, 'cleo.fake@example.invalid',     'Cleo Testsubject',  '+44 7000 904471', '2022-01-11T11:15:00Z'),
  (5150, 'dmitri.fake@example.invalid',   'Dmitri Placeholder', NULL,             '2022-06-02T08:45:00Z'),
  (6023, 'esther.fake@example.invalid',   'Esther Synthetic',  '+44 7000 906023', '2023-02-28T16:05:00Z'),
  (7788, 'farhan.fake@example.invalid',   'Farhan Madeup',     '+44 7000 907788', '2024-09-30T10:20:00Z');

INSERT INTO addresses (id, customer_id, line1, postcode) VALUES
  (1,  4471, '1 Nowhere Lane',        'ZZ1 1AA'),
  (2,  4471, '2 Imaginary Court',     'ZZ2 2BB'),
  (3,  4471, 'Flat 9, Fictional Way', 'ZZ3 3CC'),
  (4,  1001, '17 Placeholder Road',   'ZZ4 4DD'),
  (5,  6023, '88 Sample Street',      'ZZ5 5EE');

INSERT INTO uploads (id, customer_id, filename, uploaded_at) VALUES
  (1, 4471, 'passport-scan.fake.png',   '2022-01-12T09:30:00Z'),
  (2, 4471, 'proof-of-address.fake.pdf','2022-03-01T13:00:00Z'),
  (3, 1002, 'receipt.fake.pdf',         '2023-05-06T17:45:00Z');

INSERT INTO support_tickets (id, customer_id, subject, body) VALUES
  (1, 4471, 'Where is my order?',        'Placeholder ticket body for the fixture.'),
  (2, 1001, 'Change of address',         'Placeholder ticket body for the fixture.'),
  (3, 7788, 'Refund request',            'Placeholder ticket body for the fixture.');

INSERT INTO audit_log (id, actor_customer_id, action, at) VALUES
  (1, 4471, 'login',            '2022-01-11T11:16:00Z'),
  (2, 4471, 'update_profile',   '2022-04-18T19:02:00Z'),
  (3, 1002, 'login',            '2023-05-06T17:40:00Z'),
  (4, NULL, 'system_backup',    '2024-01-01T00:00:00Z');

INSERT INTO orders (id, customer_id, total_cents, placed_at) VALUES
  (9001, 4471, 4250,  '2022-02-14T12:00:00Z'),
  (9002, 4471, 11800, '2023-08-09T15:22:00Z'),
  (9003, 4471, 990,   '2024-11-21T20:10:00Z'),
  (9004, 1001, 3400,  '2023-01-05T10:00:00Z'),
  (9005, 6023, 7600,  '2024-03-17T09:40:00Z');

-- 7 items for subject 4471, spread 3 / 2 / 2 across orders 9001-9003.
INSERT INTO order_items (id, order_id, sku, qty, unit_price_cents) VALUES
  (1, 9001, 'SKU-FAKE-001', 1, 1500),
  (2, 9001, 'SKU-FAKE-002', 2, 1000),
  (3, 9001, 'SKU-FAKE-003', 1, 750),
  (4, 9002, 'SKU-FAKE-004', 3, 3000),
  (5, 9002, 'SKU-FAKE-005', 1, 2800),
  (6, 9003, 'SKU-FAKE-006', 1, 500),
  (7, 9003, 'SKU-FAKE-007', 1, 490),
  (8, 9004, 'SKU-FAKE-001', 2, 1700),
  (9, 9005, 'SKU-FAKE-008', 4, 1900);

COMMIT;
