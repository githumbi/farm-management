import Link from "next/link";
import { notFound } from "next/navigation";

import { FarmForm } from "@/components/forms/FarmForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/db";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function EditFarmPage({ params }: Params) {
  const { id } = await params;
  const session = await auth();
  if (!session?.tenantId) return null;

  const farm = await withTenant(session.tenantId, (tx) =>
    tx.farm.findUnique({ where: { id } }),
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
          Edit farm
        </h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Farm details</CardTitle>
        </CardHeader>
        <CardContent>
          <FarmForm
            initial={{
              id: farm.id,
              name: farm.name,
              location: farm.location,
              size_acres: Number(farm.size_acres).toString(),
              ownership_type: farm.ownership_type,
              latitude:
                farm.latitude !== null ? Number(farm.latitude).toString() : null,
              longitude:
                farm.longitude !== null
                  ? Number(farm.longitude).toString()
                  : null,
            }}
          />
        </CardContent>
      </Card>
    </section>
  );
}
