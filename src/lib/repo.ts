import { randomUUID } from "node:crypto";
import { getDb, transaction } from "./db";
import { CATEGORIES, DEFAULT_CATEGORY, type Category } from "./categories";
import type { ClearScope, ItemCreate, ItemUpdate } from "./schema";
import type { Item, List, ListSummary } from "./types";

type Row = Record<string, unknown>;

function toList(row: Row): List {
  return {
    id: String(row.id),
    name: String(row.name),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toCategory(value: unknown): Category {
  return (CATEGORIES as readonly string[]).includes(value as string)
    ? (value as Category)
    : DEFAULT_CATEGORY;
}

function toItem(row: Row): Item {
  return {
    id: String(row.id),
    listId: String(row.list_id),
    name: String(row.name),
    quantity: Number(row.quantity),
    priceCents: row.price_cents === null ? null : Number(row.price_cents),
    category: toCategory(row.category),
    checked: Number(row.checked) === 1,
    isSample: Number(row.is_sample) === 1,
    createdAt: String(row.created_at),
  };
}

function nowIso() {
  return new Date().toISOString();
}

function touchList(listId: string) {
  getDb()
    .prepare("UPDATE lists SET updated_at = ? WHERE id = ?")
    .run(nowIso(), listId);
}

// ---- Lists ----

export function getListSummaries(): ListSummary[] {
  const rows = getDb()
    .prepare(
      `SELECT l.*,
              COUNT(i.id)                                  AS item_count,
              COALESCE(SUM(i.checked), 0)                  AS checked_count,
              COALESCE(SUM(i.quantity * i.price_cents), 0) AS total_cents
         FROM lists l
         LEFT JOIN items i ON i.list_id = l.id
        GROUP BY l.id
        ORDER BY l.updated_at DESC`,
    )
    .all() as Row[];

  return rows.map((row) => ({
    ...toList(row),
    itemCount: Number(row.item_count),
    checkedCount: Number(row.checked_count),
    totalCents: Number(row.total_cents),
  }));
}

export function getList(id: string): List | null {
  const row = getDb().prepare("SELECT * FROM lists WHERE id = ?").get(id) as
    | Row
    | undefined;
  return row ? toList(row) : null;
}

export function createList(name: string): List {
  const id = randomUUID();
  const now = nowIso();
  getDb()
    .prepare(
      "INSERT INTO lists (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
    )
    .run(id, name, now, now);
  return getList(id)!;
}

export function renameList(id: string, name: string): List | null {
  getDb()
    .prepare("UPDATE lists SET name = ?, updated_at = ? WHERE id = ?")
    .run(name, nowIso(), id);
  return getList(id);
}

export function deleteList(id: string): boolean {
  const result = getDb().prepare("DELETE FROM lists WHERE id = ?").run(id);
  return result.changes > 0;
}

// ---- Items ----

export function getItems(listId: string): Item[] {
  const rows = getDb()
    .prepare("SELECT * FROM items WHERE list_id = ? ORDER BY created_at, rowid")
    .all(listId) as Row[];
  return rows.map(toItem);
}

export function getItem(id: string): Item | null {
  const row = getDb().prepare("SELECT * FROM items WHERE id = ?").get(id) as
    | Row
    | undefined;
  return row ? toItem(row) : null;
}

export function createItem(listId: string, input: ItemCreate): Item {
  const id = randomUUID();
  transaction(getDb(), () => {
    getDb()
      .prepare(
        `INSERT INTO items (id, list_id, name, quantity, price_cents, category, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        listId,
        input.name,
        input.quantity,
        input.priceCents,
        input.category,
        nowIso(),
      );
    touchList(listId);
  });
  return getItem(id)!;
}

const UPDATE_COLUMNS = {
  name: "name",
  quantity: "quantity",
  priceCents: "price_cents",
  category: "category",
  checked: "checked",
} as const satisfies Record<keyof ItemUpdate, string>;

export function updateItem(id: string, patch: ItemUpdate): Item | null {
  const existing = getItem(id);
  if (!existing) return null;

  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  for (const key of Object.keys(UPDATE_COLUMNS) as (keyof ItemUpdate)[]) {
    const value = patch[key];
    if (value === undefined) continue;
    sets.push(`${UPDATE_COLUMNS[key]} = ?`);
    values.push(typeof value === "boolean" ? Number(value) : value);
  }
  if (sets.length === 0) return existing;

  transaction(getDb(), () => {
    getDb()
      .prepare(`UPDATE items SET ${sets.join(", ")} WHERE id = ?`)
      .run(...values, id);
    touchList(existing.listId);
  });
  return getItem(id);
}

export function deleteItem(id: string): boolean {
  const existing = getItem(id);
  if (!existing) return false;
  transaction(getDb(), () => {
    getDb().prepare("DELETE FROM items WHERE id = ?").run(id);
    touchList(existing.listId);
  });
  return true;
}

export function clearItems(listId: string, scope: ClearScope): number {
  const where = {
    all: "",
    checked: " AND checked = 1",
    sample: " AND is_sample = 1",
  }[scope];
  return transaction(getDb(), () => {
    const result = getDb()
      .prepare(`DELETE FROM items WHERE list_id = ?${where}`)
      .run(listId);
    touchList(listId);
    return Number(result.changes);
  });
}
