// lib/analyse-bulletin.ts
//
// Sends an SLF bulletin to Claude for analysis and returns a validated
// BulletinAnalysis object. Retries once on parse/validation failure.
//
// Usage:
//   import { analyseBulletin } from "@/lib/analyse-bulletin";
//   const analysis = await analyseBulletin(feature, "CH-4116");

import Anthropic from "@anthropic-ai/sdk";
import {
  BULLETIN_SYSTEM_PROMPT,
  BULLETIN_MODEL,
  BULLETIN_MAX_TOKENS,
} from "./bulletin-constants";
import { buildBulletinPrompt, type SLFBulletinFeature } from "./bulletin-prompt";
import { BulletinAnalysisSchema, type BulletinAnalysis } from "./bulletin-schema";

// ---------------------------------------------------------------------------
// Client — initialised once, reused across calls.
// Reads ANTHROPIC_API_KEY from env automatically.
// ---------------------------------------------------------------------------

const anthropic = new Anthropic();

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

export class BulletinAnalysisError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "BulletinAnalysisError";
  }
}

/**
 * Analyse an SLF bulletin feature for a specific region.
 *
 * @param feature  - Raw SLF GeoJSON feature
 * @param regionId - Target region, e.g. "CH-4116"
 * @param retries  - Retry count on parse/validation failure (default 1)
 * @returns          Validated BulletinAnalysis
 */
export async function analyseBulletin(
  feature: SLFBulletinFeature,
  regionId: string,
  retries = 1,
): Promise<BulletinAnalysis> {
  const userPrompt = buildBulletinPrompt(feature, regionId);

  for (let attempt = 0; attempt <= retries; attempt++) {
    const raw = await callClaude(userPrompt);
    const result = parseAndValidate(raw);

    if (result.success) {
      return result.data;
    }

    // Log the failure but retry if we have attempts left
    console.warn(
      `[analyse-bulletin] Attempt ${attempt + 1} failed: ${result.error}`,
    );

    if (attempt === retries) {
      throw new BulletinAnalysisError(
        `Failed to parse bulletin analysis after ${retries + 1} attempts`,
        result.error,
      );
    }
  }

  // Unreachable, but TypeScript needs it
  throw new BulletinAnalysisError("Unexpected state");
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

async function callClaude(userPrompt: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: BULLETIN_MODEL,
    max_tokens: BULLETIN_MAX_TOKENS,
    system: BULLETIN_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new BulletinAnalysisError(
      "Claude response contained no text block",
    );
  }

  return textBlock.text;
}

function parseAndValidate(raw: string):
  | { success: true; data: BulletinAnalysis }
  | { success: false; error: string } {
  // Strip markdown fences if the model included them despite instructions
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return {
      success: false,
      error: `JSON parse failed. First 200 chars: ${cleaned.slice(0, 200)}`,
    };
  }

  const result = BulletinAnalysisSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return { success: false, error: `Zod validation failed: ${issues}` };
  }

  return { success: true, data: result.data };
}
