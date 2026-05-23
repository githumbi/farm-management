import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

declare global {
  var __shamba_prisma: PrismaClient | undefined;
}

function createPrisma(): PrismaClient {
  // App connects as the non-superuser role so RLS is enforced. Falls back
  // to DATABASE_URL for environments that haven't split the roles yet.
  const connectionString =
    process.env.DATABASE_APP_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_APP_URL/DATABASE_URL is not set");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

// Lazy proxy so we don't construct a PrismaClient (or read DATABASE_*) at
// module-load time — Next.js loads route modules during `next build`'s
// page-data collection where DB env vars aren't set.
function getPrisma(): PrismaClient {
  if (!globalThis.__shamba_prisma) {
    globalThis.__shamba_prisma = createPrisma();
  }
  return globalThis.__shamba_prisma;
}

export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getPrisma(), prop, receiver);
  },
});

/**
 * Run `fn` inside a transaction with the `app.tenant_id` Postgres GUC set,
 * so RLS policies (`tenant_isolation`) scope every query to this tenant.
 *
 * Why a transaction: `set_config(..., is_local=true)` only persists for the
 * current transaction, which guarantees the GUC can't leak across pooled
 * connections.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]) => Promise<T>,
): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.tenant_id', $1, true)`,
      tenantId,
    );
    return fn(tx);
  });
}
