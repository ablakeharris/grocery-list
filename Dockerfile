# syntax=docker/dockerfile:1

ARG NODE_VERSION=26.13.0

# Build stages run on the build machine's own architecture (fast, no emulation).
# The output is plain JavaScript and the app has no native modules
# (it uses Node's built-in node:sqlite), so it runs on any platform.
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && mkdir -p /out/data

# Runtime image for the target platform (e.g. linux/arm64 on a Raspberry Pi).
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3001 \
    HOSTNAME=0.0.0.0 \
    DATABASE_PATH=/data/grocery.db \
    FOODS_DATABASE_PATH=/data/foods.db

# Empty, node-owned /data for the volume. Copied (not RUN) so cross-building
# for arm64 needs no CPU emulation.
COPY --from=builder --chown=node:node /out/data /data
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
VOLUME ["/data"]
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1

CMD ["node", "server.js"]
