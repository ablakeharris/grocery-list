import { DatabaseSync, type StatementSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { CATEGORIES, type Category } from "./categories";
import type { FoodSuggestion } from "./types";

// Item catalog built by `npm run import-foods` from the Open Food Facts
// parquet. Read-only, and optional: without it, suggestions are just empty.
const FOODS_PATH =
  process.env.FOODS_DATABASE_PATH ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "foods.db");

// How many matches (in rank order) to re-rank before picking the top few.
const CANDIDATES = 200;

type Catalog = { db: DatabaseSync; search: StatementSync | null; mtimeMs: number };

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
  const hasItems = db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'items_fts'").get();
  if (!hasItems) {
    console.warn(`${FOODS_PATH} is from an older import; re-run "npm run import-foods" for suggestions.`);
  }
  const search = hasItems
    ? db.prepare(`
        SELECT i.name, i.sizes, i.category
          FROM items_fts
          JOIN items i ON i.id = items_fts.rowid
         WHERE items_fts MATCH ?
         ORDER BY items_fts.rowid
         LIMIT ${CANDIDATES}
      `)
    : null;
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

function toSizes(value: unknown): string[] {
  try {
    const sizes: unknown = JSON.parse(String(value));
    return Array.isArray(sizes) ? sizes.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Items matching every word of `query` as a prefix, e.g. "pea butt" finds
 * "Creamy Peanut Butter". Names that are, or end with, the query come first
 * ("milk" → "Whole Milk" before "Milk Chocolate"); ties keep rank order.
 */
export function searchFoods(query: string, limit = 8): FoodSuggestion[] {
  const terms = words(query).slice(0, 6);
  if (terms.length === 0 || terms.join("").length < 2) return [];

  const search = openCatalog()?.search;
  if (!search) return [];

  const match = terms.map((t) => `"${t}"*`).join(" ");
  const rows = search.all(match) as Record<string, unknown>[];

  const phrase = terms.join(" ");
  const scored = rows.map((row, rank) => {
    const name = words(String(row.name));
    const nameText = name.join(" ");
    let score = 0;
    if (nameText === phrase) score += 10;
    // In English the last word is usually what the thing is: "Whole Milk"
    // beats "Milk Chocolate".
    else if (nameText.endsWith(phrase)) score += 5;
    else if (nameText.startsWith(phrase)) score += 4;
    else if (` ${nameText}`.includes(` ${phrase}`)) score += 2;
    // A nudge toward shorter, more generic names; popularity still matters more.
    score -= 0.25 * Math.max(0, name.length - terms.length);
    return { row, score, rank };
  });
  scored.sort((a, b) => b.score - a.score || a.rank - b.rank);

  return scored.slice(0, limit).map(({ row }) => ({
    name: String(row.name),
    sizes: toSizes(row.sizes),
    category: toCategory(row.category),
  }));
}
