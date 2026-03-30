import { Anthropic } from "@anthropic-ai/sdk";
import { PrismaClient } from "@prisma/client";
import { Resend } from "resend";

const prisma = new PrismaClient();
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
const resend = new Resend(process.env.RESEND_API_KEY);

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
    dangerRatings: Array<{ mainValue: string }>;
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
  // Verify cron authorization
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
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

        // Generate summary using Claude
        const summary = await generateSummary(props);

        // Store in Supabase
        const bulletin = await storeBulletin(featureBulletin, summary);

        console.log(`[POLLER] Stored bulletin ${bulletin.id}`);
        results.push({ bulletinId: bulletin.id, status: "stored" });

        // Send notifications
        await sendNotifications(bulletin, summary);
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

async function generateSummary(props: SLFFeature["properties"]) {
  // Extract and clean HTML-encoded text
  const cleanHtml = (html: string) => {
    if (!html) return "";
    return html
      .replace(/<[^>]*>/g, " ") // Remove HTML tags
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  };

  const weatherForecast = cleanHtml(props.weatherForecast?.comment || "");
  const snowpackStructure = cleanHtml(props.snowpackStructure?.comment || "");
  const tendencyText = cleanHtml(props.tendency?.[0]?.comment || "");

  // Get primary danger level and subdivision nuance
  const mainDangerRating = props.dangerRatings?.[0]?.mainValue || "unknown";
  const subdivision = props.dangerRatings?.[0]?.customData?.CH?.subdivision || null;
  const nuancedDanger = `${mainDangerRating}${subdivision === "plus" ? "+" : subdivision === "minus" ? "-" : ""}`;

  const prompt = `You are an avalanche forecasting expert. Summarize this SLF avalanche bulletin into a JSON object.

## Bulletin Data

**Issue Time:** ${props.publicationTime}
**Valid Until:** ${props.validTime.endTime}
**Primary Danger Level:** ${nuancedDanger}

**Regions Covered:** ${props.regions.map((r) => r.name).join(", ")}

**Avalanche Problems:**
${props.avalancheProblems
  .map(
    (p) => `
- **Type:** ${p.problemType}
- **Comment:** ${p.comment}
- **Elevation:** ${p.elevation ? `${p.elevation.lowerBound || "N/A"}m - ${p.elevation.upperBound || "N/A"}m` : "All elevations"}
- **Aspects:** ${p.aspects?.join(", ") || "All aspects"}
`
  )
  .join("")}

**Weather Forecast (from past 24h and next forecast):**
${weatherForecast}

**Snowpack Structure:**
${snowpackStructure}

**Outlook (2-day forecast):**
${tendencyText}

## Task

Return ONLY a valid JSON object (no markdown, no extra text) with this exact structure:
{
  "headline": "One-line summary of the main danger (e.g., 'High avalanche danger with wind slabs above 2400m')",
  "overview": "2-3 sentence summary of the key avalanche hazards and travel implications",
  "mainDanger": "${mainDangerRating}",
  "keyProblems": [
    {
      "type": "problem type (new_snow, wind_slab, wet_snow, gliding_snow, persistent_weak_layer, loose_snow)",
      "description": "Brief description of this problem",
      "elevation": "Elevation range or description",
      "aspects": "Cardinal directions affected"
    }
  ],
  "travelAdvice": "Bullet points of recommended actions for backcountry travelers",
  "regions": [
    {
      "name": "Region name",
      "dangerLevel": "low|moderate|considerable|high|very_high"
    }
  ]
}`;

  const message = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response from Claude");
  }

  try {
    return JSON.parse(content.text);
  } catch {
    console.error("Failed to parse Claude response:", content.text);
    throw new Error("Claude response was not valid JSON");
  }
}

async function storeBulletin(
  feature: SLFFeature,
  summary: Record<string, unknown>
) {
  const props = feature.properties;

  const bulletin = await prisma.bulletin.create({
    data: {
      bulletinId: props.bulletinID,
      rawData: feature,
      summary,
      issuedAt: new Date(props.publicationTime),
      validFrom: new Date(props.validTime.startTime),
      validTo: new Date(props.validTime.endTime),
      nextUpdate: props.nextUpdate ? new Date(props.nextUpdate) : undefined,
      lang: props.lang,
      unscheduled: props.unscheduled,
      regions: {
        create: props.regions.map((region) => ({
          regionId: region.regionID,
          regionName: region.name,
          dangerLevel: props.dangerRatings?.[0]?.mainValue || "unknown",
          rawData: region,
        })),
      },
    },
    include: { regions: true },
  });

  return bulletin;
}

async function sendNotifications(
  bulletin: unknown,
  summary: Record<string, unknown>
) {
  // TODO: Configure recipient emails (from env or database)
  const recipients: string[] = [];
  if (!recipients.length) {
    console.log("[POLLER] No recipients configured, skipping email");
    return;
  }

  const emailPromises = recipients.map(async (recipient) => {
    try {
      const result = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "noreply@snowdesk.info",
        to: recipient,
        subject: `Avalanche Bulletin: ${summary.headline}`,
        html: renderEmailHTML(summary),
      });

      const bulletinData = bulletin as Record<string, unknown>;
      await prisma.emailNotification.create({
        data: {
          bulletinId: bulletinData.id as string,
          recipient,
          status: "sent",
          sentAt: new Date(),
        },
      });

      console.log(`[POLLER] Email sent to ${recipient}`, result);
    } catch (error) {
      console.error(`[POLLER] Failed to send email to ${recipient}:`, error);

      const bulletinData = bulletin as Record<string, unknown>;
      await prisma.emailNotification.create({
        data: {
          bulletinId: bulletinData.id as string,
          recipient,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  });

  await Promise.all(emailPromises);
}

function renderEmailHTML(summary: Record<string, unknown>) {
  const keyProblems = (summary.keyProblems as Array<unknown>) || [];
  const regions = (summary.regions as Array<unknown>) || [];

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .headline { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
    .overview { font-size: 14px; margin-bottom: 20px; color: #666; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 18px; font-weight: bold; margin-bottom: 10px; border-bottom: 2px solid #ddd; padding-bottom: 5px; }
    .problem { margin-bottom: 10px; padding: 10px; background: #f9f9f9; border-left: 4px solid #f0ad4e; }
    .danger-level { font-weight: bold; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="headline">${summary.headline}</div>
    <div class="overview">${summary.overview}</div>

    <div class="section">
      <div class="section-title">Key Problems</div>
      ${keyProblems.map((p: unknown) => {
        const prob = p as Record<string, unknown>;
        return `
        <div class="problem">
          <strong>${prob.type}:</strong> ${prob.description}
          <div style="font-size: 12px; color: #666; margin-top: 5px;">
            ${prob.elevation} | ${prob.aspects}
          </div>
        </div>
      `;
      })}
    </div>

    <div class="section">
      <div class="section-title">Danger Levels by Region</div>
      ${regions.map((r: unknown) => {
        const reg = r as Record<string, unknown>;
        return `
        <div style="padding: 8px; margin-bottom: 5px; background: #f9f9f9; border-radius: 4px;">
          <strong>${reg.name}</strong>: <span class="danger-level">${reg.dangerLevel}</span>
        </div>
      `;
      })}
    </div>

    <div class="section">
      <div class="section-title">Travel Advice</div>
      <p>${summary.travelAdvice}</p>
    </div>
  </div>
</body>
</html>
  `;
}

