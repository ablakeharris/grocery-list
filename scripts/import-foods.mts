/**
 * Builds the item catalog used for suggestions.
 *
 * Reads the Open Food Facts parquet export with DuckDB, keeps products sold in
 * one country, and boils them down to generic items: brand names are stripped
 * from product names, products with the same name are merged, and their
 * package sizes are tallied. So Jif, Skippy and store-brand "Creamy Peanut
 * Butter" become one item, sold in 16 oz, 28 oz and 40 oz.
 *
 * The result is a compact SQLite file with a full-text index. The app only
 * reads that file, so the 7+ GB parquet and DuckDB are never needed at runtime
 * (or on the Raspberry Pi).
 *
 *   npm run import-foods
 *   npm run import-foods -- --input food.parquet --output data/foods.db --country en:united-states
 */
import { DuckDBInstance } from "@duckdb/node-api";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    input: { type: "string", default: "food.parquet" },
    output: { type: "string", default: path.join("data", "foods.db") },
    country: { type: "string", default: "en:united-states" },
  },
});

const input = path.resolve(args.input);
const output = path.resolve(args.output);
const country = args.country;
// Popularity tags look like "top-10000-us-scans-2026"; "us" is the short code.
const countryCode = country === "en:united-states" ? "us" : country.replace(/^en:/, "");

// Sizes offered per item, most common first.
const MAX_SIZES = 5;

if (!fs.existsSync(input)) {
  console.error(`Parquet file not found: ${input}`);
  process.exit(1);
}

const sqlString = (s: string) => `'${s.replaceAll("'", "''")}'`;

// Keep this list in sync with src/lib/categories.ts. First match wins.
const CATEGORY_SQL = `
  CASE
    WHEN list_has_any(ct, ['en:frozen-foods', 'en:frozen-desserts'])
      OR list_contains(fg, 'en:ice-cream')                                     THEN 'Frozen'
    WHEN list_contains(fg, 'en:eggs') OR list_contains(ct, 'en:eggs')          THEN 'Dairy & Eggs'
    WHEN fg[1] = 'en:milk-and-dairy-products'
      OR list_has_any(ct, ['en:dairies', 'en:cheeses', 'en:milks', 'en:yogurts']) THEN 'Dairy & Eggs'
    WHEN fg[1] = 'en:fish-meat-eggs'
      OR list_has_any(ct, ['en:meats', 'en:seafood', 'en:fishes'])             THEN 'Meat & Seafood'
    WHEN list_contains(fg, 'en:bread') OR list_contains(fg, 'en:pastries')
      OR list_has_any(ct, ['en:breads', 'en:baked-goods', 'en:cakes'])         THEN 'Bakery'
    WHEN list_has_any(ct, ['en:canned-foods', 'en:soups'])                     THEN 'Pantry'
    WHEN list_contains(fg, 'en:dried-fruits')                                  THEN 'Snacks'
    WHEN fg[1] = 'en:fruits-and-vegetables'                                    THEN 'Produce'
    WHEN fg[1] IN ('en:beverages', 'en:alcoholic-beverages')
      OR list_has_any(ct, ['en:beverages', 'en:alcoholic-beverages'])          THEN 'Beverages'
    WHEN fg[1] IN ('en:sugary-snacks', 'en:salty-snacks')
      OR list_has_any(ct, ['en:snacks', 'en:sweet-snacks', 'en:salted-snacks',
                           'en:confectioneries', 'en:desserts'])               THEN 'Snacks'
    WHEN list_has_any(ct, ['en:dietary-supplements', 'en:bodybuilding-supplements'])
                                                                               THEN 'Personal Care'
    WHEN fg[1] IN ('en:cereals-and-potatoes', 'en:fats-and-sauces', 'en:composite-foods')
      OR list_has_any(ct, ['en:groceries', 'en:condiments', 'en:spices', 'en:cooking-helpers',
                           'en:sweeteners', 'en:syrups', 'en:plant-based-foods',
                           'en:toppings-ingredients', 'en:baking-decorations'])  THEN 'Pantry'
    ELSE 'Other'
  END`;

// Every product sold in the country; grouping into items happens below.
const QUERY = `
  WITH src AS (
    SELECT
      trim(regexp_replace(coalesce(
        list_filter(product_name, lambda x: x.lang = 'en'   AND trim(x.text) <> '')[1].text,
        list_filter(product_name, lambda x: x.lang = 'main' AND trim(x.text) <> '')[1].text
      ), '\\s+', ' ', 'g')) AS name,
      nullif(trim(brands), '') AS brands,
      nullif(trim(quantity), '') AS quantity,
      nullif(trim(serving_size), '') AS serving,
      lang,
      coalesce(food_groups_tags, []) AS fg,
      coalesce(categories_tags, []) AS ct,
      coalesce(unique_scans_n, 0) AS scans,
      -- Higher for "top-1000" than "top-100000"; summed over years.
      coalesce(list_sum(list_transform(
        list_filter(popularity_tags, lambda t:
          regexp_matches(t, '^top-[0-9]+-' || ${sqlString(countryCode)} || '-scans-')),
        lambda t: 6 - log10(regexp_extract(t, '^top-([0-9]+)-', 1)::DOUBLE))), 0) AS local_score
    FROM read_parquet(${sqlString(input)})
    WHERE list_contains(countries_tags, ${sqlString(country)})
  )
  SELECT name, brands, quantity, serving, ${CATEGORY_SQL} AS category, local_score, scans
  FROM src
  WHERE name IS NOT NULL AND length(name) BETWEEN 2 AND 160
    -- Mis-tagged imports: drop non-English products nobody scans locally.
    AND (lang = 'en' OR local_score > 0)
`;

// ---------------------------------------------------------------------------
// Names

const ENTITIES: Record<string, string> = { amp: "&", quot: '"', apos: "'", "#39": "'", nbsp: " " };

/** "CHEDDAR CHEESE" -> "Cheddar Cheese"; "cheddar cheese" too. Leaves mixed case alone. */
function tidyCase(s: string): string {
  const shouting = s === s.toUpperCase() && /[A-Z]{2}/.test(s);
  if (!shouting && s !== s.toLowerCase()) return s;
  return s.toLowerCase().replace(/(^|[\s\-/(&])(\p{L})/gu, (_, sep, c) => sep + c.toUpperCase());
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const COMPANY_SUFFIX = /[\s,]+(inc|llc|ltd|co|corp|corporation|company|companies|brands|signature|organic|foods?)\.?$/i;

/** Brand spellings to strip from a name: "Kirkland Signature" -> also "Kirkland". */
function brandVariants(brands: string | null): string[] {
  if (!brands) return [];
  const out = new Set<string>();
  for (const raw of brands.split(",")) {
    let b = raw.trim().replace(/&amp;/g, "&");
    if (b.length < 2) continue;
    out.add(b);
    while (COMPANY_SUFFIX.test(b)) {
      b = b.replace(COMPANY_SUFFIX, "").trim();
      if (b.length >= 2) out.add(b);
    }
  }
  // Longest first, so "Kirkland Signature" goes before "Kirkland".
  return [...out].sort((a, b) => b.length - a.length);
}

// Sizes, counts and codes that belong in the size list, not the name.
const SIZE_IN_NAME =
  /\b\d+(?:[.,]\d+)?\s*(?:fl\.?\s*oz|oz|ounces?|lbs?|pounds?|g|grams?|kg|ml|l|liters?|litres?|gal(?:lons?)?|ct|count|pk|pack|pcs?|pieces?)\b\.?(?:\s+(?:bag|box|jar|can|bottle|pack|tub|container))?/gi;
const CODES = /#\s*\d+|\b\d{4,}\b/g;

/** "Jif Creamy Peanut Butter 16 oz" (brand Jif) -> "Creamy Peanut Butter". */
function genericName(rawName: string, brands: string | null): string | null {
  let name = rawName.replace(/&(amp|quot|apos|#39|nbsp);/g, (_, e) => ENTITIES[e]);
  for (const brand of brandVariants(brands)) {
    // Whole-word match, allowing a possessive: "Trader Joe's", "Kroger's".
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(brand)}(?:'s)?(?![\\p{L}\\p{N}])`, "giu");
    const stripped = name.replace(re, "$1");
    // Keep the brand when it's the whole name ("Nutella", "Cheerios").
    if (/\p{L}{2}/u.test(stripped)) name = stripped;
  }
  name = name
    .replace(SIZE_IN_NAME, " ")
    .replace(CODES, " ")
    .replace(/[®™©]/g, "")
    .replace(/\(\s*\)/g, " ")
    .replace(/\s+/g, " ")
    // Leftover separators at either end: "- Creamy Peanut Butter,".
    .replace(/^[\s\-–—,:;.|/&+]+|[\s\-–—,:;|/&+(]+$/g, "")
    .trim();
  if (!/\p{L}{2}/u.test(name) || name.length > 60) return null;
  name = tidyCase(name);
  return name[0].toUpperCase() + name.slice(1);
}

/** Grouping key: case, accents and punctuation don't matter. */
function nameKey(name: string): string {
  return (name.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").match(/[\p{L}\p{N}%]+/gu) ?? []).join(" ");
}

// ---------------------------------------------------------------------------
// Sizes

type Size = { key: string; label: string };

/** Sort key: kind, then amount ("w:16" -> [w, 16]). Multipacks go last. */
function sizeOrder(key: string): [string, number] {
  const pack = /^(\d+)x(\w+):([\d.]+)$/.exec(key);
  if (pack) return [`~${pack[2]}`, Number(pack[1]) * Number(pack[3])];
  const [kind, amount] = key.split(":");
  return [kind, Number(amount)];
}

const G_PER_OZ = 28.3495;
const ML_PER_FL_OZ = 29.5735;

const num = (s: string) => Number(s.replace(",", "."));
const round = (n: number, step: number) => Math.round(n / step) * step;
const fmt = (n: number) => String(Number(n.toFixed(2)));

/** Metric amount as a US label when it's a round number of ounces, else as metric. */
function metricLabel(value: number, perOz: number, usUnit: string, metric: string): string {
  const oz = value / perOz;
  if (oz >= 1 && Math.abs(oz - Math.round(oz)) / oz < 0.015) return `${Math.round(oz)} ${usUnit}`;
  if (metric === "g" && value >= 1000) return `${fmt(value / 1000)} kg`;
  if (metric === "ml" && value >= 1000) return `${fmt(value / 1000)} L`;
  return `${fmt(value)} ${metric === "ml" ? "mL" : metric}`;
}

const AMOUNT = String.raw`(\d+(?:[.,]\d+)?)`;
const US_VOLUME = new RegExp(String.raw`${AMOUNT}\s*(fl\.?\s*oz|fluid\s*ounces?|gal(?:lons?)?|qt|quarts?|pt|pints?)\b`, "i");
const US_WEIGHT = new RegExp(String.raw`${AMOUNT}\s*(oz|ounces?|lbs?|pounds?)\b`, "i");
const METRIC = new RegExp(String.raw`${AMOUNT}\s*(kg|g|grams?|ml|cl|l|liters?|litres?)\b`, "i");
const COUNT = new RegExp(String.raw`${AMOUNT}\s*(?:ct|count|pcs?|pieces?|pk|pack|eggs?|rolls?|cans?|bottles?|bars?|units?|each)\b`, "i");
const MULTIPACK = /^\s*(\d+)\s*[x×]\s*(.+)$/i;

/**
 * Package size from Open Food Facts' free-text quantity, e.g.
 * "16 oz (1 lb) 454 g" -> 16 oz, "907g" -> 32 oz, "12 pcs" -> 12 ct.
 * Products sold by count (eggs) are counted even when a weight is also given.
 */
function parseSize(quantity: string | null, category: string): Size | null {
  if (!quantity) return null;
  const q = quantity.toLowerCase();

  const pack = MULTIPACK.exec(q);
  if (pack) {
    const n = Number(pack[1]);
    const one = /^\s*1\s*(?:ct|count|pcs?|pieces?|eggs?|units?|each)\b/.test(pack[2]);
    if (one && n >= 2) return { key: `ct:${n}`, label: `${n} ct` };
    const each = parseSize(pack[2], category);
    if (!each || n < 2 || n > 100) return each;
    if (each.key.startsWith("ct:")) {
      const total = n * Number(each.key.slice(3));
      return { key: `ct:${total}`, label: `${total} ct` };
    }
    return { key: `${n}x${each.key}`, label: `${n} × ${each.label}` };
  }

  const count = COUNT.exec(q);
  const byCount = count && num(count[1]) >= 2 && (category === "Dairy & Eggs" ? /egg/.test(q) || !/oz|g\b|lb/.test(q) : true);
  // Weight beats a piece count ("2 pieces, 1.5 oz"), except for eggs.
  const preferCount = byCount && /egg/.test(q);

  let m: RegExpExecArray | null;
  if (!preferCount && (m = US_VOLUME.exec(q))) {
    const n = num(m[1]);
    const unit = m[2].replace(/\s|\./g, "");
    const flOz = unit.startsWith("gal") ? n * 128 : unit.startsWith("q") ? n * 32 : unit.startsWith("p") ? n * 16 : n;
    const label = unit.startsWith("gal") ? `${fmt(n)} gal` : unit.startsWith("q") ? `${fmt(n)} qt`
      : unit.startsWith("p") ? `${fmt(n)} pt` : `${fmt(n)} fl oz`;
    return flOz > 0 ? { key: `v:${round(flOz, 0.5)}`, label } : null;
  }
  if (!preferCount && (m = US_WEIGHT.exec(q))) {
    const n = num(m[1]);
    const isLb = /^(lb|pound)/.test(m[2]);
    const oz = isLb ? n * 16 : n;
    return oz > 0 ? { key: `w:${round(oz, 0.25)}`, label: `${fmt(n)} ${isLb ? "lb" : "oz"}` } : null;
  }
  if (!preferCount && (m = METRIC.exec(q))) {
    const n = num(m[1]);
    const unit = m[2];
    if (n <= 0) return null;
    if (unit.startsWith("k") || unit.startsWith("g")) {
      const g = unit.startsWith("k") ? n * 1000 : n;
      return { key: `w:${round(g / G_PER_OZ, 0.25)}`, label: metricLabel(g, G_PER_OZ, "oz", "g") };
    }
    const ml = unit === "ml" ? n : unit === "cl" ? n * 10 : n * 1000;
    return { key: `v:${round(ml / ML_PER_FL_OZ, 0.5)}`, label: metricLabel(ml, ML_PER_FL_OZ, "fl oz", "ml") };
  }
  if (byCount && count) {
    const n = Math.round(num(count[1]));
    return { key: `ct:${n}`, label: `${n} ct` };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Grouping

type Item = {
  names: Map<string, number>;
  brands: Set<string>;
  categories: Map<string, number>;
  sizes: Map<string, { products: number; labels: Map<string, number> }>;
  score: number;
  products: number;
};

const bump = <K,>(m: Map<K, number>, k: K, by = 1) => m.set(k, (m.get(k) ?? 0) + by);
const top = <K,>(m: Map<K, number>) => [...m].sort((a, b) => b[1] - a[1])[0][0];

const started = Date.now();
console.log(`Reading ${input} (country: ${country})...`);

const duck = await DuckDBInstance.create(":memory:");
const conn = await duck.connect();
const result = await conn.stream(QUERY);

const items = new Map<string, Item>();
let read = 0;
for await (const rows of result.yieldRows()) {
  for (const [rawName, brands, quantity, serving, category, localScore, scans] of rows) {
    read++;
    const brandText = brands === null ? null : String(brands);
    const name = genericName(String(rawName), brandText);
    if (!name) continue;
    const key = nameKey(name);
    if (key.length < 2) continue;

    let item = items.get(key);
    if (!item) {
      item = { names: new Map(), brands: new Set(), categories: new Map(), sizes: new Map(), score: 0, products: 0 };
      items.set(key, item);
    }
    item.products++;
    bump(item.names, name);
    item.brands.add(brandText ? nameKey(brandText.split(",")[0]) : "");
    if (category !== "Other") bump(item.categories, String(category));
    item.score += Number(localScore) + Math.log10(1 + Number(scans)) / 10;

    const size = parseSize(quantity === null ? null : String(quantity), String(category));
    // Some products list a serving ("32 g") as the package size.
    const servingSize = parseSize(serving === null ? null : String(serving), String(category));
    if (size && size.key !== servingSize?.key) {
      let s = item.sizes.get(size.key);
      if (!s) item.sizes.set(size.key, (s = { products: 0, labels: new Map() }));
      s.products++;
      bump(s.labels, size.label);
    }
  }
  if (read % 200_000 < rows.length) console.log(`  ${read.toLocaleString()} products`);
}
conn.closeSync();

console.log(`Grouping ${items.size.toLocaleString()} names...`);
const catalog = [...items.values()]
  // One-off products nobody scans locally are mostly noise.
  .filter((it) => it.products > 1 || it.score > 0)
  .map((it) => {
    let entries = [...it.sizes];
    // Mostly sold by count (eggs, rolls)? Then drop the weights.
    const counted = entries.filter(([k]) => k.startsWith("ct:")).reduce((n, [, s]) => n + s.products, 0);
    const total = entries.reduce((n, [, s]) => n + s.products, 0);
    if (counted * 2 > total) entries = entries.filter(([k]) => k.startsWith("ct:"));
    const sizes = entries
      // A size only one product uses is often a data-entry slip; keep it only if it's all we have.
      .filter(([, s], _, all) => s.products > 1 || all.length === 1 || it.products <= 3)
      .sort((a, b) => b[1].products - a[1].products)
      .slice(0, MAX_SIZES)
      // Show them smallest to largest.
      .sort(([a], [b]) => {
        const [ka, na] = sizeOrder(a);
        const [kb, nb] = sizeOrder(b);
        return ka.localeCompare(kb) || na - nb;
      })
      .map(([, s]) => top(s.labels));
    return {
      name: top(it.names),
      category: it.categories.size ? top(it.categories) : "Other",
      sizes: [...new Set(sizes)],
      products: it.products,
      // Popular locally, and carried by many brands: that's a generic item.
      rank: it.score + Math.log2(it.brands.size + 1),
    };
  })
  .sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name));

// Build into a temp file and swap it in at the end, so a running app keeps
// serving the old catalog until the new one is complete.
fs.mkdirSync(path.dirname(output), { recursive: true });
const temp = `${output}.tmp`;
fs.rmSync(temp, { force: true });
const db = new DatabaseSync(temp);
db.exec(`
  PRAGMA journal_mode = OFF;
  PRAGMA synchronous = OFF;

  -- rowid order = rank order; search relies on this.
  CREATE TABLE items (
    id        INTEGER PRIMARY KEY,
    name      TEXT NOT NULL,
    category  TEXT NOT NULL,
    sizes     TEXT NOT NULL,     -- JSON array of labels, most common first
    products  INTEGER NOT NULL   -- how many Open Food Facts products were merged
  );

  CREATE VIRTUAL TABLE items_fts USING fts5(
    name,
    content = 'items', content_rowid = 'id',
    tokenize = 'unicode61 remove_diacritics 2',
    prefix = '1 2 3'
  );

  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);

const insert = db.prepare("INSERT INTO items (name, category, sizes, products) VALUES (?, ?, ?, ?)");
db.exec("BEGIN");
for (const it of catalog) insert.run(it.name, it.category, JSON.stringify(it.sizes), it.products);
db.exec("COMMIT");

console.log("Building search index...");
db.exec(`
  INSERT INTO items_fts (rowid, name) SELECT id, name FROM items;
  INSERT INTO items_fts (items_fts) VALUES ('optimize');
`);
db.prepare("INSERT INTO meta VALUES (?, ?), (?, ?), (?, ?), (?, ?)").run(
  "source", path.basename(input),
  "country", country,
  "imported_at", new Date().toISOString(),
  "schema", "items-v1",
);
db.exec("VACUUM");
db.close();

fs.renameSync(temp, output);
const mb = (fs.statSync(output).size / 1024 / 1024).toFixed(0);
const secs = ((Date.now() - started) / 1000).toFixed(0);
console.log(
  `Merged ${read.toLocaleString()} products into ${catalog.length.toLocaleString()} items ` +
    `in ${output} (${mb} MB) in ${secs}s`,
);
