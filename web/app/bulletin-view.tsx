import type { Bulletin } from "../../generated/prisma/client";

interface BulletinAnalysis {
  date: string;
  overallVerdict: string;
  verdictColour: "green" | "amber" | "red";
  dangerLevel: string;
  summary: string;
  onPiste: { rating: string; notes: string };
  offPiste: { rating: string; notes: string };
  skiTouring: { rating: string; notes: string };
  keyHazards: string[];
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

const VERDICT_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  green: { bg: "#f0fdf4", border: "#16a34a", text: "#15803d" },
  amber: { bg: "#fffbeb", border: "#d97706", text: "#b45309" },
  red:   { bg: "#fef2f2", border: "#dc2626", text: "#b91c1c" },
};

export function BulletinView({ bulletin }: { bulletin: Bulletin }) {
  const a = bulletin.summary as unknown as BulletinAnalysis;

  if (!a.overallVerdict) {
    return (
      <main style={{ padding: "40px", maxWidth: "700px", margin: "0 auto", fontFamily: "sans-serif" }}>
        <h1 style={{ fontSize: "28px", marginBottom: "8px" }}>Snowdesk</h1>
        <p style={{ color: "#666" }}>Bulletin stored — summary pending.</p>
      </main>
    );
  }

  const verdictStyle = VERDICT_STYLES[a.verdictColour] ?? VERDICT_STYLES.amber;

  return (
    <main style={{ padding: "24px", maxWidth: "760px", margin: "0 auto", fontFamily: "sans-serif", color: "#1a1a1a" }}>

      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, margin: 0 }}>Snowdesk</h1>
        <p style={{ color: "#888", fontSize: "13px", margin: "4px 0 0" }}>
          {a.date} · {bulletin.regionNames?.join(", ")}
        </p>
        <p style={{ color: "#aaa", fontSize: "12px", margin: "2px 0 0" }}>
          Issued {bulletin.issuedAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
          {bulletin.nextUpdate && (
            <> · Next update {bulletin.nextUpdate.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</>
          )}
        </p>
      </div>

      {/* Verdict banner */}
      <div style={{
        padding: "20px 24px",
        marginBottom: "20px",
        backgroundColor: verdictStyle.bg,
        border: `2px solid ${verdictStyle.border}`,
        borderRadius: "8px",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "8px" }}>
          <span style={{ fontSize: "22px", fontWeight: 700, color: verdictStyle.text }}>
            {a.overallVerdict}
          </span>
          <span style={{ fontSize: "14px", color: "#555" }}>{a.dangerLevel}</span>
        </div>
        <p style={{ margin: 0, fontSize: "15px", lineHeight: "1.6", color: "#333" }}>{a.summary}</p>
      </div>

      {/* Activity ratings */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "20px" }}>
        {[
          { label: "On Piste", data: a.onPiste },
          { label: "Off Piste", data: a.offPiste },
          { label: "Ski Touring", data: a.skiTouring },
        ].map(({ label, data }) => (
          <div key={label} style={{
            padding: "14px",
            backgroundColor: "#f9f9f9",
            border: "1px solid #e5e5e5",
            borderRadius: "6px",
          }}>
            <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#888", marginBottom: "4px" }}>{label}</div>
            <div style={{ fontSize: "15px", fontWeight: 600, marginBottom: "6px" }}>{data.rating}</div>
            <div style={{ fontSize: "12px", color: "#555", lineHeight: "1.5" }}>{data.notes}</div>
          </div>
        ))}
      </div>

      {/* Key hazards + Best bets */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
        <div style={{ padding: "16px", backgroundColor: "#fff8f0", border: "1px solid #f0ad4e", borderRadius: "6px" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#b45309", marginBottom: "10px" }}>
            Key Hazards
          </div>
          <ul style={{ margin: 0, padding: "0 0 0 16px" }}>
            {a.keyHazards.map((h, i) => (
              <li key={i} style={{ fontSize: "13px", lineHeight: "1.6", marginBottom: "4px" }}>{h}</li>
            ))}
          </ul>
        </div>
        <div style={{ padding: "16px", backgroundColor: "#f0fdf4", border: "1px solid #86efac", borderRadius: "6px" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#15803d", marginBottom: "10px" }}>
            Best Bets
          </div>
          <ul style={{ margin: 0, padding: "0 0 0 16px" }}>
            {a.bestBets.map((b, i) => (
              <li key={i} style={{ fontSize: "13px", lineHeight: "1.6", marginBottom: "4px" }}>{b}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Weather */}
      <div style={{ marginBottom: "20px", padding: "16px", backgroundColor: "#f5f8ff", border: "1px solid #c7d7f9", borderRadius: "6px" }}>
        <div style={{ fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#3b5bdb", marginBottom: "12px" }}>
          Weather
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
          {[
            { label: "Summit", value: a.weather.summitTemp },
            { label: "Mid", value: a.weather.midTemp },
            { label: "Resort", value: a.weather.resortTemp },
            { label: "Freezing", value: a.weather.freezingLevel },
          ].map(({ label, value }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "11px", color: "#888", marginBottom: "2px" }}>{label}</div>
              <div style={{ fontSize: "15px", fontWeight: 600 }}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
          {[
            { label: "Wind", value: a.weather.wind },
            { label: "Visibility", value: a.weather.visibility },
            { label: "New snow (24h)", value: a.weather.newSnow24h },
            { label: "Base depth", value: a.weather.baseDepth },
          ].map(({ label, value }) => (
            <div key={label} style={{ fontSize: "13px" }}>
              <span style={{ color: "#888" }}>{label}: </span>
              <span style={{ fontWeight: 500 }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Outlook */}
      <div style={{ padding: "14px 16px", backgroundColor: "#fafafa", border: "1px solid #e5e5e5", borderRadius: "6px", fontSize: "14px", lineHeight: "1.6", color: "#444" }}>
        <span style={{ fontWeight: 600, color: "#1a1a1a" }}>Outlook: </span>{a.outlook}
      </div>

    </main>
  );
}
