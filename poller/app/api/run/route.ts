import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../../../../generated/prisma/client";
import { generateSummary } from "../../lib/generate-summary";
import { stripHtml } from "../../lib/html";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

interface SLFFeature {
  type: string;
  properties: {
    bulletinID: string;
    validTime: { startTime: string; endTime: string };
    nextUpdate: string;
    publicationTime: string;
    lang: string;
    unscheduled: boolean;
    regions: Array<{ regionID: string; name: string }>;
    dangerRatings: Array<{
      mainValue: string;
      customData?: { CH?: { subdivision?: string } };
    }>;
    avalancheProblems: Array<{
      problemType: string;
      comment: string;
      elevation?: { lowerBound?: number; upperBound?: number };
      aspects?: string[];
    }>;
    weatherForecast?: { comment: string };
    weatherReview?: { comment: string };
    snowpackStructure?: { comment: string };
    tendency?: Array<{ comment: string }>;
    customData?: Record<string, unknown>;
  };
  geometry: unknown;
}

export async function GET(request: Request) {
  // Verify cron authorization (skipped in local development)
  if (process.env.NODE_ENV !== "development") {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  try {
    console.log("[POLLER] Starting SLF avalanche bulletin fetch...");

    // 1. Fetch GeoJSON from SLF API
    const geojson = await fetchSLFBulletins();
    if (!geojson || !geojson.features || geojson.features.length === 0) {
      return Response.json({ ok: false, error: "No bulletins from SLF API" });
    }

    console.log(
      `[POLLER] Fetched ${geojson.features.length} bulletins, processing...`
    );

    const results = [];

    // 2. Process each bulletin
    for (const feature of geojson.features) {
      try {
        const featureBulletin = feature as SLFFeature;
        const props = featureBulletin.properties;

        console.log(`[POLLER] Processing bulletin ${props.bulletinID}`);

        // Check if we've already stored this bulletin
        const existing = await prisma.bulletin.findUnique({
          where: { bulletinId: props.bulletinID },
        });

        if (existing) {
          console.log(
            `[POLLER] Bulletin ${props.bulletinID} already exists, skipping`
          );
          results.push({ bulletinId: props.bulletinID, status: "skipped" });
          continue;
        }

        const processed = processComments(featureBulletin);
        const summary = await generateSummary(processed.properties);
        const bulletin = await storeBulletin(processed, summary);

        console.log(`[POLLER] Stored bulletin ${bulletin.id}`);
        results.push({ bulletinId: bulletin.id, status: "stored" });
      } catch (error) {
        console.error(
          `[POLLER] Error processing feature:`,
          error instanceof Error ? error.message : "Unknown error"
        );
        results.push({
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    console.log("[POLLER] Polling complete");
    return Response.json({
      ok: true,
      bulletinsProcessed: results.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[POLLER] Error:", error);
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Deep-clones the feature and, for every "comment" field in the SLF
 * properties that contains HTML, adds a sibling "commentHtml" field with
 * the original value and replaces "comment" with the plain-text version.
 *
 * Fields processed:
 *   properties.weatherForecast.comment
 *   properties.weatherReview.comment
 *   properties.snowpackStructure.comment
 *   properties.tendency[].comment
 *   properties.avalancheProblems[].comment
 */
function processComments(feature: SLFFeature): SLFFeature {
  const f = JSON.parse(JSON.stringify(feature)) as SLFFeature;
  const p = f.properties;

  const strip = (obj: { comment: string; commentHtml?: string }) => {
    obj.commentHtml = obj.comment;
    obj.comment = stripHtml(obj.comment);
  };

  if (p.weatherForecast) strip(p.weatherForecast);
  if (p.weatherReview) strip(p.weatherReview);
  if (p.snowpackStructure) strip(p.snowpackStructure);
  p.tendency?.forEach(strip);
  p.avalancheProblems?.forEach(strip);

  return f;
}

async function fetchSLFBulletins() {
  const url = process.env.EXTERNAL_API_URL;
  if (!url) {
    throw new Error("EXTERNAL_API_URL not configured");
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`SLF API returned ${response.status}`);
  }

  return response.json();
}


async function storeBulletin(feature: SLFFeature, summary?: Record<string, unknown>) {
  const props = feature.properties;

  const bulletin = await prisma.bulletin.create({
    data: {
      bulletinId: props.bulletinID,
      rawData: feature as unknown as Prisma.InputJsonValue,
      summary: (summary ?? {}) as Prisma.InputJsonValue,
      issuedAt: new Date(props.publicationTime),
      validFrom: new Date(props.validTime.startTime),
      validTo: new Date(props.validTime.endTime),
      nextUpdate: props.nextUpdate ? new Date(props.nextUpdate) : undefined,
      lang: props.lang,
      unscheduled: props.unscheduled,
      regionIds: props.regions.map((r) => r.regionID),
      regionNames: props.regions.map((r) => r.name),
    },
  });

  return bulletin;
}
