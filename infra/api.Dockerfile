# GUACA — API Dockerfile (prod)
# Workspace chain: api → {agents, db, shared}; db → agents; agents → sharp.
# Every workspace package.json must be present BEFORE pnpm install or the
# workspace links cannot resolve.
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/agents/package.json packages/agents/
COPY packages/db/package.json packages/db/
COPY packages/cli/package.json packages/cli/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile
COPY packages/shared packages/shared
COPY packages/agents packages/agents
COPY packages/db packages/db
COPY packages/cli packages/cli
COPY apps/api apps/api
RUN pnpm --filter @guaca/shared build \
 && pnpm --filter @guaca/agents build \
 && pnpm --filter @guaca/db build \
 && pnpm --filter @guaca/api build \
 && pnpm --filter @guaca/cli build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/packages/shared/package.json packages/shared/
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/shared/node_modules packages/shared/node_modules
COPY --from=build /app/packages/agents/package.json packages/agents/
COPY --from=build /app/packages/agents/dist packages/agents/dist
COPY --from=build /app/packages/agents/node_modules packages/agents/node_modules
COPY --from=build /app/packages/db/package.json packages/db/
COPY --from=build /app/packages/db/dist packages/db/dist
COPY --from=build /app/packages/db/node_modules packages/db/node_modules
COPY --from=build /app/packages/db/migrations packages/db/migrations
# The operator CLI ships with the API so `docker compose exec api node
# packages/cli/dist/index.js ...` works on the VM — commissioning, verifying
# and paying are production operations, not dev-only ones.
COPY --from=build /app/packages/cli/package.json packages/cli/
COPY --from=build /app/packages/cli/dist packages/cli/dist
COPY --from=build /app/packages/cli/node_modules packages/cli/node_modules
COPY --from=build /app/apps/api/package.json apps/api/
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/node_modules apps/api/node_modules
EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]
