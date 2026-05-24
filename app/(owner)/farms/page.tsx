import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function FarmsPage() {
  const session = await auth();
  if (!session?.tenantId) return null;

  const farms = await withTenant(session.tenantId, (tx) =>
    tx.farm.findMany({
      orderBy: [{ archived_at: "asc" }, { created_at: "desc" }],
      include: {
        _count: { select: { seasons: true } },
        seasons: {
          where: { status: "active" },
          select: { id: true, name: true },
          take: 1,
        },
      },
    }),
  );

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Farms</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Manage the farms you own and the seasons running on each.
          </p>
        </div>
        <Button asChild>
          <Link href="/farms/new">New farm</Link>
        </Button>
      </div>

      {farms.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-neutral-600">
            No farms yet.{" "}
            <Link href="/farms/new" className="underline">
              Create your first farm
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {farms.map((farm) => {
            const activeSeason = farm.seasons[0];
            const archived = farm.archived_at !== null;
            return (
              <li key={farm.id}>
                <Card className={archived ? "opacity-60" : undefined}>
                  <CardContent className="space-y-3 py-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link
                          href={`/farms/${farm.id}`}
                          className="text-base font-medium text-neutral-900 hover:underline"
                        >
                          {farm.name}
                        </Link>
                        <p className="text-xs text-neutral-500">
                          {farm.location}
                        </p>
                      </div>
                      {archived ? (
                        <Badge variant="secondary">Archived</Badge>
                      ) : (
                        <Badge variant="outline">
                          {farm.ownership_type === "owned"
                            ? "Owned"
                            : "Rented"}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-600">
                      <span>{Number(farm.size_acres).toFixed(2)} acres</span>
                      <span>·</span>
                      <span>{farm._count.seasons} season(s)</span>
                      {activeSeason ? (
                        <>
                          <span>·</span>
                          <span className="text-emerald-700">
                            Active: {activeSeason.name}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
