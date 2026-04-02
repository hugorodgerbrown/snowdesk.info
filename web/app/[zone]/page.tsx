import { notFound } from "next/navigation";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/prisma/client";
import { BulletinView } from "../bulletin-view";
import { toSlug } from "../slug";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

export default async function ZonePage({ params }: { params: Promise<{ zone: string }> }) {
  const { zone } = await params;

  // Fetch the most recent bulletins with their latest summary
  const recentBulletins = await prisma.bulletin.findMany({
    orderBy: { issuedAt: "desc" },
    take: 100,
    include: { summaries: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  const bulletin = recentBulletins.find((b) =>
    b.regionNames?.some((name) => toSlug(name) === zone),
  );

  if (!bulletin) notFound();

  const summary = bulletin.summaries[0]?.summary ?? null;

  return <BulletinView bulletin={bulletin} summary={summary} />;
}
