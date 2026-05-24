"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { managerAssignSchema } from "@/lib/validators/manager";
import {
  MANAGER_ASSIGNMENT_TEMPLATE,
  sendManagerAssignmentTemplate,
} from "@/lib/wa/templates";

export type ManagerActionState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

async function requireSession() {
  const session = await auth();
  if (!session?.tenantId) redirect("/login");
  return session;
}

function flatten(err: z.ZodError): Record<string, string[]> {
  return z.flattenError(err).fieldErrors as Record<string, string[]>;
}

export async function assignManager(
  _prev: ManagerActionState,
  formData: FormData,
): Promise<ManagerActionState> {
  const session = await requireSession();
  const tenantId = session.tenantId;

  const parsed = managerAssignSchema.safeParse({
    farm_id: formData.get("farm_id"),
    display_name: formData.get("display_name"),
    whatsapp_e164: formData.get("whatsapp_e164"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: flatten(parsed.error) };
  }

  const { farm_id, display_name, whatsapp_e164 } = parsed.data;

  // 1) Upsert manager + farm_managers under RLS (transactional).
  const { manager, farm, alreadyAssigned } = await withTenant(
    tenantId,
    async (tx) => {
      const farm = await tx.farm.findUnique({
        where: { id: farm_id },
        select: { id: true, name: true, tenant_id: true },
      });
      if (!farm) throw new Error("Farm not found");

      // Idempotent on (tenant_id, whatsapp_e164) — reuse manager if same
      // tenant already added this phone for another farm.
      const existing = await tx.manager.findUnique({
        where: {
          tenant_id_whatsapp_e164: {
            tenant_id: tenantId,
            whatsapp_e164,
          },
        },
      });

      const manager =
        existing ??
        (await tx.manager.create({
          data: {
            tenant_id: tenantId,
            whatsapp_e164,
            display_name,
          },
        }));

      // Already actively assigned to this farm? Skip insert.
      const activeAssignment = await tx.farmManager.findFirst({
        where: {
          farm_id,
          manager_id: manager.id,
          unassigned_at: null,
        },
      });

      if (activeAssignment) {
        return { manager, farm, alreadyAssigned: true };
      }

      await tx.farmManager.create({
        data: { farm_id, manager_id: manager.id },
      });

      return { manager, farm, alreadyAssigned: false };
    },
  );

  // 2) Fire the WA template asynchronously w.r.t. the DB write. We record
  // every attempt in wa_outbound_messages so failures are inspectable.
  // (Done outside withTenant — outbound rows are tenant-scoped via the
  // tenant_id we pass in, and we don't want a Meta API hiccup to roll back
  // the assignment.)
  if (!alreadyAssigned) {
    await sendAssignmentTemplate({
      tenantId,
      to: whatsapp_e164,
      managerName: manager.display_name,
      ownerName: session.user?.name ?? session.user?.email ?? "ShambaTrack",
      farmName: farm.name,
    });
  }

  revalidatePath(`/farms/${farm_id}`);
  redirect(`/farms/${farm_id}`);
}

export async function unassignManager(
  farmId: string,
  managerId: string,
): Promise<void> {
  const session = await requireSession();
  await withTenant(session.tenantId, (tx) =>
    tx.farmManager.updateMany({
      where: { farm_id: farmId, manager_id: managerId, unassigned_at: null },
      data: { unassigned_at: new Date() },
    }),
  );
  revalidatePath(`/farms/${farmId}`);
}

export async function markManagerConfirmed(
  farmId: string,
  managerId: string,
): Promise<void> {
  // Manual override — used when the WA YES reply path isn't wired yet
  // (M5 ships before M6/M7). Owner can flip the assignment to confirmed
  // from the UI so downstream features that gate on confirmation work.
  const session = await requireSession();
  await withTenant(session.tenantId, (tx) =>
    tx.farmManager.updateMany({
      where: {
        farm_id: farmId,
        manager_id: managerId,
        unassigned_at: null,
        confirmed_at: null,
      },
      data: { confirmed_at: new Date() },
    }),
  );
  revalidatePath(`/farms/${farmId}`);
}

async function sendAssignmentTemplate(opts: {
  tenantId: string;
  to: string;
  managerName: string;
  ownerName: string;
  farmName: string;
}): Promise<void> {
  const result = await sendManagerAssignmentTemplate({
    to: opts.to,
    managerName: opts.managerName,
    ownerName: opts.ownerName,
    farmName: opts.farmName,
  });

  await withTenant(opts.tenantId, (tx) =>
    tx.waOutboundMessage.create({
      data: {
        tenant_id: opts.tenantId,
        to_e164: opts.to,
        body: `Template: ${MANAGER_ASSIGNMENT_TEMPLATE}`,
        template_name: MANAGER_ASSIGNMENT_TEMPLATE,
        status: result.ok ? "sent" : "failed",
        sent_at: result.ok ? new Date() : null,
        wa_message_id: result.ok ? result.wa_message_id : null,
        error: result.ok ? null : result.error,
      },
    }),
  );
}
