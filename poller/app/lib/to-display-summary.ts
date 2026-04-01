import type { BulletinAnalysis } from "./bulletin-schema";

const DANGER_LABELS: Record<string, string> = {
  low: "Low",
  moderate: "Moderate",
  considerable: "Considerable",
  high: "High",
  very_high: "Very High",
};

/**
 * Maps the structured BulletinAnalysis (new schema) to the flat shape
 * expected by bulletin-view.tsx (old schema).
 */
export function toDisplaySummary(a: BulletinAnalysis): Record<string, unknown> {
  return {
    date: a.date,
    overallVerdict: a.verdict.level.replace(/_/g, " "),
    verdictColour: a.verdict.colour,
    dangerLevel: `${DANGER_LABELS[a.danger.label] ?? a.danger.label} (${a.danger.level})`,
    summary: a.verdict.summary,

    onPiste: { rating: a.activities.onPiste.rating, notes: a.activities.onPiste.note },
    offPiste: { rating: a.activities.offPiste.rating, notes: a.activities.offPiste.note },
    skiTouring: { rating: a.activities.skiTouring.rating, notes: a.activities.skiTouring.note },

    keyHazards: a.snowpack.keyWeaknesses,
    bestBets: [],

    outlook: [a.outlook.nextDay, a.outlook.dayAfter].filter(Boolean).join(" "),

    weather: {
      summitTemp: "—",
      midTemp: a.weather.temperature2000m,
      resortTemp: "—",
      freezingLevel: a.weather.freezingLevel ?? "—",
      wind: a.weather.wind,
      visibility: "—",
      newSnow24h: a.weather.freshSnow,
      baseDepth: "—",
    },
  };
}
