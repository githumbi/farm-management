"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { seasonCreateSchema } from "@/lib/validators/season";

export type SeasonActionState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

async function requireTenant(): Promise<string> {
  const session = await auth();
  if (!session?.tenantId) redirect("/login");
  return session.tenantId;
}

function flatten(err: z.ZodError): Record<string, string[]> {
  return z.flattenError(err).fieldErrors as Record<string, string[]>;
}

export async function createSeason(
  _prev: SeasonActionState,
  formData: FormData,
): Promise<SeasonActionState> {
  const tenantId = await requireTenant();
  const parsed = seasonCreateSchema.safeParse({
    farm_id: formData.get("farm_id"),
    name: formData.get("name"),
    crop_type: formData.get("crop_type"),
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date"),
    status: formData.get("status") ?? "planned",
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: flatten(parsed.error) };
  }

  const { farm_id, status, ...rest } = parsed.data;

  const created = await withTenant(tenantId, async (tx) => {
    // If user asks for `active`, close any currently-active season on this
    // farm first — required by the partial unique index
    // `one_active_season_per_farm`.
    if (status === "active") {
      await tx.season.updateMany({
        where: { farm_id, status: "active" },
        data: { status: "closed", closed_at: new Date() },
      });
    }
    return tx.season.create({
      data: {
        tenant_id: tenantId,
        farm_id,
        name: rest.name,
        crop_type: rest.crop_type,
        start_date: new Date(rest.start_date),
        end_date: new Date(rest.end_date),
        status,
      },
    });
  });

  revalidatePath(`/farms/${farm_id}`);
  redirect(`/farms/${farm_id}/seasons/${created.id}`);
}

export async function activateSeason(
  farmId: string,
  seasonId: string,
): Promise<void> {
  const tenantId = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    await tx.season.updateMany({
      where: { farm_id: farmId, status: "active", id: { not: seasonId } },
      data: { status: "closed", closed_at: new Date() },
    });
    await tx.season.update({
      where: { id: seasonId },
      data: { status: "active", closed_at: null },
    });
  });
  revalidatePath(`/farms/${farmId}`);
  revalidatePath(`/farms/${farmId}/seasons/${seasonId}`);
}

export async function closeSeason(
  farmId: string,
  seasonId: string,
): Promise<void> {
  const tenantId = await requireTenant();
  await withTenant(tenantId, (tx) =>
    tx.season.update({
      where: { id: seasonId },
      data: { status: "closed", closed_at: new Date() },
    }),
  );
  revalidatePath(`/farms/${farmId}`);
  revalidatePath(`/farms/${farmId}/seasons/${seasonId}`);
}
