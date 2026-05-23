import { auth } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <section>
      <h1 className="text-2xl font-semibold text-neutral-900">Dashboard</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Signed in as <strong>{session?.user?.email}</strong>.
      </p>
      <div className="mt-6 rounded-md border border-dashed border-neutral-300 bg-white p-6 text-sm text-neutral-600">
        Farms, seasons, and the P&amp;L summary will appear here as later
        milestones come online (M4, M10).
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-4 text-xs text-neutral-500 sm:grid-cols-4">
        <div>
          <dt>Tenant id</dt>
          <dd className="mt-1 break-all font-mono text-neutral-700">
            {session?.tenantId ?? "—"}
          </dd>
        </div>
        <div>
          <dt>User id</dt>
          <dd className="mt-1 break-all font-mono text-neutral-700">
            {session?.userId ?? "—"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
