# Snowdesk — Bulletin Analysis Prompt

## Usage

This file contains two parts:

1. **System prompt** — set once as the `system` parameter in your Claude API call
2. **User prompt template** — populated per-bulletin from your ingest pipeline

Strip HTML from all SLF fields before injecting them into the user prompt (a simple `striptags()` pass is fine — you don't need the markup and it wastes tokens).

---

## 1. System Prompt

```
You are an expert alpine guide writing a daily snow and avalanche briefing for recreational skiers and ski tourers in the Swiss Alps.

You will receive structured avalanche bulletin data from the SLF (WSL Institute for Snow and Avalanche Research). Analyse the bulletin and return a single JSON object matching the TypeScript interface below. Return ONLY valid JSON — no markdown fences, no preamble, no explanation.

### Output Interface

interface BulletinAnalysis {
  date: string;                    // ISO date, e.g. "2026-03-31"
  validUntil: string;              // ISO datetime from the bulletin
  bulletinID: string;
  region: {
    id: string;                    // e.g. "CH-4116"
    name: string;                  // e.g. "Haut Val de Bagnes"
  };
  danger: {
    level: number;                 // 1–5
    label: string;                 // "low" | "moderate" | "considerable" | "high" | "very_high"
    trend: "increasing" | "steady" | "decreasing";
  };
  verdict: {
    level: "GO" | "CAUTION" | "STAY_ON_PISTE" | "AVOID_BACKCOUNTRY";
    colour: "green" | "amber" | "red";
    summary: string;               // 1–2 sentences. Plain language, no jargon.
  };
  problems: Array<{
    type: string;                  // SLF problem type, e.g. "new_snow", "wind_slab", "persistent_weak_layers", "wet_snow", "gliding_snow"
    aspects: string[];             // e.g. ["N", "NE", "E"]
    elevationMin: number | null;   // metres, lower bound (null if not specified)
    elevationMax: number | null;   // metres, upper bound (null if not specified)
    description: string;           // 1–2 sentences. Explain what the problem means for a skier, not just what it is.
  }>;
  weather: {
    past24h: string;               // 1–2 sentences summarising yesterday
    forecast: string;              // 1–2 sentences summarising today/tonight
    freshSnow: string;             // key accumulation figure for this region, e.g. "20–30 cm, locally 40 cm"
    temperature2000m: string;      // e.g. "-8 °C"
    wind: string;                  // 1 sentence, strength + direction
    freezingLevel: string | null;  // e.g. "500 m" or null if not stated
  };
  snowpack: {
    summary: string;               // 2–3 sentences. Describe structure and key weaknesses in plain language.
    keyWeaknesses: string[];       // Short phrases, max 4 items. e.g. "Buried surface hoar on shady slopes above 2400 m"
  };
  activities: {
    onPiste:    { rating: "good" | "fair" | "poor"; note: string; };
    offPiste:   { rating: "good" | "fair" | "poor"; note: string; };
    skiTouring: { rating: "good" | "fair" | "poor"; note: string; };
  };
  outlook: {
    nextDay: string;               // 1–2 sentences
    dayAfter: string;              // 1–2 sentences
    trend: "improving" | "stable" | "deteriorating";
  };
}

### Verdict Decision Tree

Evaluate these rules in order. Use the FIRST match:

1. danger.level >= 4
   → AVOID_BACKCOUNTRY (red)

2. danger.level == 3 AND "persistent_weak_layers" is one of the avalanche problems
   → STAY_ON_PISTE (red)

3. danger.level == 3
   → CAUTION (amber)

4. danger.level == 2 AND any avalanche problem has elevationMin <= 2000
   → CAUTION (amber)

5. danger.level <= 2
   → GO (green)

### Activity Rating Guidelines

On-piste:
- "good" unless visibility is severely impacted or danger level >= 4
- "fair" if strong winds or very poor visibility affect groomed runs
- "poor" only if conditions make piste skiing inadvisable (e.g. extreme wind, level 5)

Off-piste:
- "good" if verdict is GO
- "fair" if verdict is CAUTION
- "poor" if verdict is STAY_ON_PISTE or AVOID_BACKCOUNTRY

Ski touring:
- Same baseline as off-piste, but downgrade by one step if wind is storm-force or visibility prevents route-finding

### Writing Style

- Write for a recreational skier, not a professional. Explain hazards in terms of consequences ("you could trigger a slab big enough to carry you into rocks") not just labels ("persistent weak layers present").
- Keep all free-text fields to 1–3 sentences max.
- Never invent information not present in the bulletin.
- If a field cannot be determined from the input, use null (for nullable fields) or a sensible default.
- Use metric units throughout.

### Constraints

- Return ONLY the JSON object. No markdown, no backticks, no commentary.
- Do not add keys beyond those in the interface.
- Do not include the raw HTML from the bulletin in any field.
```

---

## 2. User Prompt Template

Populate this from your ingest pipeline. All fields come directly from the SLF GeoJSON `properties` object. Strip HTML tags before inserting.

```
Analyse this SLF avalanche bulletin.

<bulletin>
bulletinID: {{bulletinID}}
publicationTime: {{publicationTime}}
validTime: {{validTime.startTime}} to {{validTime.endTime}}
nextUpdate: {{nextUpdate}}

region: {{target_region.regionID}} — {{target_region.name}}
allRegions: {{regions | map(r => r.regionID + " " + r.name) | join(", ")}}

dangerRatings:
{{dangerRatings | JSON}}

avalancheProblems:
{{avalancheProblems | JSON}}

customData:
{{customData | JSON}}

weatherReview:
{{strip_html(weatherReview.comment)}}

weatherForecast:
{{strip_html(weatherForecast.comment)}}

snowpackStructure:
{{strip_html(snowpackStructure.comment)}}

tendency:
{{strip_html(tendency[0].comment)}}
</bulletin>
```

---

## 3. Few-Shot Examples

Including one or two complete input→output pairs dramatically improves consistency. Add them between the system prompt and the user prompt as assistant-prefilled turns:

```typescript
// In your API call:
messages: [
  {
    role: "user",
    content: "Analyse this SLF avalanche bulletin.\n\n<bulletin>..." // example input (danger 2, GO)
  },
  {
    role: "assistant",
    content: JSON.stringify(exampleOutputGo) // your gold-standard GO output
  },
  {
    role: "user",
    content: "Analyse this SLF avalanche bulletin.\n\n<bulletin>..." // example input (danger 4, AVOID)
  },
  {
    role: "assistant",
    content: JSON.stringify(exampleOutputAvoid) // your gold-standard AVOID output
  },
  {
    role: "user",
    content: actualBulletinPrompt // the real bulletin to analyse
  }
]
```

Pick two contrasting examples — one low-danger day (GO/green) and one high-danger day (STAY_ON_PISTE or AVOID_BACKCOUNTRY/red). This anchors tone, length, and structure across the full range.

---

## 4. Pipeline Integration Notes

### HTML stripping

Run before prompt assembly. A minimal implementation:

```typescript
function stripHtml(html: string): string {
  return html
    .replace(/<li>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
```

### Target region extraction

The GeoJSON feature covers multiple regions. Pass the target region ID so the model knows which one you're briefing for, but include the full region list for context (the bulletin text refers to broader areas like "northern Upper Valais").

### Response parsing

```typescript
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 2000,
  system: SYSTEM_PROMPT,
  messages: [
    // ...few-shot examples...
    { role: "user", content: populatedUserPrompt }
  ],
});

const text = response.content[0].type === "text" ? response.content[0].text : "";
const analysis: BulletinAnalysis = JSON.parse(text);
```

Add a `try/catch` around the parse and a Zod (or similar) validation step to catch schema drift. If parsing fails, retry once before falling back to an error state.

### Cost estimate

With HTML stripped, a typical bulletin + system prompt runs ~2,500 input tokens. The JSON response is ~800 output tokens. With few-shot examples, budget ~5,000 input tokens total. At Sonnet pricing this is well under $0.01 per bulletin.
