import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DB_PATH =
  process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "grocery.db");

// Keep one connection across hot reloads in dev.
const globalForDb = globalThis as unknown as { groceryDb?: DatabaseSync };

export function getDb(): DatabaseSync {
  if (!globalForDb.groceryDb) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const db = new DatabaseSync(DB_PATH);
    db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
    `);
    migrate(db);
    globalForDb.groceryDb = db;
  }
  return globalForDb.groceryDb;
}

export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

// Each entry upgrades the schema by one version. Append new ones; never edit old ones.
const MIGRATIONS: ((db: DatabaseSync) => void)[] = [
  (db) => {
    db.exec(`
      CREATE TABLE lists (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );

      CREATE TABLE items (
        id           TEXT PRIMARY KEY,
        list_id      TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
        name         TEXT NOT NULL,
        quantity     INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
        price_cents  INTEGER CHECK (price_cents IS NULL OR price_cents >= 0),
        category     TEXT NOT NULL DEFAULT 'Other',
        checked      INTEGER NOT NULL DEFAULT 0,
        is_sample    INTEGER NOT NULL DEFAULT 0,
        created_at   TEXT NOT NULL
      );

      CREATE INDEX items_list_id ON items(list_id);
    `);
    seedSample(db);
  },
  (db) => {
    // A meal is a reusable set of ingredients. Each ingredient has the same
    // fields as a list item, so adding a meal to a list copies them in.
    db.exec(`
      CREATE TABLE meals (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );

      CREATE TABLE meal_ingredients (
        id           TEXT PRIMARY KEY,
        meal_id      TEXT NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
        name         TEXT NOT NULL,
        quantity     INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
        price_cents  INTEGER CHECK (price_cents IS NULL OR price_cents >= 0),
        category     TEXT NOT NULL DEFAULT 'Other',
        created_at   TEXT NOT NULL
      );

      CREATE INDEX meal_ingredients_meal_id ON meal_ingredients(meal_id);
    `);
  },
];

function migrate(db: DatabaseSync) {
  const { user_version: current } = db
    .prepare("PRAGMA user_version")
    .get() as { user_version: number };

  for (let v = current; v < MIGRATIONS.length; v++) {
    transaction(db, () => {
      MIGRATIONS[v](db);
      db.exec(`PRAGMA user_version = ${v + 1}`);
    });
  }
}

const SAMPLE_ITEMS: [name: string, qty: number, cents: number, category: string][] = [
  ["Bananas", 1, 129, "Produce"],
  ["Spinach", 1, 399, "Produce"],
  ["Avocados", 2, 249, "Produce"],
  ["Greek Yogurt", 1, 549, "Dairy & Eggs"],
  ["Milk", 1, 429, "Dairy & Eggs"],
  ["Chicken Breast", 1, 899, "Meat & Seafood"],
  ["Olive Oil", 1, 799, "Pantry"],
  ["Rice", 1, 349, "Pantry"],
  ["Tortilla Chips", 1, 379, "Snacks"],
];

// Runs once, on first start, so a new install has something to look at.
function seedSample(db: DatabaseSync) {
  const listId = randomUUID();
  const base = Date.now();
  const now = new Date(base).toISOString();
  db.prepare(
    "INSERT INTO lists (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
  ).run(listId, "My Grocery List", now, now);

  const insert = db.prepare(`
    INSERT INTO items (id, list_id, name, quantity, price_cents, category, is_sample, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  `);
  SAMPLE_ITEMS.forEach(([name, qty, cents, category], i) => {
    // Stagger timestamps so items keep their order.
    const createdAt = new Date(base + i).toISOString();
    insert.run(randomUUID(), listId, name, qty, cents, category, createdAt);
  });
}
