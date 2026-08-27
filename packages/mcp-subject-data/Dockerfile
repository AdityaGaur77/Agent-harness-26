# syntax=docker/dockerfile:1

# TrueForge reaches MCP servers over remote HTTP, so this ships as a real
# long-running service rather than something spawned over stdio.

FROM node:22-alpine AS build
WORKDIR /app

RUN corepack enable

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* tsconfig.base.json ./
COPY packages/mcp-subject-data/package.json packages/mcp-subject-data/
RUN pnpm install --filter @blast-radius/mcp-subject-data... --frozen-lockfile=false

COPY packages/mcp-subject-data packages/mcp-subject-data
RUN pnpm --filter @blast-radius/mcp-subject-data build


FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/mcp-subject-data/package.json packages/mcp-subject-data/
RUN pnpm install --filter @blast-radius/mcp-subject-data... --prod --frozen-lockfile=false

COPY --from=build /app/packages/mcp-subject-data/dist packages/mcp-subject-data/dist

# Run unprivileged: this process holds credentials for the live database.
USER node

EXPOSE 8080
CMD ["node", "packages/mcp-subject-data/dist/index.js"]
