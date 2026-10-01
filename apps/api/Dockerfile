# syntax=docker/dockerfile:1
# Build from the repo root:  docker build -f apps/api/Dockerfile -t flashcards-api .
#                            docker build -f apps/api/Dockerfile --target migrate -t flashcards-migrate .

FROM node:22-alpine AS base
WORKDIR /app

# --- all deps (incl. dev): needed to compile and to run the Prisma CLI ---
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm ci -w apps/api -w packages/shared --include-workspace-root --ignore-scripts

# --- compile shared + api, generate the Prisma client into src/ so tsc emits it ---
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w packages/shared \
 && npm run prisma:generate -w apps/api \
 && npm run build -w apps/api

# --- one-off release job: `prisma migrate deploy`, run once per release before the new API starts.
#     Migrating in a separate job (not on API boot) avoids N replicas racing to migrate the same DB.
#     Note: @prisma/client declares `prisma` as a peer dep, so npm still installs the CLI in runtime. ---
FROM deps AS migrate
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/
WORKDIR /app/apps/api
CMD ["npx", "prisma", "migrate", "deploy"]

# --- runtime: production deps only, non-root ---
FROM base AS runtime
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm ci -w apps/api -w packages/shared --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/api/dist apps/api/dist
WORKDIR /app/apps/api
USER node
CMD ["node", "dist/server.js"]
