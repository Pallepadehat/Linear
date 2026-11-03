# Production images (see README → "Run the production build").
#   server: api + worker + db migrate/seed, one image with different commands
#   app:    the built SPA behind nginx, proxying the API on the same origin
# Build one with: docker build --target server -t linear-server .

ARG BUN_VERSION=1.4.4
ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-slim AS node

# Every workspace manifest, so dependency layers are cached until one changes.
FROM oven/bun:${BUN_VERSION} AS manifests
WORKDIR /repo
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/app/package.json apps/app/
COPY apps/worker/package.json apps/worker/
COPY packages/contract/package.json packages/contract/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/env/package.json packages/env/
COPY packages/queue/package.json packages/queue/
COPY packages/storage/package.json packages/storage/
COPY packages/tsconfig/package.json packages/tsconfig/

FROM manifests AS build
# vue-tsc and the Vite config loader run on Node.
COPY --from=node /usr/local/bin/node /usr/local/bin/node
RUN bun install --frozen-lockfile
COPY . .
# Empty: the browser calls the API on its own origin through nginx.
ENV VITE_API_URL=
RUN bun run build

FROM manifests AS prod-deps
RUN bun install --frozen-lockfile --production

FROM oven/bun:${BUN_VERSION}-slim AS server
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=prod-deps /repo/node_modules ./node_modules
COPY --from=prod-deps /repo/packages ./packages
COPY --from=prod-deps /repo/apps ./apps
# Workspace sources (db migrations + seed run from source) and the built bundles.
COPY package.json bun.lock ./
COPY packages ./packages
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/worker/dist ./apps/worker/dist
USER bun
EXPOSE 3000
CMD ["bun", "apps/api/dist/index.js"]

FROM nginx:1.27-alpine AS app
COPY docker/app/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/app/dist /usr/share/nginx/html
EXPOSE 80
