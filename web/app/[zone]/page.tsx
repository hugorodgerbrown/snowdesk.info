import { notFound } from "next/navigation";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/prisma/client";
import { BulletinView } from "../bulletin-view";
import { toSlug } from "../slug";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

export default async function ZonePage({
  params,
  searchParams,
}: {
  params: Promise<{ zone: string }>;
  searchParams: Promise<{ id?: string }>;
}) {
  const [{ zone }, { id }] = await Promise.all([params, searchParams]);

  // Fetch all bulletins for this zone (covers ~30 days at 2/day), newest first
  const zoneBulletins = await prisma.bulletin.findMany({
    orderBy: { issuedAt: "desc" },
    take: 60,
    include: { summaries: { orderBy: { createdAt: "desc" }, take: 1 } },
    where: {
      // Filter to bulletins that contain at least one region matching this slug.
      // Prisma doesn't support array element functions directly, so we filter in JS below.
    },
  });

  const forZone = zoneBulletins.filter((b) => b.regionNames?.some((name) => toSlug(name) === zone));

  if (forZone.length === 0) notFound();

  // Find the requested bulletin (by id) or fall back to the latest
  const idx = id ? forZone.findIndex((b) => b.bulletinId === id) : 0;
  const bulletin = forZone[idx === -1 ? 0 : idx];

  if (!bulletin) notFound();

  const summary = bulletin.summaries[0]?.summary ?? null;

  // Adjacent bulletins for navigation (older = higher index)
  const prevBulletin = forZone[idx + 1] ?? null;
  const nextBulletin = idx > 0 ? forZone[idx - 1] : null;

  return (
    <BulletinView
      bulletin={bulletin}
      summary={summary}
      activeZone={zone}
      prevBulletin={
        prevBulletin
          ? { bulletinId: prevBulletin.bulletinId, issuedAt: prevBulletin.issuedAt }
          : null
      }
      nextBulletin={
        nextBulletin
          ? { bulletinId: nextBulletin.bulletinId, issuedAt: nextBulletin.issuedAt }
          : null
      }
    />
  );
}
