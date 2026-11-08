import { randomUUID } from "node:crypto";
import { getDb, transaction } from "./db";
import { CATEGORIES, DEFAULT_CATEGORY, type Category } from "./categories";
import type {
  ClearScope,
  IngredientCreate,
  IngredientUpdate,
  ItemCreate,
  ItemUpdate,
} from "./schema";
import type {
  AddMealResult,
  Ingredient,
  Item,
  List,
  ListSummary,
  Meal,
  MealSummary,
} from "./types";

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
    size: row.size === null ? null : String(row.size),
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

const MAX_NAME = 60;

/**
 * Picks a free name for a copy: "Weekly" → "Weekly (copy)", then
 * "Weekly (copy 2)" and so on. Copying a copy counts up from the original.
 */
function copyName(table: "lists" | "meals", name: string): string {
  const base = name.replace(/ \(copy(?: \d+)?\)$/, "");
  const taken = new Set(
    (getDb().prepare(`SELECT name FROM ${table}`).all() as Row[]).map((r) =>
      String(r.name).toLowerCase(),
    ),
  );
  for (let n = 1; ; n++) {
    const suffix = n === 1 ? " (copy)" : ` (copy ${n})`;
    const candidate = base.slice(0, MAX_NAME - suffix.length).trimEnd() + suffix;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

/**
 * Makes a new list with the same items. Items start unchecked so the copy is
 * ready for another trip. Returns null when the list doesn't exist.
 */
export function copyList(id: string): List | null {
  const source = getList(id);
  if (!source) return null;
  const db = getDb();
  const newId = randomUUID();
  const now = nowIso();
  transaction(db, () => {
    db.prepare(
      "INSERT INTO lists (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
    ).run(newId, copyName("lists", source.name), now, now);
    const insert = db.prepare(
      `INSERT INTO items (id, list_id, name, size, quantity, price_cents, category, is_sample, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const item of getItems(id)) {
      insert.run(
        randomUUID(),
        newId,
        item.name,
        item.size,
        item.quantity,
        item.priceCents,
        item.category,
        Number(item.isSample),
        item.createdAt,
      );
    }
  });
  return getList(newId);
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
        `INSERT INTO items (id, list_id, name, size, quantity, price_cents, category, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        listId,
        input.name,
        input.size,
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
  size: "size",
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

// ---- Meals ----

const MAX_QUANTITY = 999;

function toMeal(row: Row): Meal {
  return {
    id: String(row.id),
    name: String(row.name),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toIngredient(row: Row): Ingredient {
  return {
    id: String(row.id),
    mealId: String(row.meal_id),
    name: String(row.name),
    size: row.size === null ? null : String(row.size),
    quantity: Number(row.quantity),
    priceCents: row.price_cents === null ? null : Number(row.price_cents),
    category: toCategory(row.category),
    createdAt: String(row.created_at),
  };
}

function touchMeal(mealId: string) {
  getDb()
    .prepare("UPDATE meals SET updated_at = ? WHERE id = ?")
    .run(nowIso(), mealId);
}

export function getMealSummaries(): MealSummary[] {
  const rows = getDb()
    .prepare(
      `SELECT m.*,
              COUNT(g.id)                                  AS ingredient_count,
              COALESCE(SUM(g.quantity * g.price_cents), 0) AS total_cents
         FROM meals m
         LEFT JOIN meal_ingredients g ON g.meal_id = m.id
        GROUP BY m.id
        ORDER BY m.name COLLATE NOCASE`,
    )
    .all() as Row[];

  return rows.map((row) => ({
    ...toMeal(row),
    ingredientCount: Number(row.ingredient_count),
    totalCents: Number(row.total_cents),
  }));
}

export function getMeal(id: string): Meal | null {
  const row = getDb().prepare("SELECT * FROM meals WHERE id = ?").get(id) as
    | Row
    | undefined;
  return row ? toMeal(row) : null;
}

export function createMeal(name: string): Meal {
  const id = randomUUID();
  const now = nowIso();
  getDb()
    .prepare(
      "INSERT INTO meals (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
    )
    .run(id, name, now, now);
  return getMeal(id)!;
}

export function renameMeal(id: string, name: string): Meal | null {
  getDb()
    .prepare("UPDATE meals SET name = ?, updated_at = ? WHERE id = ?")
    .run(name, nowIso(), id);
  return getMeal(id);
}

export function deleteMeal(id: string): boolean {
  const result = getDb().prepare("DELETE FROM meals WHERE id = ?").run(id);
  return result.changes > 0;
}

/** Makes a new meal with the same ingredients. Returns null when the meal doesn't exist. */
export function copyMeal(id: string): Meal | null {
  const source = getMeal(id);
  if (!source) return null;
  const db = getDb();
  const newId = randomUUID();
  const now = nowIso();
  transaction(db, () => {
    db.prepare(
      "INSERT INTO meals (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
    ).run(newId, copyName("meals", source.name), now, now);
    const insert = db.prepare(
      `INSERT INTO meal_ingredients (id, meal_id, name, size, quantity, price_cents, category, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const ing of getIngredients(id)) {
      insert.run(
        randomUUID(),
        newId,
        ing.name,
        ing.size,
        ing.quantity,
        ing.priceCents,
        ing.category,
        ing.createdAt,
      );
    }
  });
  return getMeal(newId);
}

// ---- Ingredients ----

export function getIngredients(mealId: string): Ingredient[] {
  const rows = getDb()
    .prepare(
      "SELECT * FROM meal_ingredients WHERE meal_id = ? ORDER BY created_at, rowid",
    )
    .all(mealId) as Row[];
  return rows.map(toIngredient);
}

export function getIngredient(id: string): Ingredient | null {
  const row = getDb()
    .prepare("SELECT * FROM meal_ingredients WHERE id = ?")
    .get(id) as Row | undefined;
  return row ? toIngredient(row) : null;
}

export function createIngredient(mealId: string, input: IngredientCreate): Ingredient {
  const id = randomUUID();
  transaction(getDb(), () => {
    getDb()
      .prepare(
        `INSERT INTO meal_ingredients (id, meal_id, name, size, quantity, price_cents, category, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        mealId,
        input.name,
        input.size,
        input.quantity,
        input.priceCents,
        input.category,
        nowIso(),
      );
    touchMeal(mealId);
  });
  return getIngredient(id)!;
}

const INGREDIENT_COLUMNS = {
  name: "name",
  size: "size",
  quantity: "quantity",
  priceCents: "price_cents",
  category: "category",
} as const satisfies Record<keyof IngredientUpdate, string>;

export function updateIngredient(
  id: string,
  patch: IngredientUpdate,
): Ingredient | null {
  const existing = getIngredient(id);
  if (!existing) return null;

  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  for (const key of Object.keys(INGREDIENT_COLUMNS) as (keyof IngredientUpdate)[]) {
    const value = patch[key];
    if (value === undefined) continue;
    sets.push(`${INGREDIENT_COLUMNS[key]} = ?`);
    values.push(value);
  }
  if (sets.length === 0) return existing;

  transaction(getDb(), () => {
    getDb()
      .prepare(`UPDATE meal_ingredients SET ${sets.join(", ")} WHERE id = ?`)
      .run(...values, id);
    touchMeal(existing.mealId);
  });
  return getIngredient(id);
}

export function deleteIngredient(id: string): boolean {
  const existing = getIngredient(id);
  if (!existing) return false;
  transaction(getDb(), () => {
    getDb().prepare("DELETE FROM meal_ingredients WHERE id = ?").run(id);
    touchMeal(existing.mealId);
  });
  return true;
}

// ---- Adding a meal to a list ----

/** Same name and size means same thing: 16 oz and 40 oz peanut butter stay separate. */
function itemKey(item: { name: string; size: string | null }) {
  return `${item.name.trim().toLowerCase()}\0${(item.size ?? "").trim().toLowerCase()}`;
}

/**
 * Copies a meal's ingredients onto a list, `times` batches over. An ingredient
 * that's already on the list (same name and size) and not yet bought gets its quantity bumped
 * instead of a duplicate row, so two meals that both need onions give one
 * "Onions x2". Returns null when the meal doesn't exist.
 */
export function addMealToList(
  listId: string,
  mealId: string,
  times = 1,
): AddMealResult | null {
  if (!getMeal(mealId)) return null;
  const ingredients = getIngredients(mealId);
  const db = getDb();

  let added = 0;
  let merged = 0;
  transaction(db, () => {
    const open = new Map<string, Item>();
    for (const item of getItems(listId)) {
      if (!item.checked && !open.has(itemKey(item))) {
        open.set(itemKey(item), item);
      }
    }

    const bump = db.prepare(
      "UPDATE items SET quantity = ?, price_cents = COALESCE(price_cents, ?), is_sample = 0 WHERE id = ?",
    );
    const insert = db.prepare(
      `INSERT INTO items (id, list_id, name, size, quantity, price_cents, category, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const base = Date.now();
    const createdIds = new Set<string>();

    ingredients.forEach((ing, i) => {
      const qty = ing.quantity * times;
      const existing = open.get(itemKey(ing));
      if (existing) {
        existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + qty);
        bump.run(existing.quantity, ing.priceCents, existing.id);
        if (!createdIds.has(existing.id)) merged++;
      } else {
        const item: Item = {
          id: randomUUID(),
          listId,
          name: ing.name,
          size: ing.size,
          quantity: Math.min(MAX_QUANTITY, qty),
          priceCents: ing.priceCents,
          category: ing.category,
          checked: false,
          isSample: false,
          // Stagger timestamps so items keep the meal's order.
          createdAt: new Date(base + i).toISOString(),
        };
        insert.run(
          item.id,
          listId,
          item.name,
          item.size,
          item.quantity,
          item.priceCents,
          item.category,
          item.createdAt,
        );
        // A meal that lists the same thing twice merges into one row.
        open.set(itemKey(item), item);
        createdIds.add(item.id);
        added++;
      }
    });
    touchList(listId);
  });

  return { added, merged, items: getItems(listId) };
}
