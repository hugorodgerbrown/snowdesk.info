import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../../../../generated/prisma/client";
import { analyseBulletin } from "../../lib/analyse-bulletin";
import { toDisplaySummary } from "../../lib/to-display-summary";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

/**
 * POST /poller/api/regenerate
 *
 * Regenerates Claude summaries for bulletins with empty or missing summaries.
 *
 * Body (optional):
 *   { "bulletinId": "abc-123" }  — regenerate a specific bulletin
 *   {}                           — regenerate all bulletins with empty summaries
 *
 * Query param:
 *   ?force=true                  — regenerate even if summary already exists
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const force = new URL(request.url).searchParams.get("force") === "true";

  let body: { bulletinId?: string } = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine
  }

  try {
    const where = body.bulletinId
      ? { bulletinId: body.bulletinId }
      : force
        ? {}
        : { summary: { equals: Prisma.DbNull } };

    const bulletins = await prisma.bulletin.findMany({ where });

    // Also pick up rows where summary was stored as empty object {}
    const toProcess = force || body.bulletinId
      ? bulletins
      : bulletins.filter((b) => {
          const s = b.summary as Record<string, unknown> | null;
          return !s || Object.keys(s).length === 0;
        });

    if (toProcess.length === 0) {
      return Response.json({ ok: true, message: "Nothing to regenerate", updated: 0 });
    }

    console.log(`[REGENERATE] Processing ${toProcess.length} bulletin(s)...`);

    const results = [];
    for (const bulletin of toProcess) {
      try {
        const regionId = bulletin.regionIds[0];
        if (!regionId) throw new Error("Bulletin has no regionIds");
        const analysis = await analyseBulletin(bulletin.rawData as never, regionId);
        const summary = toDisplaySummary(analysis);

        await prisma.bulletin.update({
          where: { id: bulletin.id },
          data: { summary: summary as Prisma.InputJsonValue },
        });

        console.log(`[REGENERATE] Updated ${bulletin.bulletinId}`);
        results.push({ bulletinId: bulletin.bulletinId, status: "updated" });
      } catch (error) {
        console.error(`[REGENERATE] Failed for ${bulletin.bulletinId}:`, error);
        results.push({
          bulletinId: bulletin.bulletinId,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return Response.json({ ok: true, updated: results.filter((r) => r.status === "updated").length, results });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
