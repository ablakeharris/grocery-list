import { DatabaseSync, type StatementSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { CATEGORIES, type Category } from "./categories";
import type { FoodSuggestion } from "./types";

// Product catalog built by `npm run import-foods` from the Open Food Facts
// parquet. Read-only, and optional: without it, suggestions are just empty.
const FOODS_PATH =
  process.env.FOODS_DATABASE_PATH ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "foods.db");

// How many matches (in popularity order) to re-rank before picking the top few.
const CANDIDATES = 200;

type Catalog = { db: DatabaseSync; search: StatementSync; mtimeMs: number };

const globalForFoods = globalThis as unknown as { foodsCatalog?: Catalog | null };

function openCatalog(): Catalog | null {
  let mtimeMs: number;
  try {
    // The catalog is runtime data, not code: don't let the build trace it.
    mtimeMs = fs.statSync(/*turbopackIgnore: true*/ FOODS_PATH).mtimeMs;
  } catch {
    return null; // Not imported yet.
  }

  const current = globalForFoods.foodsCatalog;
  // Reopen when a fresh import has replaced the file.
  if (current && current.mtimeMs === mtimeMs) return current;
  current?.db.close();

  const db = new DatabaseSync(FOODS_PATH, { readOnly: true });
  const search = db.prepare(`
    SELECT f.id, f.code, f.name, f.brand, f.quantity, f.category
      FROM foods_fts
      JOIN foods f ON f.id = foods_fts.rowid
     WHERE foods_fts MATCH ?
     ORDER BY foods_fts.rowid
     LIMIT ${CANDIDATES}
  `);
  globalForFoods.foodsCatalog = { db, search, mtimeMs };
  return globalForFoods.foodsCatalog;
}

function words(text: string): string[] {
  return text.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").match(/[\p{L}\p{N}]+/gu) ?? [];
}

function toCategory(value: unknown): Category | null {
  // "Other" means the import couldn't tell, so don't suggest it.
  return value !== "Other" && (CATEGORIES as readonly string[]).includes(value as string)
    ? (value as Category)
    : null;
}

/**
 * Products matching every word of `query` as a prefix, e.g. "pea butt" finds
 * "Creamy Peanut Butter". Name matches beat brand-only matches; ties keep
 * popularity order.
 */
export function searchFoods(query: string, limit = 8): FoodSuggestion[] {
  const terms = words(query).slice(0, 6);
  if (terms.length === 0 || terms.join("").length < 2) return [];

  const catalog = openCatalog();
  if (!catalog) return [];

  const match = terms.map((t) => `"${t}"*`).join(" ");
  const rows = catalog.search.all(match) as Record<string, unknown>[];

  const phrase = terms.join(" ");
  const scored = rows.map((row, popularity) => {
    const name = words(String(row.name));
    const nameText = name.join(" ");
    let score = 0;
    if (nameText === phrase) score += 6;
    else if (nameText.startsWith(phrase)) score += 4;
    else if (` ${nameText}`.includes(` ${phrase}`)) score += 2;
    if (terms.every((t) => name.some((w) => w.startsWith(t)))) score += 2;
    return { row, score, popularity };
  });
  scored.sort((a, b) => b.score - a.score || a.popularity - b.popularity);

  return scored.slice(0, limit).map(({ row }) => ({
    code: String(row.code),
    name: String(row.name),
    brand: row.brand === null ? null : String(row.brand),
    quantity: row.quantity === null ? null : String(row.quantity),
    category: toCategory(row.category),
  }));
}
