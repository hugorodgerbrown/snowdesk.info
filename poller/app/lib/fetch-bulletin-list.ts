// lib/fetch-bulletin-list.ts
//
// Fetches a page of historical bulletins from the SLF bulletin-list API.
// Returns individual zone-level bulletins (CAAMLv6 JSON format) normalised
// from whatever wrapper structure the API returns.
//
// Note: CAAMLBulletin fields are flat (no `properties` wrapper). Callers that
// need to store rawData compatible with analyseBulletin must wrap them first:
//   { type: "Feature", geometry: null, properties: bulletin }
//
// Usage:
//   import { fetchBulletinList } from "@/lib/fetch-bulletin-list";
//   const bulletins = await fetchBulletinList("en", 10, 0);

const LIST_BASE_URL = "https://aws.slf.ch/api/bulletin-list/caaml";

// ---------------------------------------------------------------------------
// Types — CAAMLv6 bulletin as returned by the list API (fields are direct,
// not nested under a GeoJSON `properties` wrapper like the document API).
// ---------------------------------------------------------------------------

export interface CAAMLBulletin {
  bulletinID: string;
  lang: string;
  publicationTime: string;
  validTime: { startTime: string; endTime: string };
  nextUpdate?: string;
  unscheduled: boolean;
  regions: Array<{ regionID: string; name: string }>;
  dangerRatings: unknown[];
  avalancheProblems: unknown[];
  weatherForecast?: { comment: string };
  weatherReview?: { comment: string };
  snowpackStructure?: { comment: string };
  tendency?: Array<{ comment: string }>;
  customData?: unknown;
}

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

/**
 * Fetch one page of bulletins from the SLF bulletin-list API.
 *
 * @param lang   - Language code: "en" | "de" | "fr" | "it"
 * @param limit  - Max bulletins to return (the API default is 10)
 * @param offset - Number of bulletins to skip
 * @returns        Flat array of zone-level CAAMLv6 bulletin objects
 */
export async function fetchBulletinList(
  lang: string,
  limit: number,
  offset: number,
): Promise<CAAMLBulletin[]> {
  const url = `${LIST_BASE_URL}/${lang}/json?limit=${limit}&offset=${offset}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`SLF list API returned ${res.status}${body ? `: ${body}` : ""}`);
  }

  const data: unknown = await res.json();
  return normaliseBulletins(data);
}

// ---------------------------------------------------------------------------
// Response normalisation
//
// The API may return one of three shapes depending on the limit:
//   1. CAAMLBulletin[]                        — flat array of bulletins
//   2. { bulletins: CAAMLBulletin[] }         — single collection object
//   3. Array<{ bulletins: CAAMLBulletin[] }>  — array of collection objects
// ---------------------------------------------------------------------------

function normaliseBulletins(data: unknown): CAAMLBulletin[] {
  if (!data) return [];

  if (Array.isArray(data)) {
    if (data.length === 0) return [];

    const first = data[0];
    if (first && typeof first === "object" && "bulletins" in first) {
      // Shape 3: array of collections
      return (data as Array<{ bulletins?: CAAMLBulletin[] }>).flatMap((c) => c.bulletins ?? []);
    }

    // Shape 1: flat array of bulletins
    return data as CAAMLBulletin[];
  }

  if (typeof data === "object" && "bulletins" in data) {
    // Shape 2: single collection object
    return (data as { bulletins?: CAAMLBulletin[] }).bulletins ?? [];
  }

  return [];
}
