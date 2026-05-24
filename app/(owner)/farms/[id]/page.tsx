import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { archiveFarm, unarchiveFarm } from "@/lib/actions/farms";
import {
  markManagerConfirmed,
  unassignManager,
} from "@/lib/actions/managers";
import {
  activateSeason,
  closeSeason,
} from "@/lib/actions/seasons";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/db";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const dateFmt = new Intl.DateTimeFormat("en-KE", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export default async function FarmDetailPage({ params }: Params) {
  const { id } = await params;
  const session = await auth();
  if (!session?.tenantId) return null;

  const farm = await withTenant(session.tenantId, (tx) =>
    tx.farm.findUnique({
      where: { id },
      include: {
        seasons: { orderBy: [{ status: "asc" }, { start_date: "desc" }] },
        managers: {
          where: { unassigned_at: null },
          include: { manager: true },
          orderBy: { assigned_at: "asc" },
        },
      },
    }),
  );

  if (!farm) notFound();

  const archived = farm.archived_at !== null;

  return (
    <section className="space-y-8">
      <div>
        <Link
          href="/farms"
          className="text-sm text-neutral-600 hover:underline"
        >
          ← Back to farms
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-neutral-900">
                {farm.name}
              </h1>
              {archived ? <Badge variant="secondary">Archived</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-neutral-600">{farm.location}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/farms/${farm.id}/edit`}>Edit</Link>
            </Button>
            {archived ? (
              <form
                action={async () => {
                  "use server";
                  await unarchiveFarm(farm.id);
                }}
              >
                <Button type="submit" variant="outline" size="sm">
                  Unarchive
                </Button>
              </form>
            ) : (
              <form
                action={async () => {
                  "use server";
                  await archiveFarm(farm.id);
                }}
              >
                <Button type="submit" variant="outline" size="sm">
                  Archive
                </Button>
              </form>
            )}
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-4 text-xs text-neutral-500 sm:grid-cols-4">
          <Stat label="Size" value={`${Number(farm.size_acres).toFixed(2)} acres`} />
          <Stat
            label="Ownership"
            value={farm.ownership_type === "owned" ? "Owned" : "Rented"}
          />
          <Stat label="Currency" value={farm.currency} />
          <Stat label="Seasons" value={String(farm.seasons.length)} />
          {farm.latitude !== null && farm.longitude !== null ? (
            <Stat
              label="Coordinates"
              value={
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${farm.latitude},${farm.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-neutral-900 underline hover:text-neutral-700"
                >
                  {Number(farm.latitude).toFixed(5)},{" "}
                  {Number(farm.longitude).toFixed(5)}
                </a>
              }
            />
          ) : null}
        </dl>
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Seasons</h2>
          <p className="text-sm text-neutral-600">
            One season can be active per farm at a time.
          </p>
        </div>
        <Button asChild>
          <Link href={`/farms/${farm.id}/seasons/new`}>New season</Link>
        </Button>
      </div>

      {farm.seasons.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-neutral-600">
            No seasons yet for this farm.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {farm.seasons.map((s) => (
            <li key={s.id}>
              <Card>
                <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                  <div>
                    <CardTitle className="text-base">
                      <Link
                        href={`/farms/${farm.id}/seasons/${s.id}`}
                        className="hover:underline"
                      >
                        {s.name}
                      </Link>
                    </CardTitle>
                    <p className="mt-1 text-xs text-neutral-500">
                      {s.crop_type} · {dateFmt.format(s.start_date)} —{" "}
                      {dateFmt.format(s.end_date)}
                    </p>
                  </div>
                  <SeasonBadge status={s.status} />
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2 pt-0">
                  {s.status !== "active" ? (
                    <form
                      action={async () => {
                        "use server";
                        await activateSeason(farm.id, s.id);
                      }}
                    >
                      <Button type="submit" size="sm" variant="outline">
                        Activate
                      </Button>
                    </form>
                  ) : null}
                  {s.status !== "closed" ? (
                    <form
                      action={async () => {
                        "use server";
                        await closeSeason(farm.id, s.id);
                      }}
                    >
                      <Button type="submit" size="sm" variant="outline">
                        Close
                      </Button>
                    </form>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Separator />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Managers</h2>
          <p className="text-sm text-neutral-600">
            Managers log expenses for this farm via WhatsApp.
          </p>
        </div>
        <Button asChild>
          <Link href={`/farms/${farm.id}/managers/new`}>Add manager</Link>
        </Button>
      </div>

      {farm.managers.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-neutral-600">
            No managers assigned yet.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {farm.managers.map((fm) => (
            <li key={fm.id}>
              <Card>
                <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                  <div>
                    <CardTitle className="text-base">
                      {fm.manager.display_name}
                    </CardTitle>
                    <p className="mt-1 font-mono text-xs text-neutral-500">
                      {fm.manager.whatsapp_e164}
                    </p>
                  </div>
                  {fm.confirmed_at ? (
                    <Badge>Confirmed</Badge>
                  ) : (
                    <Badge variant="outline">Pending YES</Badge>
                  )}
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2 pt-0">
                  {!fm.confirmed_at ? (
                    <form
                      action={async () => {
                        "use server";
                        await markManagerConfirmed(farm.id, fm.manager_id);
                      }}
                    >
                      <Button type="submit" size="sm" variant="outline">
                        Mark confirmed
                      </Button>
                    </form>
                  ) : null}
                  <form
                    action={async () => {
                      "use server";
                      await unassignManager(farm.id, fm.manager_id);
                    }}
                  >
                    <Button type="submit" size="sm" variant="ghost">
                      Unassign
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className="mt-1 text-neutral-900">{value}</dd>
    </div>
  );
}

function SeasonBadge({ status }: { status: "planned" | "active" | "closed" }) {
  if (status === "active") return <Badge>Active</Badge>;
  if (status === "planned") return <Badge variant="outline">Planned</Badge>;
  return <Badge variant="secondary">Closed</Badge>;
}
