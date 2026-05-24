import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  activateSeason,
  closeSeason,
} from "@/lib/actions/seasons";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/db";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; seasonId: string }> };

const dateFmt = new Intl.DateTimeFormat("en-KE", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export default async function SeasonDetailPage({ params }: Params) {
  const { id: farmId, seasonId } = await params;
  const session = await auth();
  if (!session?.tenantId) return null;

  const season = await withTenant(session.tenantId, (tx) =>
    tx.season.findUnique({
      where: { id: seasonId },
      include: { farm: { select: { id: true, name: true } } },
    }),
  );
  if (!season || season.farm_id !== farmId) notFound();

  return (
    <section className="space-y-6">
      <div>
        <Link
          href={`/farms/${season.farm.id}`}
          className="text-sm text-neutral-600 hover:underline"
        >
          ← Back to {season.farm.name}
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-neutral-900">
            {season.name}
          </h1>
          <SeasonBadge status={season.status} />
        </div>
        <p className="mt-1 text-sm text-neutral-600">
          {season.crop_type} · {dateFmt.format(season.start_date)} —{" "}
          {dateFmt.format(season.end_date)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {season.status !== "active" ? (
          <form
            action={async () => {
              "use server";
              await activateSeason(season.farm.id, season.id);
            }}
          >
            <Button type="submit" variant="outline">
              Activate season
            </Button>
          </form>
        ) : null}
        {season.status !== "closed" ? (
          <form
            action={async () => {
              "use server";
              await closeSeason(season.farm.id, season.id);
            }}
          >
            <Button type="submit" variant="outline">
              Close season
            </Button>
          </form>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expenses & revenue</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-neutral-600">
          Expense and revenue tracking lights up once M7–M8 land (WhatsApp
          intake + manual entry from the dashboard).
        </CardContent>
      </Card>
    </section>
  );
}

function SeasonBadge({ status }: { status: "planned" | "active" | "closed" }) {
  if (status === "active") return <Badge>Active</Badge>;
  if (status === "planned") return <Badge variant="outline">Planned</Badge>;
  return <Badge variant="secondary">Closed</Badge>;
}
