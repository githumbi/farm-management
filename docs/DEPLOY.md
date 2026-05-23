# M3 — Production deploy guide

Step-by-step. Tick each box as you go.

**End state:** push to `main` deploys to `https://shambatrack.githumbi.com`,
TLS works, Google sign-in works in prod.

---

## 0. Prerequisites

- DigitalOcean account with billing enabled.
- Domain `githumbi.com` with DNS access (you mentioned it's on another host).
- GitHub account.
- Working local build (already verified: `docker build -f docker/Dockerfile -t shambatrack:test .`).

---

## 1. Push the repo to GitHub

```bash
gh repo create shambatrack --private --source=. --remote=origin
git add -A
git commit -m "M0–M3: bootstrap, schema, auth, prod build"
git push -u origin main
```

If you don't use `gh` CLI: create the repo at github.com first, then:

```bash
git remote add origin git@github.com:<your-user>/shambatrack.git
git branch -M main
git push -u origin main
```

✅ Once pushed, the **CI** workflow runs (typecheck + lint) and the **Build
and push image** workflow publishes the image to
`ghcr.io/<your-user>/shambatrack:latest`.

---

## 2. Provision the DigitalOcean droplet

1. DO dashboard → **Create → Droplets**.
2. Image: **Ubuntu 24.04 LTS x64**.
3. Plan: **Basic → Regular → 1 vCPU / 2 GB RAM / 50 GB SSD** (~$12/mo).
4. Region: **London (LON1)** — best EA latency.
5. Authentication: **SSH key**. Paste your public key
   (`cat ~/.ssh/id_ed25519.pub`).
6. Hostname: `shambatrack-prod`.
7. Click **Create**. Note the public IP (e.g. `159.65.123.45`).

SSH to confirm:

```bash
ssh root@<IP>
```

### 2.1 Enable swap (required at 2 GB)

Coolify + Postgres + Redis + the Node runtime use roughly 1.6–1.8 GB
combined. Without swap, a single `apt-get upgrade` or an image pull
can OOM-kill containers. Add 2 GB of swap:

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
# Reduce swap aggressiveness so we only fall back under real pressure
echo 'vm.swappiness=10' > /etc/sysctl.d/99-swap.conf
sysctl -p /etc/sysctl.d/99-swap.conf
free -h    # confirm "Swap: 2.0Gi"
```

### 2.2 Build strategy at 2 GB — pull from GHCR, don't build on the droplet

Because the GitHub Action already publishes
`ghcr.io/githumbi/farm-management:latest`, Coolify should *pull* that
image rather than rebuild it on the droplet. Building Next.js on 2 GB
will OOM. We configure this in step 5.3.

---

## 3. Install Coolify

On the droplet (still SSH'd in):

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

This takes ~5 minutes. When done, the script prints a URL like
`http://<IP>:8000`. Open it in your browser and:

1. Create the initial Coolify admin user (email + strong password).
2. Login.

---

## 4. DNS — point `shambatrack.githumbi.com` at the droplet

On githumbi.com's DNS provider, add an **A record**:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `shambatrack` | `<droplet IP>` | 300 (5 min) |

Wait until it resolves:

```bash
dig +short shambatrack.githumbi.com
# expect: <droplet IP>
```

You may also want a wildcard `*.shambatrack` later for tenant-scoped
subdomains, but it's not needed for M3.

---

## 5. Configure Coolify

### 5.1 Add the GitHub source

Coolify → **Sources → + New Source → GitHub App**. Follow the OAuth flow
to install the Coolify GitHub App on your repo (`shambatrack`).
(Personal access token also works; the GitHub App is preferred because
Coolify can auto-deploy on push.)

### 5.2 Create managed Postgres + Redis services

Coolify → **Projects → + New → Database → PostgreSQL 16**.
- Name: `shambatrack-pg`
- Save. Coolify will boot a container and surface a `DATABASE_URL`.

Repeat for **Redis 7** (name: `shambatrack-redis`).

### 5.3 Create the application

Coolify → **Projects → + New → Application → Public/Private GitHub repo**.

- Repository: `<your-user>/shambatrack`
- Branch: `main`
- Build pack: **Dockerfile**
- Dockerfile location: `docker/Dockerfile`
- Build context: `.` (repo root)
- Domain: `https://shambatrack.githumbi.com` (Coolify auto-issues a
  Let's Encrypt cert once the DNS points at the droplet)
- Port: `3000`

### 5.4 Set environment variables

Application → **Environment Variables → Add**. Paste from `docs/ENV.md`.
Minimum for first deploy:

```
DATABASE_URL=<from Coolify Postgres service "Internal URL">
DATABASE_APP_URL=<same as DATABASE_URL for now; we'll split roles below>
REDIS_URL=<from Coolify Redis service "Internal URL">
AUTH_SECRET=<openssl rand -base64 32>
AUTH_URL=https://shambatrack.githumbi.com
AUTH_GOOGLE_ID=<your client id>
AUTH_GOOGLE_SECRET=<your client secret>
```

Save.

### 5.5 First deploy

Click **Deploy**. Coolify clones the repo, builds `docker/Dockerfile`,
runs the container, and proxies through Traefik. First build takes
~3–4 min. Subsequent builds use the cache and take ~30s.

Once live, visit `https://shambatrack.githumbi.com` — you should see the
login screen.

---

## 6. Run migrations and seed against production DB

From your laptop, set the prod DATABASE_URL temporarily and run:

```bash
# Tunnel the Coolify Postgres to your laptop (only the owner role is on
# DATABASE_URL — needed for DDL/migrations)
ssh -L 5432:127.0.0.1:5432 root@<droplet IP>
# In another terminal:
DATABASE_URL='postgresql://<owner>:<pw>@localhost:5432/<db>?schema=public' \
  pnpm prisma migrate deploy
DATABASE_URL='postgresql://<owner>:<pw>@localhost:5432/<db>?schema=public' \
  pnpm prisma db seed
```

Then create the `shamba_app` role (the migrations only run as the owner,
but the app should connect as a non-superuser so RLS applies — the
`20260523112600_app_role` migration creates `shamba_app`, but it uses a
local password `'shamba_app'` that you should change in prod):

```sql
ALTER ROLE shamba_app WITH PASSWORD '<a-new-strong-password>';
```

Update `DATABASE_APP_URL` in Coolify to:

```
postgresql://shamba_app:<new-password>@<host>:5432/<db>?schema=public
```

Redeploy.

---

## 7. Update Google OAuth callback

Console → **APIs & Services → Credentials → your OAuth client → Edit**:

- Authorized JavaScript origins: add `https://shambatrack.githumbi.com`
- Authorized redirect URIs: add
  `https://shambatrack.githumbi.com/api/auth/callback/google`
- Save.

Also: while in the OAuth consent screen, if your app is still in
**Testing**, add your real users (or yourself) as test users; otherwise
publish the app to make sign-in work for everyone.

---

## 8. Acceptance checks (from the plan, M3)

- [ ] `https://shambatrack.githumbi.com` loads with a valid TLS cert.
- [ ] Sign in with Google works end-to-end (you land on `/dashboard`).
- [ ] A push to `main` triggers an auto-redeploy within ~3 minutes.
  (Trigger by making a trivial commit, e.g. tweak README.)
- [ ] DB tables exist and have RLS policies (`SELECT tablename FROM pg_policies` returns the same 13 tables we saw locally).
- [ ] Seeded 10 system categories visible (`SELECT count(*) FROM categories WHERE tenant_id IS NULL`).

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| TLS cert not issuing | DNS hasn't propagated; wait 5–10 min, then click "Regenerate cert" in Coolify. |
| Build fails with "out of memory" | Droplet has 4 GB; if a build OOMs, add a 2 GB swapfile on the droplet: `fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab`. |
| Google: "redirect_uri_mismatch" | The OAuth client doesn't have the prod callback URL whitelisted yet — see step 7. |
| 500 on first request | Check Coolify logs; usually a missing env var. Verify against `docs/ENV.md`. |
| RLS not applied | App is connecting as the owner (superuser) instead of `shamba_app`. Check `DATABASE_APP_URL` is set distinctly. |

---

## Optional: pull the image from GHCR instead of building on the droplet

If your droplet is small or builds are slow, configure Coolify to deploy
from a pre-built image:

1. In the app config, switch from "Dockerfile" build pack to "Docker Image".
2. Image: `ghcr.io/<your-user>/shambatrack:latest`.
3. Add a GHCR pull secret (Coolify will prompt) — use a GitHub PAT with
   `read:packages` scope.

This makes the droplet just *run* the image the GHA already built, which
is faster and lets you keep build CPU off the prod box. Useful for the
later KE-VPS migration too.
