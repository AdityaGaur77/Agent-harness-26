import { faker } from "@faker-js/faker";
import pg from "pg";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { Client } = pg;

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://blast:blast@demo-postgres:5432/blast_demo";
const customerCount = Number.parseInt(process.env.SEED_CUSTOMER_COUNT ?? "5000", 10);
const subjectId = 4471;

if (!Number.isInteger(customerCount) || customerCount < subjectId) {
  throw new Error(`SEED_CUSTOMER_COUNT must be an integer >= ${subjectId}`);
}

function syntheticCustomer(id) {
  if (id === subjectId) {
    return [
      id,
      "cleo.testsubject@example.invalid",
      "Cleo Testsubject",
      "+1-555-4471",
      new Date("2022-01-11T11:15:00Z"),
    ];
  }

  return [
    id,
    `customer-${id}@example.invalid`,
    faker.person.fullName(),
    `+1-555-${String(id).padStart(4, "0")}`,
    faker.date.between({ from: "2020-01-01T00:00:00Z", to: "2025-12-31T23:59:59Z" }),
  ];
}

function placeholders(rowCount, columnCount) {
  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const start = rowIndex * columnCount;
    return `(${Array.from({ length: columnCount }, (__, columnIndex) => `$${start + columnIndex + 1}`).join(", ")})`;
  }).join(", ");
}

async function insertRows(client, table, columns, rows, batchSize = 400) {
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    const values = batch.flat();
    const sql =
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES ` +
      placeholders(batch.length, columns.length);
    await client.query(sql, values);
  }
}

export function buildSeedRows() {
  faker.seed(4471);

  const customers = [];
  const addresses = [];
  const uploads = [];
  const supportTickets = [];
  const auditLog = [];
  const orders = [];
  const orderItems = [];

  let addressId = 1;
  let uploadId = 1;
  let ticketId = 1;
  let auditId = 1;
  let orderId = 1;
  let itemId = 1;

  for (let customerId = 1; customerId <= customerCount; customerId += 1) {
    customers.push(syntheticCustomer(customerId));

    if (customerId === subjectId) {
      for (let index = 0; index < 3; index += 1) {
        addresses.push([
          addressId++,
          customerId,
          `${index + 1} Imaginary Way`,
          "Springfield",
          `ZZ${index + 1} ${index + 1}ZZ`,
        ]);
      }
      for (let index = 0; index < 2; index += 1) {
        uploads.push([
          uploadId++,
          customerId,
          `customer-4471-document-${index + 1}.pdf`,
          `synthetic/4471/${faker.string.uuid()}.pdf`,
        ]);
      }
      supportTickets.push([
        ticketId++,
        customerId,
        "Where is my synthetic order?",
        "This is a generated support-ticket body for the Blast Radius demo.",
      ]);
      for (const action of ["account_created", "login", "profile_updated", "checkout_completed"]) {
        auditLog.push([
          auditId++,
          customerId,
          action,
          faker.date.between({ from: "2025-01-01T00:00:00Z", to: "2025-12-31T23:59:59Z" }),
        ]);
      }

      for (let orderIndex = 0; orderIndex < 8; orderIndex += 1) {
        const currentOrderId = orderId++;
        let totalCents = 0;
        for (let itemIndex = 0; itemIndex < 5; itemIndex += 1) {
          const qty = faker.number.int({ min: 1, max: 4 });
          const unitPriceCents = faker.number.int({ min: 500, max: 12_000 });
          totalCents += qty * unitPriceCents;
          orderItems.push([
            itemId++,
            currentOrderId,
            `SKU-4471-${orderIndex + 1}-${itemIndex + 1}`,
            qty,
            unitPriceCents,
          ]);
        }
        orders.push([
          currentOrderId,
          customerId,
          totalCents,
          faker.date.between({ from: "2021-01-01T00:00:00Z", to: "2025-12-31T23:59:59Z" }),
        ]);
      }
      continue;
    }

    if (customerId % 3 !== 0) {
      addresses.push([
        addressId++,
        customerId,
        faker.location.streetAddress(),
        faker.location.city(),
        faker.location.zipCode(),
      ]);
    }
    if (customerId % 7 === 0) {
      uploads.push([
        uploadId++,
        customerId,
        `synthetic-document-${customerId}.pdf`,
        `synthetic/${customerId}/${faker.string.uuid()}.pdf`,
      ]);
    }
    if (customerId % 11 === 0) {
      supportTickets.push([
        ticketId++,
        customerId,
        faker.lorem.sentence(),
        faker.lorem.paragraph(),
      ]);
    }
    auditLog.push([
      auditId++,
      customerId,
      "login",
      faker.date.between({ from: "2024-01-01T00:00:00Z", to: "2025-12-31T23:59:59Z" }),
    ]);

    const orderCount = customerId % 4;
    for (let orderIndex = 0; orderIndex < orderCount; orderIndex += 1) {
      const currentOrderId = orderId++;
      const itemCount = (customerId + orderIndex) % 3 + 1;
      let totalCents = 0;
      for (let itemIndex = 0; itemIndex < itemCount; itemIndex += 1) {
        const qty = faker.number.int({ min: 1, max: 4 });
        const unitPriceCents = faker.number.int({ min: 250, max: 15_000 });
        totalCents += qty * unitPriceCents;
        orderItems.push([
          itemId++,
          currentOrderId,
          `SKU-${faker.string.alphanumeric(10).toUpperCase()}`,
          qty,
          unitPriceCents,
        ]);
      }
      orders.push([
        currentOrderId,
        customerId,
        totalCents,
        faker.date.between({ from: "2020-01-01T00:00:00Z", to: "2025-12-31T23:59:59Z" }),
      ]);
    }
  }

  return { customers, addresses, uploads, supportTickets, auditLog, orders, orderItems };
}

async function assertRetentionPolicies(client) {
  const { rows } = await client.query(
    `SELECT table_name, basis, retain_years, pii_columns, anonymise_columns
       FROM retention_policies
      ORDER BY table_name`,
  );
  const expected = [
    {
      table_name: "customers",
      basis: "none",
      retain_years: 0,
      pii_columns: ["email", "full_name", "phone"],
      anonymise_columns: ["email", "full_name", "phone"],
    },
    {
      table_name: "order_items",
      basis: "tax",
      retain_years: 7,
      pii_columns: [],
      anonymise_columns: [],
    },
    {
      table_name: "orders",
      basis: "tax",
      retain_years: 7,
      pii_columns: [],
      anonymise_columns: [],
    },
    {
      table_name: "support_tickets",
      basis: "none",
      retain_years: 0,
      pii_columns: ["subject", "body"],
      anonymise_columns: [],
    },
  ];
  if (JSON.stringify(rows) !== JSON.stringify(expected)) {
    throw new Error(`Unexpected retention policies: ${JSON.stringify(rows)}`);
  }
}

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query("BEGIN");
    await assertRetentionPolicies(client);
    await client.query(
      "TRUNCATE order_items, orders, audit_log, support_tickets, uploads, addresses, customers RESTART IDENTITY CASCADE",
    );

    const rows = buildSeedRows();
    await insertRows(client, "customers", ["id", "email", "full_name", "phone", "created_at"], rows.customers);
    await insertRows(client, "addresses", ["id", "customer_id", "line1", "city", "postcode"], rows.addresses);
    await insertRows(client, "uploads", ["id", "customer_id", "filename", "object_key"], rows.uploads);
    await insertRows(client, "support_tickets", ["id", "customer_id", "subject", "body"], rows.supportTickets);
    await insertRows(client, "audit_log", ["id", "actor_customer_id", "action", "at"], rows.auditLog);
    await insertRows(client, "orders", ["id", "customer_id", "total_cents", "placed_at"], rows.orders);
    await insertRows(client, "order_items", ["id", "order_id", "sku", "qty", "unit_price_cents"], rows.orderItems);

    for (const table of [
      "customers",
      "addresses",
      "uploads",
      "support_tickets",
      "audit_log",
      "orders",
      "order_items",
    ]) {
      await client.query(
        `SELECT setval(pg_get_serial_sequence($1, 'id'), (SELECT MAX(id) FROM ${table}), true)`,
        [table],
      );
    }

    await client.query("COMMIT");

    const { rows: subjectRows } = await client.query(
      `SELECT
         (SELECT COUNT(*)::int FROM addresses WHERE customer_id = $1) AS addresses,
         (SELECT COUNT(*)::int FROM uploads WHERE customer_id = $1) AS uploads,
         (SELECT COUNT(*)::int FROM support_tickets WHERE customer_id = $1) AS support_tickets,
         (SELECT COUNT(*)::int FROM audit_log WHERE actor_customer_id = $1) AS audit_events,
         (SELECT COUNT(*)::int FROM orders WHERE customer_id = $1) AS orders,
         (SELECT COUNT(*)::int
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
           WHERE o.customer_id = $1) AS order_items`,
      [subjectId],
    );

    console.log(
      JSON.stringify(
        {
          synthetic: true,
          customers: rows.customers.length,
          subject_id: subjectId,
          subject_history: subjectRows[0],
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
