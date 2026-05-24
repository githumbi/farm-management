import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.tenantId) return null;

  const { farmCount, activeSeasons } = await withTenant(
    session.tenantId,
    async (tx) => {
      const [farmCount, activeSeasons] = await Promise.all([
        tx.farm.count({ where: { archived_at: null } }),
        tx.season.findMany({
          where: { status: "active" },
          include: { farm: { select: { id: true, name: true } } },
          orderBy: { start_date: "desc" },
        }),
      ]);
      return { farmCount, activeSeasons };
    },
  );

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Dashboard</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Signed in as <strong>{session?.user?.email}</strong>.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-600">
              Active farms
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-neutral-900">
              {farmCount}
            </p>
            <Button asChild variant="link" className="px-0">
              <Link href="/farms">Manage farms →</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="sm:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm text-neutral-600">
              Active seasons
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeSeasons.length === 0 ? (
              <p className="text-sm text-neutral-600">
                None yet — activate a season from a farm page.
              </p>
            ) : (
              <ul className="space-y-2">
                {activeSeasons.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <Link
                      href={`/farms/${s.farm.id}/seasons/${s.id}`}
                      className="hover:underline"
                    >
                      {s.farm.name} · {s.name}
                    </Link>
                    <Badge>{s.crop_type}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
