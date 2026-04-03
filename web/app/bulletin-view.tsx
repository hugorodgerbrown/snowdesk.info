import Link from "next/link";
import type { Bulletin } from "../../generated/prisma/client";
import { toSlug } from "./slug";

interface AdjacentBulletin {
  bulletinId: string;
  issuedAt: Date;
}

interface BulletinAnalysis {
  date: string;
  validFrom: string;
  validTo: string;
  nextUpdate: string; // date of the next expected update
  overallVerdict: string;
  verdictColour: "green" | "amber" | "red";
  dangerLevel: string;
  summary: string;
  onPiste: { rating: string; notes: string };
  offPiste: { rating: string; notes: string };
  skiTouring: { rating: string; notes: string };
  keyHazards: string[]; //
  bestBets: string[];
  outlook: string;
  weather: {
    summitTemp: string;
    midTemp: string;
    resortTemp: string;
    freezingLevel: string;
    wind: string;
    visibility: string;
    newSnow24h: string;
    baseDepth: string;
  };
}

const VERDICT: Record<string, { border: string; text: string; bg: string; label: string }> = {
  green: { border: "var(--safe)", text: "var(--safe)", bg: "rgba(45,74,62,0.06)", label: "GO" },
  amber: {
    border: "var(--warn)",
    text: "var(--warn)",
    bg: "rgba(122,92,30,0.06)",
    label: "CAUTION",
  },
  red: {
    border: "var(--danger)",
    text: "var(--danger)",
    bg: "rgba(139,46,46,0.06)",
    label: "AVOID",
  },
};

const mono: React.CSSProperties = { fontFamily: "var(--font-mono)", letterSpacing: "0.04em" };
const fieldLabel: React.CSSProperties = {
  ...mono,
  fontSize: "10px",
  textTransform: "uppercase" as const,
  color: "var(--ink-light)",
  marginBottom: "6px",
};
const card: React.CSSProperties = {
  padding: "16px",
  border: "1px solid var(--ink-faint)",
  borderRadius: "2px",
  background: "rgba(245,240,232,0.7)",
};

export function BulletinView({
  bulletin,
  summary,
  activeZone,
  prevBulletin,
  nextBulletin,
}: {
  bulletin: Bulletin;
  summary: unknown;
  activeZone?: string;
  prevBulletin?: AdjacentBulletin | null;
  nextBulletin?: AdjacentBulletin | null;
}) {
  const a = summary as BulletinAnalysis;

  const regionNames = bulletin.regionNames ?? [];
  const activeRegionName = activeZone
    ? (regionNames.find((n) => toSlug(n) === activeZone) ?? regionNames[0])
    : regionNames[0];
  const otherRegions = regionNames.filter((n) => n !== activeRegionName);

  if (!a.overallVerdict) {
    return (
      <main style={{ padding: "40px", maxWidth: "700px", margin: "0 auto" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "32px", color: "var(--ink)" }}>
          Snowdesk
        </h1>
        <p style={{ color: "var(--ink-light)", marginTop: "12px" }}>
          Bulletin stored — summary pending.
        </p>
      </main>
    );
  }

  const v = VERDICT[a.verdictColour] ?? VERDICT.amber;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <main
        style={{
          flex: 1,
          padding: "clamp(20px, 5vw, 48px)",
          maxWidth: "780px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        {/* Masthead */}
        <header
          style={{
            marginBottom: "28px",
            paddingBottom: "18px",
            borderBottom: "2px solid var(--ink)",
          }}
        >
          {/* Top bar: wordmark + date */}
          <div
            className="masthead-bar"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: "10px",
            }}
          >
            <span
              style={{
                ...mono,
                fontSize: "11px",
                textTransform: "uppercase" as const,
                letterSpacing: "0.12em",
                color: "var(--alpine)",
                fontWeight: 500,
              }}
            >
              Snowdesk
            </span>
            <span style={{ ...mono, fontSize: "10px", color: "var(--ink-light)" }}>
              {bulletin.issuedAt.toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
              {bulletin.nextUpdate && (
                <>
                  {" "}
                  · next{" "}
                  {bulletin.nextUpdate.toLocaleString("en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </>
              )}
            </span>
          </div>

          {/* Region headline */}
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(26px, 5vw, 40px)",
              fontWeight: 700,
              color: "var(--ink)",
              lineHeight: 1.1,
              marginBottom: "6px",
            }}
          >
            {activeRegionName}
          </h1>

          {/* Tagline */}
          <p
            style={{
              ...mono,
              fontSize: "11px",
              color: "var(--ink-light)",
              textTransform: "uppercase" as const,
              letterSpacing: "0.06em",
            }}
          >
            Daily avalanche briefings · Swiss Alps
          </p>

          {/* Bulletin navigation */}
          {(prevBulletin || nextBulletin) && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "14px",
                paddingTop: "12px",
                borderTop: "1px solid var(--ink-faint)",
              }}
            >
              <span>
                {prevBulletin && (
                  <Link
                    href={`/${activeZone}?id=${prevBulletin.bulletinId}`}
                    style={{
                      ...mono,
                      fontSize: "11px",
                      color: "var(--ink-light)",
                      textDecoration: "none",
                    }}
                  >
                    ←{" "}
                    {prevBulletin.issuedAt.toLocaleString("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </Link>
                )}
              </span>
              <span>
                {nextBulletin && (
                  <Link
                    href={`/${activeZone}?id=${nextBulletin.bulletinId}`}
                    style={{
                      ...mono,
                      fontSize: "11px",
                      color: "var(--ink-light)",
                      textDecoration: "none",
                    }}
                  >
                    {nextBulletin.issuedAt.toLocaleString("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}{" "}
                    →
                  </Link>
                )}
              </span>
            </div>
          )}
        </header>

        {/* Verdict banner */}
        <section
          style={{
            ...card,
            padding: "24px 28px",
            marginBottom: "24px",
            borderColor: v.border,
            borderWidth: "2px",
            background: v.bg,
          }}
        >
          <div style={{ marginBottom: "10px" }}>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(18px, 3.5vw, 22px)",
                fontWeight: 700,
                color: v.text,
                marginBottom: "2px",
              }}
            >
              Avalanche Risk: {a.dangerLevel}
            </h2>
            <span
              style={{
                ...mono,
                fontSize: "11px",
                color: "var(--ink-light)",
                textTransform: "uppercase" as const,
                letterSpacing: "0.05em",
              }}
            >
              {a.overallVerdict}
            </span>
          </div>
          <p style={{ fontSize: "15px", lineHeight: "1.7", color: "var(--ink)" }}>{a.summary}</p>
        </section>

        {/* Outlook */}
        <section
          style={{
            ...card,
            borderLeft: "3px solid var(--alpine)",
            paddingLeft: "20px",
            marginBottom: "24px",
          }}
        >
          <div style={fieldLabel}>Outlook</div>
          <p style={{ fontSize: "14px", lineHeight: "1.7", color: "var(--ink-mid)" }}>
            {a.outlook}
          </p>
        </section>

        {/* Activity ratings */}
        <section className="grid-activities">
          {[
            { lbl: "On Piste", data: a.onPiste },
            { lbl: "Off Piste", data: a.offPiste },
            { lbl: "Ski Touring", data: a.skiTouring },
          ].map(({ lbl, data }) => (
            <div key={lbl} style={card}>
              <div style={fieldLabel}>{lbl}</div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "17px",
                  fontWeight: 600,
                  color: "var(--ink)",
                  marginBottom: "8px",
                }}
              >
                {data.rating}
              </div>
              <div style={{ fontSize: "12px", color: "var(--ink-mid)", lineHeight: "1.6" }}>
                {data.notes}
              </div>
            </div>
          ))}
        </section>

        {/* Key Hazards */}
        <section style={{ ...card, borderColor: "var(--accent)", marginBottom: "24px" }}>
          <div style={{ ...fieldLabel, color: "var(--accent)" }}>Key Hazards</div>
          <ul style={{ paddingLeft: "16px" }}>
            {a.keyHazards.map((h, i) => (
              <li
                key={i}
                style={{
                  fontSize: "13px",
                  lineHeight: "1.7",
                  color: "var(--ink-mid)",
                  marginBottom: "2px",
                }}
              >
                {h}
              </li>
            ))}
          </ul>
        </section>

        {/* Weather */}
        <section style={{ ...card, marginBottom: "24px" }}>
          <div style={fieldLabel}>Weather</div>
          <div className="grid-weather-temps">
            {[
              { lbl: "Summit", val: a.weather.summitTemp },
              { lbl: "Mid", val: a.weather.midTemp },
              { lbl: "Resort", val: a.weather.resortTemp },
              { lbl: "Freezing", val: a.weather.freezingLevel },
            ].map(({ lbl, val }) => (
              <div key={lbl} style={{ textAlign: "center" as const }}>
                <div
                  style={{
                    ...mono,
                    fontSize: "9px",
                    textTransform: "uppercase" as const,
                    color: "var(--ink-light)",
                    marginBottom: "4px",
                  }}
                >
                  {lbl}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "18px",
                    fontWeight: 600,
                    color: "var(--ink)",
                  }}
                >
                  {val}
                </div>
              </div>
            ))}
          </div>
          <div className="grid-weather-details">
            {[
              { lbl: "Wind", val: a.weather.wind, accent: true },
              { lbl: "Visibility", val: a.weather.visibility, accent: true },
              { lbl: "New snow (24h)", val: a.weather.newSnow24h, accent: false },
              { lbl: "Base depth", val: a.weather.baseDepth, accent: false },
            ].map(({ lbl, val, accent: isAccent }) => (
              <div key={lbl} style={{ fontSize: "13px" }}>
                <span style={{ ...mono, fontSize: "10px", color: "var(--ink-light)" }}>{lbl} </span>
                <span style={{ fontWeight: 500, color: isAccent ? "var(--accent)" : "var(--ink)" }}>
                  {val}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Related regions */}
      {otherRegions.length > 0 && (
        <div
          style={{
            maxWidth: "780px",
            margin: "0 auto",
            width: "100%",
            padding: "clamp(20px, 5vw, 48px)",
            paddingTop: "24px",
            paddingBottom: "0",
          }}
        >
          <p style={{ ...mono, fontSize: "10px", color: "var(--ink-light)" }}>
            <span style={{ textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>
              Also covers
            </span>{" "}
            {otherRegions.join(" · ")}
          </p>
        </div>
      )}

      {/* Footer */}
      <footer
        style={{
          maxWidth: "780px",
          margin: "0 auto",
          width: "100%",
          padding: "clamp(20px, 5vw, 48px)",
          paddingTop: "20px",
          paddingBottom: "32px",
          borderTop: "1px solid var(--ink-faint)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap" as const,
          gap: "8px",
        }}
      >
        <span style={{ ...mono, fontSize: "10px", color: "var(--ink-light)" }}>
          © {new Date().getFullYear()} Snowdesk
        </span>
        <span style={{ ...mono, fontSize: "10px", color: "var(--ink-light)" }}>
          Data: SLF/WSL Institute · aws.slf.ch
        </span>
      </footer>
    </div>
  );
}
