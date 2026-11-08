/**
 * Builds the product catalog used for item suggestions.
 *
 * Reads the Open Food Facts parquet export with DuckDB, keeps products sold in
 * one country, maps them to the app's categories, and writes a compact SQLite
 * file with a full-text index. The app only reads that file, so the 7+ GB
 * parquet and DuckDB are never needed at runtime (or on the Raspberry Pi).
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

// One row per distinct (name, brand), most popular first.
const QUERY = `
  WITH src AS (
    SELECT
      code,
      trim(regexp_replace(coalesce(
        list_filter(product_name, lambda x: x.lang = 'en'   AND trim(x.text) <> '')[1].text,
        list_filter(product_name, lambda x: x.lang = 'main' AND trim(x.text) <> '')[1].text
      ), '\\s+', ' ', 'g')) AS name,
      nullif(trim(regexp_replace(split_part(brands, ',', 1), '\\s+', ' ', 'g')), '') AS brand,
      nullif(trim(quantity), '') AS quantity,
      lang,
      coalesce(food_groups_tags, []) AS fg,
      coalesce(categories_tags, []) AS ct,
      coalesce(unique_scans_n, 0) AS scans,
      coalesce(completeness, 0) AS completeness,
      -- Higher for "top-1000" than "top-100000"; summed over years.
      coalesce(list_sum(list_transform(
        list_filter(popularity_tags, lambda t:
          regexp_matches(t, '^top-[0-9]+-' || ${sqlString(countryCode)} || '-scans-')),
        lambda t: 6 - log10(regexp_extract(t, '^top-([0-9]+)-', 1)::DOUBLE))), 0) AS local_score
    FROM read_parquet(${sqlString(input)})
    WHERE list_contains(countries_tags, ${sqlString(country)})
  ),
  ranked AS (
    SELECT *,
      ${CATEGORY_SQL} AS category,
      row_number() OVER (
        PARTITION BY lower(name), lower(coalesce(brand, ''))
        ORDER BY local_score DESC, scans DESC, completeness DESC
      ) AS dup,
      count(*) OVER (PARTITION BY lower(name), lower(coalesce(brand, ''))) AS variants
    FROM src
    WHERE name IS NOT NULL AND length(name) BETWEEN 2 AND 120
      -- Mis-tagged imports: drop non-English products nobody scans locally.
      AND (lang = 'en' OR local_score > 0)
  )
  SELECT code, name, brand, quantity, category
  FROM ranked
  WHERE dup = 1
  ORDER BY local_score DESC, variants DESC, scans DESC, completeness DESC, name
`;

/** "CHEDDAR CHEESE" -> "Cheddar Cheese". Leaves mixed-case names alone. */
function tidyCase(s: string): string {
  if (s !== s.toUpperCase() || !/[A-Z]{2}/.test(s)) return s;
  return s.toLowerCase().replace(/(^|[\s\-/(&])(\p{L})/gu, (_, sep, c) => sep + c.toUpperCase());
}

const started = Date.now();
console.log(`Reading ${input} (country: ${country})...`);

const duck = await DuckDBInstance.create(":memory:");
const conn = await duck.connect();
const result = await conn.stream(QUERY);

// Build into a temp file and swap it in at the end, so a running app keeps
// serving the old catalog until the new one is complete.
fs.mkdirSync(path.dirname(output), { recursive: true });
const temp = `${output}.tmp`;
fs.rmSync(temp, { force: true });
const db = new DatabaseSync(temp);
db.exec(`
  PRAGMA journal_mode = OFF;
  PRAGMA synchronous = OFF;

  -- rowid order = popularity order; search relies on this.
  CREATE TABLE foods (
    id        INTEGER PRIMARY KEY,
    code      TEXT NOT NULL,
    name      TEXT NOT NULL,
    brand     TEXT,
    quantity  TEXT,
    category  TEXT NOT NULL
  );

  CREATE VIRTUAL TABLE foods_fts USING fts5(
    name, brand,
    content = 'foods', content_rowid = 'id',
    tokenize = 'unicode61 remove_diacritics 2',
    prefix = '1 2 3'
  );

  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);

const insert = db.prepare(
  "INSERT INTO foods (code, name, brand, quantity, category) VALUES (?, ?, ?, ?, ?)",
);
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

let count = 0;
db.exec("BEGIN");
for await (const rows of result.yieldRows()) {
  for (const [code, name, brand, quantity, category] of rows) {
    insert.run(str(code), tidyCase(String(name)), str(brand), str(quantity), String(category));
    count++;
  }
  if (count % 100_000 < rows.length) console.log(`  ${count.toLocaleString()} products`);
}
db.exec("COMMIT");

console.log("Building search index...");
db.exec(`
  INSERT INTO foods_fts (rowid, name, brand) SELECT id, name, coalesce(brand, '') FROM foods;
  INSERT INTO foods_fts (foods_fts) VALUES ('optimize');
`);
db.prepare("INSERT INTO meta VALUES (?, ?), (?, ?), (?, ?)").run(
  "source", path.basename(input),
  "country", country,
  "imported_at", new Date().toISOString(),
);
db.exec("VACUUM");
db.close();
conn.closeSync();

fs.renameSync(temp, output);
const mb = (fs.statSync(output).size / 1024 / 1024).toFixed(0);
const secs = ((Date.now() - started) / 1000).toFixed(0);
console.log(`Wrote ${count.toLocaleString()} products to ${output} (${mb} MB) in ${secs}s`);
