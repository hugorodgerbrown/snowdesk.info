// api/backfill/route.ts
//
// Fetches all SLF bulletins within a date range and stores the raw data.
// Handles SLF list API pagination internally — callers just supply dates.
// Does NOT create Claude summaries — run /poller/api/regenerate afterwards.
//
// GET /poller/api/backfill?from=20251101&to=20260401
//
// Query params:
//   from   (required) — start date inclusive, yyyymmdd
//   to     (required) — end date inclusive, yyyymmdd
//   force  (default false) — upsert existing bulletins instead of skipping
//
// Response:
//   { ok, stored, skipped, pagesfetched, from, to }
//
// Auth: Bearer CRON_SECRET header (skipped in development).

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../../../../generated/prisma/client";
import { fetchBulletinList, type CAAMLBulletin } from "../../lib/fetch-bulletin-list";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const LANG = "en";
const PAGE_SIZE = 50;

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  if (!fromParam || !toParam) {
    return Response.json(
      { ok: false, error: "from and to are required (yyyymmdd)" },
      { status: 400 },
    );
  }

  const fromDate = parseYyyymmdd(fromParam);
  const toDate = parseYyyymmdd(toParam);

  if (!fromDate || !toDate) {
    return Response.json(
      { ok: false, error: "Invalid date format — use yyyymmdd, e.g. 20251101" },
      { status: 400 },
    );
  }

  if (fromDate > toDate) {
    return Response.json(
      { ok: false, error: "from must be before or equal to to" },
      { status: 400 },
    );
  }

  // End of the `to` day (exclusive upper bound for comparisons)
  const toEnd = new Date(toDate.getTime() + 24 * 60 * 60 * 1000);
  const force = searchParams.get("force") === "true";

  let stored = 0;
  let skipped = 0;
  let pagesFetched = 0;
  let offset = 0;

  try {
    console.log(`[BACKFILL] Range ${fromParam}–${toParam} force=${force}`);

    outer: while (true) {
      const page = await fetchBulletinList(LANG, PAGE_SIZE, offset);
      pagesFetched++;

      if (page.length === 0) break;

      for (const b of page) {
        const issuedAt = new Date(b.publicationTime);

        if (issuedAt >= toEnd) {
          // Bulletin is newer than the to date — skip, keep paging
          continue;
        }

        if (issuedAt < fromDate) {
          // Bulletin is older than the from date — nothing further will be in range
          console.log(`[BACKFILL] Passed from boundary at ${issuedAt.toISOString()}, stopping`);
          break outer;
        }

        // Bulletin is within range
        if (!force) {
          const existing = await prisma.bulletin.findUnique({
            where: { bulletinId: b.bulletinID },
            select: { id: true },
          });
          if (existing) {
            skipped++;
            continue;
          }
        }

        await upsertBulletin(b);
        stored++;
        console.log(`[BACKFILL] Stored ${b.bulletinID} issued ${issuedAt.toISOString()}`);
      }

      // Fewer results than requested means we've reached the last page of the API
      if (page.length < PAGE_SIZE) break;

      offset += PAGE_SIZE;
    }

    return Response.json({
      ok: true,
      stored,
      skipped,
      pagesFetched,
      from: fromParam,
      to: toParam,
    });
  } catch (error) {
    console.error("[BACKFILL] Error:", error);
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

function parseYyyymmdd(s: string): Date | null {
  if (!/^\d{8}$/.test(s)) return null;
  const date = new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00Z`);
  return isNaN(date.getTime()) ? null : date;
}

async function upsertBulletin(b: CAAMLBulletin) {
  // Wrap in GeoJSON feature shape so rawData is compatible with analyseBulletin,
  // which expects { type: "Feature", geometry, properties: { bulletinID, ... } }.
  const rawData = {
    type: "Feature",
    geometry: null,
    properties: b,
  };

  const data = {
    bulletinId: b.bulletinID,
    rawData: rawData as unknown as Prisma.InputJsonValue,
    issuedAt: new Date(b.publicationTime),
    validFrom: new Date(b.validTime.startTime),
    validTo: new Date(b.validTime.endTime),
    nextUpdate: b.nextUpdate ? new Date(b.nextUpdate) : undefined,
    lang: b.lang,
    unscheduled: b.unscheduled,
    regionIds: b.regions.map((r) => r.regionID),
    regionNames: b.regions.map((r) => r.name),
  };

  return prisma.bulletin.upsert({
    where: { bulletinId: b.bulletinID },
    create: data,
    update: data,
  });
}
