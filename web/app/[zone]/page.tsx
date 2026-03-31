import { notFound } from "next/navigation";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/prisma/client";
import { BulletinView } from "../bulletin-view";
import { toSlug } from "../slug";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

export default async function ZonePage({ params }: { params: Promise<{ zone: string }> }) {
  const { zone } = await params;

  // Fetch the most recent bulletins and find the one matching this slug
  const recentBulletins = await prisma.bulletin.findMany({
    orderBy: { issuedAt: "desc" },
    take: 100,
  });

  const bulletin = recentBulletins.find((b) =>
    b.regionNames?.some((name) => toSlug(name) === zone),
  );

  if (!bulletin) notFound();

  return <BulletinView bulletin={bulletin} />;
}
