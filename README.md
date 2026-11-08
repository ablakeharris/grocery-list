# Grocery Lists

A small self-hosted app for shared grocery lists, built to run on a Raspberry Pi on your home network.

- Multiple lists, items grouped by category, with quantity, price and an estimated total
- Tap the checkbox to mark an item bought (it stays in place, crossed out)
- Tap an item's name to edit it; tap the list title to rename the list
- Item suggestions while typing an item name, with the package sizes each item is sold in, from the [Open Food Facts](https://world.openfoodfacts.org) database (optional, see below)
- Meals: save the ingredients for meals you make often, then add a meal to a list from the list page (the fork-and-knife button). Ingredients already on the list with the same name and size, and not yet checked off, get their quantity bumped instead of being added twice; add a meal twice to double it
- Share (phone share sheet or copy to clipboard), print, clear checked, clear all
- Open devices refresh every 10 seconds and when the tab regains focus
- No login: anyone on your network can use it

**Stack:** Next.js 16 (App Router, Cache Components) · React 19 · TypeScript 7 · Tailwind CSS 4 · Zod 4 · SQLite via Node 26's built-in `node:sqlite`

## Run on the Raspberry Pi

You need a 64-bit Raspberry Pi OS with Docker installed.

### Option A: build on the Pi

```bash
git clone <this repo> grocery-list && cd grocery-list
docker compose up -d --build
```

Open `http://<pi-ip-address>:3001` from any device on your network.

### Option B: build on your computer, copy to the Pi

The Dockerfile cross-compiles without emulation, so this is fast on an x86 machine:

```bash
docker buildx build --platform linux/arm64 -t grocery-list:latest --load .
docker save grocery-list:latest | gzip | ssh pi@<pi-ip> 'gunzip | docker load'
```

Then copy `docker-compose.yml` to the Pi and run `docker compose up -d` (no `--build`).

### Updating

Rebuild and restart with `docker compose up -d --build`. Your lists live in the `grocery-data` volume, which survives rebuilds. Only `docker compose down -v` deletes it.

## Data and backups

All data is a single SQLite database at `/data/grocery.db` inside the `grocery-data` Docker volume.

Back up while the app is running:

```bash
docker exec grocery-list node -e "new (require('node:sqlite').DatabaseSync)('/data/grocery.db').exec(\"VACUUM INTO '/data/backup.db'\")"
docker cp grocery-list:/data/backup.db ./grocery-backup-$(date +%F).db
```

Restore by stopping the container, copying a backup over `/data/grocery.db` (for example with a temporary container that mounts the volume), and starting it again.

`foods.db` (item suggestions, see below) sits next to it in the same volume. It isn't user data, so there's no need to back it up.

On first start the app creates a sample list, which you can clear with the "Clear sample" button.

## Item suggestions (Open Food Facts)

Typing an item name suggests generic items, such as "pea butt" → "Peanut Butter", with the sizes it's commonly sold in (12 oz, 16 oz, 28 oz, 40 oz). Brands are left out. Picking one fills in the name and, when known, the category, and shows the sizes as buttons; tapping one fills in the item's Size field. Items and meal ingredients have their own size, so adding a meal only merges with a list item of the same name and size. The suggestions come from the [Open Food Facts product database](https://huggingface.co/datasets/openfoodfacts/product-database) (licensed [ODbL](https://opendatacommons.org/licenses/odbl/1-0/)).

The full export is a 7+ GB parquet file, too big to search on a Pi. So an import script uses [DuckDB](https://duckdb.org) to turn it into a small SQLite catalog (`data/foods.db`, about 17 MB, ~160k items) with a full-text index, and the app only reads that. DuckDB is a dev dependency; it never runs on the Pi. Without the catalog the app works the same, just without suggestions.

Build the catalog on your computer (it takes under a minute):

```bash
# Download food.parquet from the Hugging Face page above into the project folder, then:
npm run import-foods
# Options: --input food.parquet --output data/foods.db --country en:united-states
```

It keeps products sold in the chosen country, strips brand names (and sizes or barcodes) out of product names, and merges products that end up with the same name into one item. Each item keeps its most common package sizes, ignoring sizes that are really a serving size. Items are ranked by how often they're scanned there and how many brands sell them. Re-run it whenever you download a newer export; a running app picks up the new file automatically.

Copy it to the Pi's data volume:

```bash
scp data/foods.db pi@<pi-ip>:~/foods.db
ssh pi@<pi-ip> 'docker cp ~/foods.db grocery-list:/data/foods.db'
```

## Development

```bash
npm install
npm run dev        # http://localhost:3001, database at ./data/grocery.db
npm run import-foods  # build ./data/foods.db from ./food.parquet (see above)
npm run typecheck  # TypeScript 7 (tsc)
npm run lint       # ESLint
npm run build
```

**TypeScript note:** TypeScript 7 has no JavaScript API yet, and typescript-eslint needs one. Following the TypeScript team's guidance, `typescript` is aliased to `@typescript/typescript6` for ESLint and Next.js, and `@typescript/native` is TypeScript 7, which provides the `tsc` command. When typescript-eslint supports TS 7, replace both with a plain `typescript@^7`.

## API

| Method | Route | Purpose |
|---|---|---|
| GET / POST | `/api/lists` | List all lists (with counts and totals) / create `{ name }` |
| GET / PATCH / DELETE | `/api/lists/:id` | List with items / rename `{ name }` / delete |
| GET / POST | `/api/lists/:id/items` | Items / add `{ name, size?, quantity?, priceCents?, category? }` |
| DELETE | `/api/lists/:id/items?scope=all\|checked\|sample` | Clear items |
| PATCH / DELETE | `/api/items/:id` | Update `{ name?, size?, quantity?, priceCents?, category?, checked? }` / delete |
| GET | `/api/foods?q=` | Item suggestions: `[{ name, sizes, category }]` |
| GET | `/api/health` | Health check used by Docker |

## Layout

```
src/
  app/                 pages and API routes
  components/          client UI (list-view, item-row, item-form, lists-view, ...)
  lib/
    db.ts              SQLite connection and schema migrations
    foods.ts           item search over the Open Food Facts catalog
    repo.ts            all database queries
    schema.ts          Zod input validation
    categories.ts      category names and display order
scripts/
  import-foods.mts     builds data/foods.db from the Open Food Facts parquet
```
