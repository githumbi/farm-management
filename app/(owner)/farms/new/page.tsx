import Link from "next/link";

import { FarmForm } from "@/components/forms/FarmForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewFarmPage() {
  return (
    <section className="mx-auto max-w-xl space-y-6">
      <div>
        <Link
          href="/farms"
          className="text-sm text-neutral-600 hover:underline"
        >
          ← Back to farms
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-900">
          New farm
        </h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Farm details</CardTitle>
        </CardHeader>
        <CardContent>
          <FarmForm />
        </CardContent>
      </Card>
    </section>
  );
}
