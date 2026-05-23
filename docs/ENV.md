# Environment variables

Every env var the app reads, by milestone. Local dev lives in `.env.local`;
production lives in Coolify's app config.

## Conventions

- **Required at runtime** = the app crashes or errors if missing.
- **Required at build** = `next build` / `prisma generate` won't complete.
- Anything marked **Secret** must be a random value, never committed.

---

## M1 — Database

| Name | Required | Notes |
|---|---|---|
| `DATABASE_URL` | runtime (migrations) | Postgres URL using the **owner** role. Used by `prisma migrate` only. |
| `DATABASE_APP_URL` | runtime (app) | Postgres URL using the **non-superuser** role (`shamba_app`). Used by the web/worker containers so RLS is enforced. Falls back to `DATABASE_URL` if unset. |
| `REDIS_URL` | runtime (workers, M6+) | `redis://host:6379`. |

**Local dev format:** `postgresql://USER:PASSWORD@HOST:5432/DB?schema=public`

---

## M2 — Auth.js / Google sign-in

| Name | Required | Notes |
|---|---|---|
| `AUTH_SECRET` | runtime | **Secret.** 32+ bytes random. Generate with `openssl rand -base64 32`. |
| `AUTH_URL` | runtime | Public origin of the app (e.g. `https://app.shambatrack.com`). In dev: `http://localhost:3000`. Auth.js uses this to construct OAuth callback URLs. |
| `AUTH_GOOGLE_ID` | runtime | Google OAuth Client ID (ends in `.apps.googleusercontent.com`). |
| `AUTH_GOOGLE_SECRET` | runtime | **Secret.** Google OAuth Client Secret. |

When `AUTH_URL` is `https://…`, Auth.js automatically marks session cookies
`Secure`.

---

## M5–M9 — WhatsApp Cloud API (Meta)

| Name | Required | Notes |
|---|---|---|
| `WA_ACCESS_TOKEN` | runtime | **Secret.** System User token from Meta Business; never-expiring. |
| `WA_PHONE_NUMBER_ID` | runtime | Numeric ID from the WhatsApp API Setup page. |
| `WA_BUSINESS_ACCOUNT_ID` | runtime | Numeric WABA ID from the same page. |
| `WA_APP_SECRET` | runtime | **Secret.** App secret from App settings → Basic. Used for HMAC signature verification on inbound webhooks. |
| `WA_VERIFY_TOKEN` | runtime | **Secret.** Random string you choose; you paste the same value into Meta's webhook config. |
| `WA_API_VERSION` | runtime | e.g. `v25.0`. |

---

## M8, M13 — Cloudflare R2 (object storage)

| Name | Required | Notes |
|---|---|---|
| `R2_ACCOUNT_ID` | runtime | Cloudflare account ID. |
| `R2_ACCESS_KEY_ID` | runtime | **Secret.** R2 token Access Key ID. |
| `R2_SECRET_ACCESS_KEY` | runtime | **Secret.** R2 token Secret. |
| `R2_BUCKET` | runtime | e.g. `shambatrack-prod`. |
| `R2_BUCKET_BACKUPS` | runtime (M19) | e.g. `shambatrack-backups`. |

---

## M16 — Resend (transactional email)

| Name | Required | Notes |
|---|---|---|
| `RESEND_API_KEY` | runtime | **Secret.** API key from resend.com. |
| `RESEND_FROM` | runtime | Verified sender, e.g. `noreply@shambatrack.com`. |

---

## M19 — Observability

| Name | Required | Notes |
|---|---|---|
| `SENTRY_DSN` | runtime | Sentry project DSN. |
| `LOG_LEVEL` | runtime | `info` in prod, `debug` in dev. |

---

## Build-time

These are NOT needed at runtime, only during `next build` /
`prisma migrate` (in CI or on the build host):

- `DATABASE_URL` — `pnpm prisma migrate deploy` reads this.
- `NEXT_TELEMETRY_DISABLED=1` — set in the Dockerfile to skip Next telemetry.

The build container stubs `DATABASE_URL` to a fake string so
`pnpm prisma generate` doesn't fail on the dotenv load.

---

## Quick checklist for production (Coolify env section)

Paste/fill these in Coolify after creating the app:

```
# Database (Coolify-managed Postgres provides DATABASE_URL automatically;
# create a `shamba_app` role and set DATABASE_APP_URL manually)
DATABASE_URL=…
DATABASE_APP_URL=…
REDIS_URL=…

# Auth.js
AUTH_SECRET=…
AUTH_URL=https://app.shambatrack.com
AUTH_GOOGLE_ID=…
AUTH_GOOGLE_SECRET=…

# WhatsApp (Meta)
WA_ACCESS_TOKEN=…
WA_PHONE_NUMBER_ID=…
WA_BUSINESS_ACCOUNT_ID=…
WA_APP_SECRET=…
WA_VERIFY_TOKEN=…
WA_API_VERSION=v25.0
```

Later milestones (R2, Resend, Sentry) bring more — add them when you reach
those milestones.
