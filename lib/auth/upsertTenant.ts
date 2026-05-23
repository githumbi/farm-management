import { db } from "@/lib/db";

export type TenantContext = {
  tenantId: string;
  userId: string;
};

/**
 * Idempotent: on first sign-in, create a Tenant + owner User; otherwise
 * return the existing ids. Keyed by Google `sub` (stable per Google account).
 *
 * The `tenants` table has no `tenant_id` column and no RLS policy, so we
 * can read/write it without setting `app.tenant_id`. The `users` table is
 * RLS-protected, so any access to it goes through a tx that sets the GUC.
 */
export async function upsertTenantForGoogle(args: {
  googleSub: string;
  email: string;
  name?: string | null;
}): Promise<TenantContext> {
  const { googleSub, email, name } = args;

  const tenant =
    (await db.tenant.findUnique({
      where: { google_sub: googleSub },
      select: { id: true },
    })) ??
    (await db.tenant.create({
      data: { google_sub: googleSub, email, name: name ?? null },
      select: { id: true },
    }));

  const user = await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.tenant_id', $1, true)`,
      tenant.id,
    );

    const existing = await tx.user.findFirst({
      where: { tenant_id: tenant.id },
      select: { id: true },
      orderBy: { created_at: "asc" },
    });
    if (existing) return existing;

    return tx.user.create({
      data: {
        tenant_id: tenant.id,
        email,
        name: name ?? null,
        role: "owner",
      },
      select: { id: true },
    });
  });

  return { tenantId: tenant.id, userId: user.id };
}
