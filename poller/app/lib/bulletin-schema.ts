// lib/bulletin-schema.ts
//
// Zod schema for validating Claude's BulletinAnalysis JSON response.
// Also exports the inferred TypeScript type.

import { z } from "zod";

const ActivityRatingSchema = z.object({
  rating: z.enum(["good", "fair", "poor"]),
  note: z.string(),
});

export const BulletinAnalysisSchema = z.object({
  date: z.string(),             // ISO date
  validUntil: z.string(),       // ISO datetime
  bulletinID: z.string(),
  region: z.object({
    id: z.string(),
    name: z.string(),
  }),
  danger: z.object({
    level: z.number().int().min(1).max(5),
    label: z.enum(["low", "moderate", "considerable", "high", "very_high"]),
    trend: z.enum(["increasing", "steady", "decreasing"]),
  }),
  verdict: z.object({
    level: z.enum(["GO", "CAUTION", "STAY_ON_PISTE", "AVOID_BACKCOUNTRY"]),
    colour: z.enum(["green", "amber", "red"]),
    summary: z.string(),
  }),
  problems: z.array(
    z.object({
      type: z.string(),
      aspects: z.array(z.string()),
      elevationMin: z.number().nullable(),
      elevationMax: z.number().nullable(),
      description: z.string(),
    })
  ),
  weather: z.object({
    past24h: z.string(),
    forecast: z.string(),
    freshSnow: z.string(),
    temperature2000m: z.string(),
    wind: z.string(),
    freezingLevel: z.string().nullable(),
  }),
  snowpack: z.object({
    summary: z.string(),
    keyWeaknesses: z.array(z.string()).max(4),
  }),
  activities: z.object({
    onPiste: ActivityRatingSchema,
    offPiste: ActivityRatingSchema,
    skiTouring: ActivityRatingSchema,
  }),
  outlook: z.object({
    nextDay: z.string(),
    dayAfter: z.string(),
    trend: z.enum(["improving", "stable", "deteriorating"]),
  }),
});

export type BulletinAnalysis = z.infer<typeof BulletinAnalysisSchema>;
