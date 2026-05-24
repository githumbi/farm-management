import Link from "next/link";
import { notFound } from "next/navigation";

import { ManagerForm } from "@/components/forms/ManagerForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/db";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function NewManagerPage({ params }: Params) {
  const { id } = await params;
  const session = await auth();
  if (!session?.tenantId) return null;

  const farm = await withTenant(session.tenantId, (tx) =>
    tx.farm.findUnique({
      where: { id },
      select: { id: true, name: true },
    }),
  );
  if (!farm) notFound();

  return (
    <section className="mx-auto max-w-xl space-y-6">
      <div>
        <Link
          href={`/farms/${farm.id}`}
          className="text-sm text-neutral-600 hover:underline"
        >
          ← Back to {farm.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-900">
          Add manager
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          We&apos;ll text them a WhatsApp message asking to confirm the
          assignment. Logging expenses for {farm.name} starts once they reply
          YES.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Manager details</CardTitle>
        </CardHeader>
        <CardContent>
          <ManagerForm farmId={farm.id} />
        </CardContent>
      </Card>
    </section>
  );
}
