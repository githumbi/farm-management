"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import {
  farmCreateSchema,
  farmUpdateSchema,
} from "@/lib/validators/farm";

export type FarmActionState = {
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

export async function createFarm(
  _prev: FarmActionState,
  formData: FormData,
): Promise<FarmActionState> {
  const tenantId = await requireTenant();
  const parsed = farmCreateSchema.safeParse({
    name: formData.get("name"),
    location: formData.get("location"),
    size_acres: formData.get("size_acres"),
    ownership_type: formData.get("ownership_type"),
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: flatten(parsed.error) };
  }

  await withTenant(tenantId, (tx) =>
    tx.farm.create({
      data: {
        tenant_id: tenantId,
        name: parsed.data.name,
        location: parsed.data.location,
        size_acres: parsed.data.size_acres,
        ownership_type: parsed.data.ownership_type,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
      },
    }),
  );

  revalidatePath("/farms");
  redirect("/farms");
}

export async function updateFarm(
  _prev: FarmActionState,
  formData: FormData,
): Promise<FarmActionState> {
  const tenantId = await requireTenant();
  const parsed = farmUpdateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    location: formData.get("location"),
    size_acres: formData.get("size_acres"),
    ownership_type: formData.get("ownership_type"),
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: flatten(parsed.error) };
  }

  const { id, latitude, longitude, ...rest } = parsed.data;
  await withTenant(tenantId, (tx) =>
    tx.farm.update({
      where: { id },
      data: {
        ...rest,
        // null clears the column when user blanks both fields; undefined would
        // leave the existing value untouched, which isn't what we want.
        latitude: latitude ?? null,
        longitude: longitude ?? null,
      },
    }),
  );

  revalidatePath("/farms");
  revalidatePath(`/farms/${id}`);
  redirect(`/farms/${id}`);
}

export async function archiveFarm(farmId: string): Promise<void> {
  const tenantId = await requireTenant();
  await withTenant(tenantId, (tx) =>
    tx.farm.update({
      where: { id: farmId },
      data: { archived_at: new Date() },
    }),
  );
  revalidatePath("/farms");
  redirect("/farms");
}

export async function unarchiveFarm(farmId: string): Promise<void> {
  const tenantId = await requireTenant();
  await withTenant(tenantId, (tx) =>
    tx.farm.update({
      where: { id: farmId },
      data: { archived_at: null },
    }),
  );
  revalidatePath("/farms");
  revalidatePath(`/farms/${farmId}`);
}
