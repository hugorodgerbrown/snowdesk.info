import { Anthropic } from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface SLFProperties {
  bulletinID: string;
  validTime: { startTime: string; endTime: string };
  publicationTime: string;
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
}

function cleanHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export async function generateSummary(props: SLFProperties) {
  const weatherForecast = cleanHtml(props.weatherForecast?.comment || "");
  const weatherReview = cleanHtml(props.weatherReview?.comment || "");
  const snowpackStructure = cleanHtml(props.snowpackStructure?.comment || "");
  const tendencyText = props.tendency?.map((t) => cleanHtml(t.comment)).join("\n") || "";

  const mainDangerRating = props.dangerRatings?.[0]?.mainValue || "unknown";
  const subdivision = props.dangerRatings?.[0]?.customData?.CH?.subdivision;
  const nuancedDanger = `${mainDangerRating}${subdivision === "plus" ? "+" : subdivision === "minus" ? "-" : ""}`;

  const issueDate = new Date(props.publicationTime).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const prompt = `You are an expert alpine guide writing a daily snow and avalanche briefing for recreational skiers and ski tourers in the Swiss Alps. Analyse this SLF avalanche bulletin and return a JSON object.

## Bulletin Data

**Date:** ${issueDate}
**Valid Until:** ${new Date(props.validTime.endTime).toLocaleString("en-GB")}
**Danger Level:** ${nuancedDanger}
**Regions:** ${props.regions.map((r) => r.name).join(", ")}

**Avalanche Problems:**
${props.avalancheProblems.map((p) => `- ${p.problemType}: ${p.comment} | Elevation: ${p.elevation ? `${p.elevation.lowerBound ?? "?"}–${p.elevation.upperBound ?? "?"}m` : "all elevations"} | Aspects: ${p.aspects?.join(", ") ?? "all"}`).join("\n")}

**Weather Forecast:**
${weatherForecast}

**Weather Review (past 24h):**
${weatherReview}

**Snowpack:**
${snowpackStructure}

**Outlook:**
${tendencyText}

## Task

Return ONLY a valid JSON object with this exact structure (no markdown, no extra text, no backticks):

{
  "date": "${issueDate}",
  "overallVerdict": "one of: GO | CAUTION | STAY ON PISTE | AVOID BACKCOUNTRY",
  "verdictColour": "one of: green | amber | red",
  "dangerLevel": "human-readable danger level e.g. 'Considerable (3+)'",
  "summary": "2-3 sentences for a recreational skier — what does today feel like on the mountain?",
  "onPiste": {
    "rating": "one of: Good | Acceptable | Poor | Closed",
    "notes": "1-2 sentences on piste conditions"
  },
  "offPiste": {
    "rating": "one of: Good | Acceptable | Risky | Avoid",
    "notes": "1-2 sentences on off-piste conditions"
  },
  "skiTouring": {
    "rating": "one of: Good | Acceptable | Expert Only | Avoid",
    "notes": "1-2 sentences on touring conditions"
  },
  "keyHazards": ["2-4 short hazard descriptions, e.g. 'Wind slabs on N/NE faces above 2400m'"],
  "bestBets": ["1-3 suggestions for where/what to ski today, e.g. 'Groomed blues below 1800m'"],
  "outlook": "1-2 sentences on tomorrow and the next day",
  "weather": {
    "summitTemp": "temperature at summit e.g. '−10°C'",
    "midTemp": "temperature at mid-mountain e.g. '−4°C'",
    "resortTemp": "temperature at resort level e.g. '0°C'",
    "freezingLevel": "freezing level e.g. '~1000m'",
    "wind": "wind description e.g. 'Storm NNW 80 km/h'",
    "visibility": "visibility e.g. 'Poor — heavy snowfall'",
    "newSnow24h": "new snow in past 24h e.g. '40–60 cm'",
    "baseDepth": "snowpack depth e.g. '200–240 cm (upper mountain)'"
  }
}

Verdict guidelines:

- GO (green): danger 1–2, settled weather, no serious hazards
- CAUTION (amber): danger 3, or danger 2 with a specific hazard worth noting
- STAY ON PISTE (amber/red): danger 3+ with complex snowpack or poor visibility
- AVOID BACKCOUNTRY (red): danger 4–5, or rapidly changing/unstable conditions`;

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
    const cleaned = content.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    return JSON.parse(cleaned);
  } catch {
    console.error("Failed to parse Claude response:", content.text);
    throw new Error("Claude response was not valid JSON");
  }
}
