# ShambaTrack

WhatsApp-first farm expense tracking. See `PRD.md` for product spec and `PHASE1_IMPLEMENTATION.md` for the build plan.

## Quickstart

Requirements: Node 20+, pnpm 9+, Docker.

```bash
# 1. Install deps
pnpm install

# 2. Configure env (DATABASE_URL, WA_*, etc.)
cp docker/.env.example .env.local
$EDITOR .env.local

# 3. Start Postgres + Redis
docker compose -f docker/docker-compose.yml up -d

# 4. Apply schema + seed system categories
pnpm prisma migrate dev
pnpm prisma db seed

# 5. Run dev server
pnpm dev
```

Open <http://localhost:3000>.

## Useful commands

```bash
pnpm dev                  # Next.js dev server
pnpm build && pnpm start  # production build
pnpm prisma studio        # browse the db
pnpm prisma migrate dev   # create a migration
docker compose -f docker/docker-compose.yml logs -f postgres
```
