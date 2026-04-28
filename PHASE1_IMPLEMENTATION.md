# ShambaTrack — Phase 1 Implementation Plan

**Companion to:** `PRD.md`
**Status:** Draft v1.0
**Goal:** Ship the MVP described in `PRD.md` §16 (Phase 1) — owner Google sign-in, farm/season setup, manager WhatsApp expense logging with confirm flow, receipts on R2, owner dashboard with P&L, manual revenue, manager read-only PWA, CSV/PDF export, deployed on a DigitalOcean droplet.

---

## Guiding principles for the build

1. **Ship in vertical slices.** Each milestone produces something demoable end-to-end, even if narrow. No two-week "infrastructure-only" milestones.
2. **Database-first per slice.** Add the Prisma model + migration + RLS policy before the API; add the API before the UI.
3. **WhatsApp last among the I/O surfaces.** Owner web flow proves the data model. WA is added after the model is stable.
4. **No premature abstractions.** Three repeated lines beats a wrong abstraction. Refactor when patterns emerge from real code, not from imagined code.
5. **Manual happy-path verification per milestone.** Browser/curl/WA test must pass before moving on. Tests are added where they protect non-obvious logic, not for coverage's sake.
6. **Production deploy by M3.** Continuous deploy from `main` to the DO droplet from week 2 onwards. Catch deployment problems early, not at the end.

---

## Milestone overview

| # | Milestone | Outcome | Est. effort |
|---|---|---|---|
| M0 | Project bootstrap | Next.js + Docker + Postgres running locally | 1 day |
| M1 | Schema & RLS | Full Prisma schema applied; RLS policies in place | 1 day |
| M2 | Owner Google sign-in | Owner can sign in; tenant + user row created | 1 day |
| M3 | Production deploy | Live on `app.shambatrack.com` via Coolify; CI/CD on push to `main` | 1 day |
| M4 | Farm & Season CRUD | Owner can create/list/edit farms and seasons | 2 days |
| M5 | Manager assignment | Owner can add a manager (phone); WA template sent | 1 day |
| M6 | WhatsApp webhook plumbing | Inbound messages stored raw; signature verified; queue working | 1 day |
| M7 | Expense parser + confirm flow | Manager texts → expense saved → tap-to-confirm reply | 2–3 days |
| M8 | Receipt photos via WA | Photos attach to recent expense; stored on R2 | 1–2 days |
| M9 | Activity logging via WA | No-amount messages stored as activities | 0.5 day |
| M10 | Owner dashboard (P&L) | Season summary: total cost, revenue, P&L, breakdown chart | 2 days |
| M11 | Expense list, filters, edit | Owner can browse, filter, edit expenses on web | 1.5 days |
| M12 | Manual revenue entry | Owner adds revenue rows; flow into P&L | 0.5 day |
| M13 | Receipt vault | Gallery view; signed URLs; download | 1 day |
| M14 | Manager read-only PWA | `/m/[token]` — last 30 days of own entries | 1.5 days |
| M15 | Multi-farm routing & `/default` | Manager on >1 farm can pick farm via WA | 1 day |
| M16 | CSV export | Async job; emailed link | 1 day |
| M17 | PDF export | Async job; cover, table, gallery | 1.5 days |
| M18 | Audit log + soft delete coverage | Audit on writes; soft-delete on user-visible deletes | 1 day |
| M19 | Backups & monitoring | `pg_dump` cron to R2; Sentry + Pino in prod | 0.5 day |
| M20 | Pre-launch hardening | RLS audit, error pages, rate limits, Meta template approval | 1–2 days |

**Total estimate:** ~22–28 working days (≈ 5–6 weeks for a focused solo build).

---

## M0 — Project bootstrap

**Outcome:** Repo runs locally with `docker compose up`; Next.js page renders; Postgres reachable.

**Files to create:**
- `package.json`, `tsconfig.json`, `next.config.mjs`
- `app/layout.tsx`, `app/page.tsx` (placeholder home)
- `prisma/schema.prisma` (empty datasource + generator only)
- `lib/db.ts` (Prisma client singleton)
- `docker/Dockerfile` (multi-stage: deps → build → runner, output: standalone)
- `docker/docker-compose.yml` (services: `web`, `worker`, `postgres`, `redis`)
- `docker/.env.example`
- `.env.local` (gitignored)
- `.eslintrc.cjs`, `.prettierrc`
- `README.md` — quickstart only

**Commands to run:**
```bash
pnpm dlx create-next-app@latest . --ts --app --tailwind --eslint --src-dir=false --import-alias "@/*"
pnpm add @prisma/client
pnpm add -D prisma
pnpm dlx prisma init --datasource-provider postgresql
pnpm dlx shadcn@latest init
docker compose up -d
pnpm dev
```

**Acceptance:**
- `http://localhost:3000` renders.
- `pnpm prisma db push` succeeds against the dockerized Postgres.
- `psql $DATABASE_URL -c "SELECT 1"` returns `1`.

---

## M1 — Schema & RLS

**Outcome:** All tables from PRD §11.2 created; RLS enabled; partial unique indexes in place; system-default categories seeded.

**Files:**
- `prisma/schema.prisma` (full schema from PRD §11.2)
- `prisma/migrations/<ts>_init/migration.sql` (Prisma-generated)
- `prisma/migrations/<ts>_rls_and_partial_indexes/migration.sql` (manual SQL — see below)
- `prisma/seed.ts` (system-default categories: fertilizer, seeds, labor, transport, chemicals, equipment, irrigation, land_prep, harvest, other)
- `lib/db.ts` (extended: `withTenant(tenantId, fn)` helper that sets `app.tenant_id` GUC inside a transaction)

**Manual SQL migration (`_rls_and_partial_indexes`):**
```sql
-- Partial unique indexes
CREATE UNIQUE INDEX one_active_manager_per_farm
  ON farm_managers (farm_id) WHERE unassigned_at IS NULL;
CREATE UNIQUE INDEX one_active_season_per_farm
  ON seasons (farm_id) WHERE status = 'active';

-- RLS on every business table
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','managers','farms','farm_managers','seasons','categories',
    'expenses','revenues','activities','attachments',
    'wa_inbound_messages','wa_outbound_messages','audit_log'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %I
        USING (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id', true)::uuid)
        WITH CHECK (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id', true)::uuid)
    $f$, t);
  END LOOP;
END$$;
```
> Note: `categories.tenant_id IS NULL` represents system defaults, hence the `IS NULL` branch.

**Acceptance:**
- `pnpm prisma migrate dev` applies cleanly.
- `pnpm db:seed` inserts 10 system categories with `tenant_id = NULL`.
- Manual test: connecting as a non-superuser and querying `expenses` without setting `app.tenant_id` returns 0 rows.

---

## M2 — Owner Google sign-in

**Outcome:** Owner clicks "Sign in with Google", lands on `/dashboard`; tenant + user rows are created on first sign-in.

**Files:**
- `lib/auth/index.ts` — Auth.js v5 config, Google provider, JWT session strategy
- `app/api/auth/[...nextauth]/route.ts`
- `app/(owner)/dashboard/page.tsx` (placeholder)
- `app/(owner)/layout.tsx` — guards: redirect to `/login` if no session
- `app/login/page.tsx` — single "Sign in with Google" button
- `lib/auth/upsertTenant.ts` — on first sign-in, create tenant + user

**Acceptance:**
- Sign in with two different Google accounts → two `tenants` rows.
- Visiting `/dashboard` while signed out redirects to `/login`.
- Cookie is HTTP-only, `SameSite=Lax`, secure in production.

---

## M3 — Production deploy

**Outcome:** `git push origin main` deploys to `https://app.shambatrack.com`. TLS works. Owner sign-in works in prod.

**Steps:**
- Provision a `s-2vcpu-4gb` DO droplet (Frankfurt or London).
- Install Coolify (one-line script).
- Point `app.shambatrack.com` A record at the droplet.
- Add the GitHub repo as a Coolify app; configure env vars from `PRD.md` §15.3.
- Configure Coolify to build the multi-stage Dockerfile and run `web` and `worker` containers.
- Set up GitHub Container Registry push on `main` (optional now, useful for KE-VPS migration later).
- Set up Postgres + Redis as Coolify-managed services on the same droplet.
- Add the production callback URL to the Google OAuth app.

**Acceptance:**
- `https://app.shambatrack.com` resolves with valid TLS.
- Sign-in works.
- A push to `main` triggers an auto-redeploy within ~3 minutes.

---

## M4 — Farm & Season CRUD

**Outcome:** Owner can create farms and seasons from the dashboard; data scoped to their tenant.

**Files:**
- `app/(owner)/farms/page.tsx` — list
- `app/(owner)/farms/new/page.tsx` — create form
- `app/(owner)/farms/[id]/page.tsx` — farm detail (lists seasons)
- `app/(owner)/farms/[id]/seasons/new/page.tsx` — create season
- `app/(owner)/farms/[id]/seasons/[id]/page.tsx` — season detail (placeholder for now)
- `lib/actions/farms.ts` — server actions: `createFarm`, `archiveFarm`, `updateFarm`
- `lib/actions/seasons.ts` — `createSeason`, `closeSeason`, `activateSeason`
- `lib/validators/farm.ts`, `lib/validators/season.ts` — zod schemas
- `components/forms/FarmForm.tsx`, `components/forms/SeasonForm.tsx` (shadcn `Form` + `Input` + `Select`)

**Behavior:**
- Activating a season auto-closes any other active season on the same farm (atomic transaction).
- All actions wrap calls in `withTenant(session.tenantId, ...)`.

**Acceptance:**
- Owner creates 2 farms, 3 seasons across them; refreshes; data persists.
- A second tenant cannot see the first tenant's farms (verify by signing in with two Google accounts).

---

## M5 — Manager assignment

**Outcome:** Owner adds a manager to a farm; bot sends a WhatsApp template asking for confirmation; on `YES` reply, assignment is marked confirmed.

**Files:**
- `lib/wa/client.ts` — Meta API client (send template, send text, download media)
- `lib/wa/templates.ts` — `manager_assignment_v1` payload builder
- `app/(owner)/farms/[id]/managers/new/page.tsx` — form: name, phone (E.164)
- `lib/actions/managers.ts` — `assignManager(farmId, name, e164)` (idempotent on `(tenant_id, whatsapp_e164)`)
- `lib/validators/phone.ts` — strict E.164 validator (start `+`, 8–15 digits)
- DB-side: insert `managers` row if new, insert `farm_managers` row, send template via outbound queue

**Acceptance:**
- Phone validation rejects `0712...` (must be `+254712...`).
- Assigning a manager already used by the same tenant on another farm reuses the row.
- A different tenant adding the same phone creates a separate `managers` row scoped to their tenant.
- Message lands on the manager's phone within 30s.

---

## M6 — WhatsApp webhook plumbing

**Outcome:** Meta webhook hits the app, signature is verified, raw payload is stored, a parse job is enqueued; webhook responds 200 in <200ms.

**Files:**
- `app/api/wa/webhook/route.ts` — `GET` (verification challenge) + `POST` (events)
- `lib/wa/verifySignature.ts` — HMAC-SHA256 against `WA_APP_SECRET`
- `lib/wa/types.ts` — TypeScript types for the inbound payload subset we use
- `lib/jobs/queues.ts` — BullMQ queue definitions: `wa:parse`, `wa:send`
- `workers/index.ts` — entry point that runs all workers
- `workers/waParse.ts` — empty handler at this milestone (just logs and marks `parsed`)

**Acceptance:**
- Meta verification flow passes (initial GET challenge).
- Sending a real message to the WA number creates a `wa_inbound_messages` row within 1 second.
- A duplicate Meta delivery (same `wa_message_id`) does not insert a second row.
- Webhook returns 200 in <200ms (verified via Meta's debug tool).

---

## M7 — Expense parser + confirm flow

**Outcome:** Manager texts an amount + keyword → expense row created with `status=pending_confirm` → bot replies; `1`/`2` confirms or fixes.

**Files:**
- `lib/wa/parser.ts` — pure function `parse(text): { amount?, categorySlug?, isActivity }`
- `lib/wa/router.ts` — resolves inbound `from_e164` → manager → tenant → active farm + active season
- `workers/waParse.ts` — orchestrates: route → parse → insert expense (or activity) → enqueue confirm reply
- `workers/waReply.ts` — sends outbound text via `wa:send` queue
- `lib/wa/conversations.ts` — small state machine for the fix flow (in-memory keyed by manager_id, with TTL in Redis)
- Cron job (`wa:auto_confirm`): every 10 min, flip `pending_confirm` expenses older than 24h to `confirmed` with `auto_confirmed=true`

**Parser tests** (lightweight unit tests with `vitest`):
- `"Spent 3,500 on fertilizer"` → 3500 + fertilizer
- `"Paid labor 2000"` → 2000 + labor
- `"Maize is doing well"` → activity
- `"3500"` → 3500 + other
- `"DAP 4500"` → 4500 + fertilizer
- `"Mjengo 1500"` → 1500 + labor

**Acceptance:**
- Send "Spent 3500 on fertilizer" → bot replies within 5s with logged confirmation.
- Reply `1` → status flips to `confirmed`; bot replies `✓`.
- Reply `2` → bot prompts for category, then amount; new values applied.
- After 24h with no reply, expense auto-confirms.

---

## M8 — Receipt photos via WA

**Outcome:** Photo sent within 60s of an expense message attaches to it; standalone photos prompt the manager.

**Files:**
- `lib/r2/client.ts` — S3 SDK configured for R2 (account ID, custom endpoint)
- `lib/r2/upload.ts` — `uploadFromUrl(url, key)`; computes sha256; sets `Content-Type`
- `workers/waMediaIngest.ts` — downloads media from Meta, dedups by sha256, uploads to R2, inserts `attachments` row
- Update `workers/waParse.ts`: if message is `image`, look up most recent (≤60s) expense from this manager → attach. If none, store as `unattached` and reply prompting selection.

**Acceptance:**
- Manager sends a fertilizer expense, then a photo within 30s → attachment row links to that expense; image visible on R2.
- Manager sends a photo with no recent expense → bot replies asking which expense.

---

## M9 — Activity logging via WA

**Outcome:** Messages with no amount become activities; photos with no expense context within an hour become activity attachments.

**Files:**
- Update `workers/waParse.ts`: branch on `parse(text).isActivity`
- Update `workers/waMediaIngest.ts`: standalone photo with no recent expense + recent activity → attach to activity

**Acceptance:**
- "Planted 2 acres potatoes today" → activity row.
- Photo sent immediately after → attaches to that activity.

---

## M10 — Owner dashboard (P&L)

**Outcome:** `/farms/[id]/seasons/[id]` renders total cost, total revenue, P&L, and a category breakdown chart, all SSR.

**Files:**
- `app/(owner)/farms/[id]/seasons/[id]/page.tsx` — server component; queries summed amounts
- `lib/queries/seasonSummary.ts` — pure SQL via Prisma `$queryRaw`:
  ```sql
  SELECT category_id, SUM(amount_cents)::bigint AS total
  FROM expenses
  WHERE season_id = $1 AND status = 'confirmed' AND deleted_at IS NULL
  GROUP BY category_id;
  ```
- `components/dashboard/PnlSummary.tsx`
- `components/dashboard/CategoryBreakdownChart.tsx` (Recharts pie or bar)

**Performance budget:**
- Dashboard server render <300ms with 500 expenses.
- JS payload <100KB gzipped on this page.

**Acceptance:**
- Totals match a manually-summed CSV of seeded expenses.
- Switching season updates the view.
- Lighthouse mobile score ≥ 90.

---

## M11 — Expense list, filters, edit

**Outcome:** Filterable expense list; row click opens detail panel with receipt; owner can edit any field.

**Files:**
- `app/(owner)/expenses/page.tsx` — table with filters (farm, season, category, date range, source, status)
- `components/expenses/ExpensesTable.tsx`
- `components/expenses/ExpenseDetail.tsx` — slide-over with form + receipt
- `lib/actions/expenses.ts` — `updateExpense`, `softDeleteExpense`, `confirmExpense`, `rejectExpense`

**Acceptance:**
- Filters compose correctly (URL-driven for shareability).
- Editing an amount updates the season P&L on next refresh.
- Deletion is soft (`deleted_at` set); list excludes deleted by default.

---

## M12 — Manual revenue entry

**Outcome:** Owner adds revenue rows; they flow into the season P&L immediately.

**Files:**
- `app/(owner)/farms/[id]/seasons/[id]/revenues/new/page.tsx`
- `lib/actions/revenues.ts` — `createRevenue`, `updateRevenue`, `softDeleteRevenue`
- `components/dashboard/PnlSummary.tsx` — query revenues alongside expenses

**Acceptance:**
- Adding KES 50,000 revenue to a season with KES 30,000 expenses shows P&L = +20,000.

---

## M13 — Receipt vault

**Outcome:** Gallery of all receipts for a season, with download via signed URL.

**Files:**
- `app/(owner)/farms/[id]/seasons/[id]/receipts/page.tsx`
- `lib/r2/sign.ts` — `getSignedUrl(key, ttl)`
- `components/receipts/ReceiptGallery.tsx` — masonry grid; click to enlarge

**Acceptance:**
- Gallery loads thumbnails (lazy-loaded).
- Clicking a receipt opens the original, downloadable.
- Signed URLs expire in 1 hour.

---

## M14 — Manager read-only PWA

**Outcome:** Manager texts `/dashboard`; bot replies with a magic link; opening the link logs them in and shows the last 30 days.

**Files:**
- `lib/auth/managerJwt.ts` — sign + verify, 24h expiry
- `app/m/[token]/page.tsx` — validates token, sets cookie, renders log
- `workers/waCommands.ts` — handles `/dashboard`, `/default`, `/help`
- `app/m/log/page.tsx` — list of last 30 days (entries the *manager* logged across all farms)
- `public/manifest.webmanifest` + `public/icons/*.png`
- `app/manifest.ts` — Next.js manifest route
- `app/sw.ts` — service worker via `next-pwa` or hand-rolled

**Acceptance:**
- Magic link expires in 24h; using it after expiry shows a friendly error.
- PWA installable from Chrome on Android.
- Page renders offline (last cached) within service worker.
- Manager cannot reach owner-only routes (RLS + path-level guard).

---

## M15 — Multi-farm routing & `/default`

**Outcome:** When a manager is active on >1 farm, the bot prompts for the farm; `/default` sets a per-manager default.

**Files:**
- Update `lib/wa/router.ts` — branch on `activeFarms.length > 1`
- Update `lib/wa/conversations.ts` — `pending_routing` state
- `workers/waCommands.ts` — `/default 1` sets `managers.default_farm_id`

**Acceptance:**
- Manager on 2 farms texts an expense → bot prompts to choose.
- `/default 1` then a new expense → routed to farm 1 silently.
- `/default off` clears the default.

---

## M16 — CSV export

**Outcome:** Owner clicks "Export CSV" → background job → emailed download link.

**Files:**
- `lib/jobs/queues.ts` — add `exports` queue
- `workers/exportCsv.ts` — streams expenses + revenues to CSV; uploads to R2; emails signed link via Resend
- `app/(owner)/farms/[id]/seasons/[id]/export/route.ts` — POST to enqueue
- `lib/email/resend.ts` — Resend client
- `lib/email/templates/exportReady.tsx` — JSX email

**Acceptance:**
- CSV opens in Excel and Google Sheets without mojibake (UTF-8 with BOM).
- Receipt URLs in CSV are 7-day signed.

---

## M17 — PDF export

**Outcome:** Same UX as CSV, but produces a multi-page PDF.

**Files:**
- `workers/exportPdf.ts` — uses `@react-pdf/renderer` server-side
- `lib/exports/pdfTemplates/SeasonReport.tsx` — cover, expense table, revenue table, P&L summary, receipt gallery (one image per page)

**Acceptance:**
- 100-expense season produces a PDF in <30s.
- Embedded receipt images render at ≤200KB each (downscale on insert).

---

## M18 — Audit log + soft-delete coverage

**Outcome:** All write actions append to `audit_log`; user-visible deletes are soft.

**Files:**
- `lib/audit/log.ts` — `auditWrite({ action, entity, before, after })`; called from server actions
- Update server actions in `lib/actions/*` to log writes
- Update destructive actions to set `deleted_at` instead of deleting

**Acceptance:**
- Editing an expense produces an `audit_log` row with `before`/`after` JSON.
- Deleting a farm sets `archived_at`; the farm disappears from lists but is recoverable via SQL.

---

## M19 — Backups & monitoring

**Outcome:** Nightly DB backup to R2; errors visible in Sentry; structured logs visible in Better Stack (or chosen provider).

**Files / actions:**
- `docker/backup.sh` — `pg_dump | gzip | aws s3 cp - s3://shambatrack-backups/<date>.sql.gz`
- Coolify cron: nightly at 02:00 UTC
- R2 lifecycle: delete objects in `shambatrack-backups/` after 30 days
- `lib/observability/sentry.ts` — Sentry init, server + client
- `lib/observability/logger.ts` — Pino with request-id middleware

**Acceptance:**
- Yesterday's backup exists in R2.
- Restoring it to a fresh Postgres reproduces the data.
- A thrown error in a server action shows up in Sentry within 1 minute.

---

## M20 — Pre-launch hardening

**Outcome:** Ready to onboard the user's own farms.

**Checklist:**
- [ ] Submit Meta WhatsApp templates (`manager_assignment_v1`, `manager_login_v1`) for approval; allow 1–3 days.
- [ ] Verify business with Meta (move WA from sandbox to production).
- [ ] Run an RLS audit: try every cross-tenant read/write through Prisma without `app.tenant_id` set; expect zero rows / errors.
- [ ] Add rate limits on `/api/wa/webhook` (per `from_e164`) and `/api/auth/*` (per IP) using Upstash-style sliding window in Redis.
- [ ] Add a 404, 500, and offline page.
- [ ] Add a hard cap on receipt upload size (5 MB) and dimensions (auto-downscale > 2000 px).
- [ ] Manual cross-browser smoke: Chrome Android, Safari iOS, Chrome desktop, Firefox desktop.
- [ ] Manual end-to-end: owner signs up → adds farm + season + manager → manager logs an expense + photo via WA → owner sees it in dashboard → exports PDF.
- [ ] Run Lighthouse on owner dashboard (target ≥ 90 mobile).

---

## Dependencies & external setup (start in parallel with M0)

Some external setup has lead time and should begin on day 1:

| Item | Lead time | Owner action |
|---|---|---|
| Domain name `shambatrack.com` (or chosen) | <1 hour | Purchase, point DNS at DO when droplet is up (M3) |
| Google Cloud project + OAuth client | <1 hour | Add `https://app.shambatrack.com/api/auth/callback/google` redirect |
| Meta Business account + WA Cloud API | 1–3 days | Verify business; create WA app; obtain phone number ID + access token |
| Cloudflare account + R2 bucket | <1 hour | Create `shambatrack-prod` and `shambatrack-backups`; generate API tokens |
| Resend account | <1 hour | Verify sending domain (DNS records) |
| DigitalOcean droplet | <30 minutes | Provision; install Coolify |
| Sentry project | <15 minutes | Get DSN |

---

## Definition of done for Phase 1

The MVP is shipped when **all** of these are true:

1. The user (Mary persona) can sign up with Google, add 2 farms, create 1 active season per farm, and assign 2 different managers (one per farm) entirely from a phone browser.
2. Each manager can log 5 expenses and 1 receipt photo per farm via WhatsApp without ever touching a web form.
3. The owner sees the correct P&L, expense breakdown, activity feed, and receipt gallery for each season.
4. The owner can export a season as CSV and PDF; the PDF opens in any standard reader.
5. A second tenant cannot read or write any of the first tenant's data — verified by RLS audit.
6. Production runs on the DO droplet for 7 consecutive days with no manual intervention.
7. Daily Postgres backup is verified by performing a test restore.

---

## Risks & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Meta business verification delays launch | Medium | Start verification on day 1 in parallel with M0 |
| Parser misclassifies many expenses (Swahili/English mix) | High | Easy fix-flow (`2`); store raw text and `parse_result` so we can iterate without losing history |
| Single droplet runs out of memory under load | Low (early) | Vertical-scale to `s-4vcpu-8gb` in one click; alert on memory >80% |
| R2 access keys leak | Low | Restrict bucket policy to specific prefixes; rotate keys on launch |
| Owner forgets they have multi-tenant data and edits production | Low | Use a separate `owner@shambatrack.com` Google account for prod admin; never sign in as a tenant |

---

*Companion files:* `details.md` (original spec), `PRD.md` (product spec), this file (build plan).
