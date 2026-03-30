import { redirect } from "next/navigation";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { toSlug } from "./slug";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

export default async function Home() {
  // Find all bulletins from the most recent issue
  const latest = await prisma.bulletin.findFirst({
    orderBy: { issuedAt: "desc" },
    select: { issuedAt: true },
  });

  if (!latest) {
    return (
      <main style={{ padding: "40px", maxWidth: "700px", margin: "0 auto", fontFamily: "sans-serif" }}>
        <h1 style={{ fontSize: "28px", marginBottom: "8px" }}>Snowdesk</h1>
        <p style={{ color: "#666" }}>No bulletin data yet. Run the poller to fetch today's forecast.</p>
      </main>
    );
  }

  const bulletins = await prisma.bulletin.findMany({
    where: { issuedAt: latest.issuedAt },
    select: { regionNames: true },
  });

  // Pick a random zone from the current issue
  const allZones = bulletins
    .flatMap((b) => b.regionNames ?? [])
    .map(toSlug)
    .filter(Boolean);

  if (allZones.length === 0) {
    return (
      <main style={{ padding: "40px", maxWidth: "700px", margin: "0 auto", fontFamily: "sans-serif" }}>
        <h1 style={{ fontSize: "28px", marginBottom: "8px" }}>Snowdesk</h1>
        <p style={{ color: "#666" }}>Bulletin stored — no zone data available.</p>
      </main>
    );
  }

  const randomZone = allZones[Math.floor(Math.random() * allZones.length)];
  redirect(`/${randomZone}`);
}
