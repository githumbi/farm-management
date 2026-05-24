# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> The `@AGENTS.md` line above is load-bearing — it pulls in a warning about Next.js
> breaking changes you must heed before touching framework code.

## Product

ShambaTrack — WhatsApp-first farm-expense tracker for smallholder farm owners in Kenya. See `PRD.md` for the product spec and `PHASE1_IMPLEMENTATION.md` for the milestone-by-milestone build plan. Work usually proceeds one milestone at a time against that plan.

## Stack

Next.js 16 (App Router, Turbopack, standalone output) · React 19 · TypeScript · Tailwind 4 · shadcn/ui (nova preset, Geist font) · Auth.js v5 (Google) · Prisma 7 · Postgres 16 · Redis 7 · WhatsApp Cloud API (Meta Graph v25).

## Common commands

```bash
pnpm dev                                  # Next dev server (Turbopack) on :3000
pnpm build && pnpm start                  # production build
pnpm lint                                 # eslint
pnpm exec tsc --noEmit                    # type-check (no script wrapper)
pnpm prisma migrate dev --name <slug>     # create + apply a migration locally
pnpm prisma migrate deploy                # apply migrations (CI/prod)
pnpm prisma generate                      # regenerate client (run after schema edits)
pnpm prisma db seed                       # seed system categories
pnpm prisma studio                        # browse DB
docker compose -f docker/docker-compose.yml up -d   # local Postgres + Redis
```

Local DB env: `.env.local` defines two URLs — `DATABASE_URL` (owner role `shamba`, for migrations) and `DATABASE_APP_URL` (non-superuser `shamba_app`, used by the running app so RLS applies). See `docs/ENV.md` for the full env reference.

## Architecture — what's non-obvious

### Tenant isolation via Postgres RLS — `withTenant()` is mandatory

Every tenant-scoped read or write must go through `lib/db.ts:withTenant(tenantId, tx => ...)`. It opens a transaction and sets `app.tenant_id` via `set_config(..., true)` (transaction-local). All tenant tables have an RLS policy `tenant_isolation` that reads this GUC.

- The runtime role `shamba_app` is **not a superuser** and tables `FORCE ROW LEVEL SECURITY`, so bypass is impossible — but only if you remember to enter `withTenant`.
- The policy uses `NULLIF(current_setting('app.tenant_id', true), '')::uuid` (the GUC returns `""` not NULL when unset).
- `tenants` and `users` provisioning happens in `lib/auth/upsertTenant.ts`: tenant lookup/creation runs **outside** `withTenant` (the tenant doesn't have an id yet); user lookup runs **inside**.
- `farm_managers` has no `tenant_id` column — its RLS policy uses `EXISTS (SELECT 1 FROM farms f WHERE f.id = farm_managers.farm_id)` and inherits tenant scope through the parent `farms` row.
- Partial unique indexes enforce single-active invariants at the DB level: `one_active_season_per_farm` (`WHERE status='active'`) and `one_active_manager_per_farm` (`WHERE unassigned_at IS NULL`). Activate-season logic must close peers *before* activating, inside the same transaction.

### Prisma 7 gotchas

- `prisma/schema.prisma` does **not** contain `url = env("DATABASE_URL")` (removed in v7). The URL is supplied via `prisma.config.ts`, which loads `.env.local` via dotenv.
- Runtime client is built with `@prisma/adapter-pg` (`PrismaPg`). See `lib/db.ts` for the lazy Proxy that defers PrismaClient construction until first use — needed because `next build`'s page-data collection runs without DB env vars.
- After any schema change you must (a) `pnpm prisma generate` and (b) **restart the dev server** — Turbopack will hold the stale generated client in memory and queries against new columns will throw `PrismaClientValidationError` even though `tsc` is green.
- All models use `@@map("snake_case")` and snake_case columns; TS code uses `db.farmManager`, not `db.farm_managers`.

### Server actions, not react-hook-form

Forms use native `<form action={serverAction}>` + `useActionState` + zod for server-side validation. Action shape:

```ts
"use server";
export async function createX(_prev: State, formData: FormData): Promise<State> {
  const session = await auth(); if (!session?.tenantId) redirect("/login");
  const parsed = schema.safeParse({ ... });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  await withTenant(session.tenantId, tx => tx.x.create({ ... }));
  revalidatePath("/x"); redirect("/x");
}
```

shadcn's `Form` (react-hook-form wrapper) is not installed — use native HTML form elements + the shadcn `Input`/`Label`/`Button` primitives. For enums, prefer styled native `<select>` over Radix Select (Radix Select needs client state to participate in a server action submission).

### Auth.js v5

`lib/auth/index.ts` uses JWT strategy with Google. `signIn` + `jwt` callbacks both call `upsertTenantForGoogle` to keep tenant/user rows in sync. Session is augmented to expose `session.tenantId` and `session.userId` (via module augmentation for `Session`, and an in-file `ShambaToken` cast for the JWT — module augmenting `next-auth/jwt` triggered TS errors). `trustHost: true` is required so /api/auth works behind the Coolify/Traefik reverse proxy in prod.

### Next.js 16 specifics

- Dynamic route params are async: `{ params }: { params: Promise<{ id: string }> }` — always `await params`.
- Server components are the default; mark pages that touch the DB with `export const dynamic = "force-dynamic"` to avoid prerendering them at build time (DB env vars aren't set during build).
- Standalone output (`docker/Dockerfile`). Build inside Docker passes a stub `DATABASE_URL` so `prisma generate` and `next build` succeed without a real DB.

### WhatsApp wiring

`lib/wa/client.ts` wraps Meta Graph v25 (`sendMessage`, `sendTemplate`, `sendText`). `lib/wa/templates.ts` holds payload builders for the **pre-approved** templates we use (currently `manager_assignment_v1` only). Every send is recorded in `wa_outbound_messages` with `status=sent|failed` plus the Meta error message so failures are inspectable. The intended path is BullMQ queue → worker (M6+); right now sends are inline in the server action.

## Deployment

Prod runs on a DigitalOcean droplet (2 GB + 2 GB swap) under Coolify (Traefik reverse proxy). The GitHub Actions workflow `docker.yml` builds the image and pushes to GHCR (`ghcr.io/githumbi/farm-management:latest`); Coolify pulls and deploys. App at `https://shambatrack.githumbi.com`; Coolify dashboard at `https://coolify.githumbi.com`. Step-by-step in `docs/DEPLOY.md`.

After any schema change deployed to prod: `ssh -L 5433:127.0.0.1:5432 root@<droplet>` then `DATABASE_URL='postgresql://shamba:<owner-pw>@localhost:5433/shambatrack?schema=public' pnpm prisma migrate deploy`.
