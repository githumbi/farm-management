import Link from "next/link";
import { notFound } from "next/navigation";

import { SeasonForm } from "@/components/forms/SeasonForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/db";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function NewSeasonPage({ params }: Params) {
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
          New season
        </h1>
        <p className="mt-1 text-sm text-neutral-600">For {farm.name}.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Season details</CardTitle>
        </CardHeader>
        <CardContent>
          <SeasonForm farmId={farm.id} />
        </CardContent>
      </Card>
    </section>
  );
}
