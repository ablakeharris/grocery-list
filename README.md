# Grocery Lists

A small self-hosted app for shared grocery lists, built to run on a Raspberry Pi on your home network.

- Multiple lists, items grouped by category, with quantity, price and an estimated total
- Tap the checkbox to mark an item bought (it stays in place, crossed out)
- Tap an item's name to edit it; tap the list title to rename the list
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

Open `http://<pi-ip-address>:3000` from any device on your network.

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

On first start the app creates a sample list, which you can clear with the "Clear sample" button.

## Development

```bash
npm install
npm run dev        # http://localhost:3000, database at ./data/grocery.db
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
| GET / POST | `/api/lists/:id/items` | Items / add `{ name, quantity?, priceCents?, category? }` |
| DELETE | `/api/lists/:id/items?scope=all\|checked\|sample` | Clear items |
| PATCH / DELETE | `/api/items/:id` | Update `{ name?, quantity?, priceCents?, category?, checked? }` / delete |
| GET | `/api/health` | Health check used by Docker |

## Layout

```
src/
  app/                 pages and API routes
  components/          client UI (list-view, item-row, item-form, lists-view, ...)
  lib/
    db.ts              SQLite connection and schema migrations
    repo.ts            all database queries
    schema.ts          Zod input validation
    categories.ts      category names and display order
```
