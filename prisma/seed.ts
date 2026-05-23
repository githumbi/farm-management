import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

const SYSTEM_CATEGORIES: { slug: string; name: string; color: string }[] = [
  { slug: "fertilizer", name: "Fertilizer", color: "#16a34a" },
  { slug: "seeds", name: "Seeds", color: "#65a30d" },
  { slug: "labor", name: "Labor", color: "#0891b2" },
  { slug: "transport", name: "Transport", color: "#0284c7" },
  { slug: "chemicals", name: "Chemicals", color: "#9333ea" },
  { slug: "equipment", name: "Equipment", color: "#dc2626" },
  { slug: "irrigation", name: "Irrigation", color: "#0ea5e9" },
  { slug: "land_prep", name: "Land prep", color: "#a16207" },
  { slug: "harvest", name: "Harvest", color: "#ea580c" },
  { slug: "other", name: "Other", color: "#64748b" },
];

async function main() {
  for (const c of SYSTEM_CATEGORIES) {
    // tenant_id NULL means "system default" — visible to every tenant.
    // The unique index (tenant_id, slug) treats NULL as distinct, so we
    // can't upsert; look up first.
    const existing = await db.category.findFirst({
      where: { tenant_id: null, slug: c.slug },
    });
    if (existing) {
      await db.category.update({
        where: { id: existing.id },
        data: { name: c.name, color: c.color },
      });
    } else {
      await db.category.create({
        data: { tenant_id: null, slug: c.slug, name: c.name, color: c.color },
      });
    }
  }

  const count = await db.category.count({ where: { tenant_id: null } });
  console.log(`Seeded system categories: ${count}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
