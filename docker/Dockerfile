# syntax=docker/dockerfile:1.7

# ---------- deps: install pnpm + node_modules ----------
FROM node:24-alpine AS deps
WORKDIR /app
ENV PNPM_HOME=/pnpm CI=1
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile

# ---------- build: prisma generate + next build ----------
FROM node:24-alpine AS build
WORKDIR /app
ENV PNPM_HOME=/pnpm CI=1 NEXT_TELEMETRY_DISABLED=1
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml ./
# prisma.config.ts is loaded by the prisma CLI; schema lives under prisma/.
COPY prisma.config.ts ./
COPY prisma ./prisma
# Stub DATABASE_URL during build so prisma config's dotenv load doesn't break.
# The real URL is supplied at runtime.
RUN DATABASE_URL="postgresql://stub:stub@stub:5432/stub" pnpm prisma generate

COPY . .
RUN pnpm build

# ---------- runner: minimal standalone image ----------
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
# Add a non-root user.
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Next.js standalone output bundles its own minimal node_modules.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

# Prisma 7 with adapter-pg doesn't ship a query engine binary, but the
# generated client and runtime live in @prisma/client — the standalone
# output already includes them via the file-trace.

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
