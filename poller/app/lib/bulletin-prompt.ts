// lib/bulletin-prompt.ts
//
// Builds the user-turn prompt for the Claude API call that analyses
// an SLF avalanche bulletin into a BulletinAnalysis object.
//
// Usage:
//   import { buildBulletinPrompt } from "@/lib/bulletin-prompt";
//   const userPrompt = buildBulletinPrompt(feature, "CH-4116");

// ---------------------------------------------------------------------------
// 1. SLF GeoJSON types (CAAMLv6 subset — only what we need)
// ---------------------------------------------------------------------------

export interface SLFRegion {
  regionID: string;
  name: string;
}

export interface SLFDangerRating {
  mainValue: string;
  validTimePeriod: string;
  customData?: {
    CH?: { subdivision?: string };
  };
}

export interface SLFAvalancheProblem {
  problemType: string;
  aspects: string[];
  elevation: {
    lowerBound?: string;
    upperBound?: string;
  };
  dangerRatingValue: string;
  validTimePeriod: string;
  comment: string;
  customData?: {
    CH?: { subdivision?: string; coreZoneText?: string };
  };
}

export interface SLFBulletinProperties {
  bulletinID: string;
  publicationTime: string;
  validTime: { startTime: string; endTime: string };
  nextUpdate: string;
  lang: string;
  fill: string;
  unscheduled: boolean;
  regions: SLFRegion[];
  dangerRatings: SLFDangerRating[];
  avalancheProblems: SLFAvalancheProblem[];
  customData: {
    CH?: {
      aggregation?: Array<{
        category: string;
        problemTypes: string[];
        validTimePeriod: string;
      }>;
    };
  };
  weatherReview: { comment: string };
  weatherForecast: { comment: string };
  snowpackStructure: { comment: string };
  tendency: Array<{ comment: string }>;
}

export interface SLFBulletinFeature {
  id: number;
  type: "Feature";
  geometry: unknown;
  properties: SLFBulletinProperties;
}

// ---------------------------------------------------------------------------
// 2. HTML stripping
// ---------------------------------------------------------------------------

/**
 * Converts SLF bulletin HTML to readable plain text.
 * Preserves list structure as dash-prefixed lines and collapses whitespace.
 */
export function stripHtml(html: string): string {
  return (
    html
      // Block-level elements → newlines before stripping tags
      .replace(/<\/h[1-6]>/gi, "\n\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/ul>/gi, "\n")
      .replace(/<li>/gi, "- ")
      .replace(/<\/li>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      // Strip remaining tags
      .replace(/<[^>]+>/g, "")
      // Decode HTML entities
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&nbsp;/g, " ")
      // Collapse whitespace
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

// ---------------------------------------------------------------------------
// 3. Prompt builder
// ---------------------------------------------------------------------------

/**
 * Builds the user-turn content for the bulletin analysis API call.
 *
 * @param feature  - A single Feature from the SLF GeoJSON response
 * @param regionId - The target region to brief for, e.g. "CH-4116"
 * @returns          The assembled prompt string
 * @throws           If regionId is not found in the bulletin's region list
 */
export function buildBulletinPrompt(feature: SLFBulletinFeature, regionId: string): string {
  const p = feature.properties;

  // Resolve target region
  const targetRegion = p.regions.find((r) => r.regionID === regionId);
  if (!targetRegion) {
    throw new Error(
      `Region ${regionId} not found in bulletin ${p.bulletinID}. ` +
        `Available: ${p.regions.map((r) => r.regionID).join(", ")}`,
    );
  }

  // Format region list (compact, one line)
  const regionList = p.regions.map((r) => `${r.regionID} ${r.name}`).join(", ");

  // Build the prompt
  return `Analyse this SLF avalanche bulletin.

<bulletin>
bulletinID: ${p.bulletinID}
publicationTime: ${p.publicationTime}
validTime: ${p.validTime.startTime} to ${p.validTime.endTime}
nextUpdate: ${p.nextUpdate}

region: ${targetRegion.regionID} — ${targetRegion.name}
allRegions: ${regionList}

dangerRatings:
${JSON.stringify(p.dangerRatings, null, 2)}

avalancheProblems:
${JSON.stringify(p.avalancheProblems, null, 2)}

customData:
${JSON.stringify(p.customData, null, 2)}

weatherReview:
${stripHtml(p.weatherReview.comment)}

weatherForecast:
${stripHtml(p.weatherForecast.comment)}

snowpackStructure:
${stripHtml(p.snowpackStructure.comment)}

tendency:
${p.tendency.map((t) => stripHtml(t.comment)).join("\n\n")}
</bulletin>`;
}
