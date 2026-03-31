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

const VERDICT: Record<string, { border: string; text: string; bg: string; label: string }> = {
  green: { border: "var(--safe)",   text: "var(--safe)",   bg: "rgba(45,74,62,0.06)",   label: "GO" },
  amber: { border: "var(--warn)",   text: "var(--warn)",   bg: "rgba(122,92,30,0.06)",  label: "CAUTION" },
  red:   { border: "var(--danger)", text: "var(--danger)", bg: "rgba(139,46,46,0.06)",  label: "AVOID" },
};

const mono: React.CSSProperties = { fontFamily: "var(--font-mono)", letterSpacing: "0.04em" };
const label: React.CSSProperties = { ...mono, fontSize: "10px", textTransform: "uppercase", color: "var(--ink-light)", marginBottom: "6px" };
const card: React.CSSProperties = { padding: "16px", border: "1px solid var(--ink-faint)", borderRadius: "2px", background: "rgba(245,240,232,0.7)" };

export function BulletinView({ bulletin }: { bulletin: Bulletin }) {
  const a = bulletin.summary as unknown as BulletinAnalysis;

  if (!a.overallVerdict) {
    return (
      <main style={{ padding: "40px", maxWidth: "700px", margin: "0 auto" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "32px", color: "var(--ink)" }}>Snowdesk</h1>
        <p style={{ color: "var(--ink-light)", marginTop: "12px" }}>Bulletin stored — summary pending.</p>
      </main>
    );
  }

  const v = VERDICT[a.verdictColour] ?? VERDICT.amber;

  return (
    <main style={{ padding: "clamp(20px, 5vw, 48px)", maxWidth: "780px", margin: "0 auto" }}>

      {/* Masthead */}
      <header style={{ marginBottom: "32px", paddingBottom: "20px", borderBottom: "1px solid var(--ink-faint)" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 700, color: "var(--alpine)", lineHeight: 1.1 }}>
          Snowdesk
        </h1>
        <p style={{ color: "var(--ink-mid)", fontSize: "14px", marginTop: "6px" }}>
          {bulletin.regionNames?.join(" · ")}
        </p>
        <p style={{ ...mono, color: "var(--ink-light)", fontSize: "11px", marginTop: "4px" }}>
          Issued {bulletin.issuedAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
          {bulletin.nextUpdate && (
            <> &nbsp;·&nbsp; Next update {bulletin.nextUpdate.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</>
          )}
        </p>
      </header>

      {/* Verdict banner */}
      <section style={{
        ...card,
        padding: "24px 28px",
        marginBottom: "24px",
        borderColor: v.border,
        borderWidth: "2px",
        background: v.bg,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "14px", marginBottom: "10px" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 700, color: v.text }}>
            {a.overallVerdict}
          </span>
          <span style={{ ...mono, fontSize: "12px", color: "var(--ink-mid)" }}>{a.dangerLevel}</span>
        </div>
        <p style={{ fontSize: "15px", lineHeight: "1.7", color: "var(--ink)" }}>{a.summary}</p>
      </section>

      {/* Activity ratings */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "24px" }}>
        {[
          { label: "On Piste",    data: a.onPiste },
          { label: "Off Piste",   data: a.offPiste },
          { label: "Ski Touring", data: a.skiTouring },
        ].map(({ label: lbl, data }) => (
          <div key={lbl} style={card}>
            <div style={label}>{lbl}</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "17px", fontWeight: 600, color: "var(--ink)", marginBottom: "8px" }}>
              {data.rating}
            </div>
            <div style={{ fontSize: "12px", color: "var(--ink-mid)", lineHeight: "1.6" }}>{data.notes}</div>
          </div>
        ))}
      </section>

      {/* Hazards + Best bets */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "24px" }}>
        <div style={{ ...card, borderColor: "var(--accent)" }}>
          <div style={{ ...label, color: "var(--accent)" }}>Key Hazards</div>
          <ul style={{ paddingLeft: "16px" }}>
            {a.keyHazards.map((h, i) => (
              <li key={i} style={{ fontSize: "13px", lineHeight: "1.7", color: "var(--ink-mid)", marginBottom: "2px" }}>{h}</li>
            ))}
          </ul>
        </div>
        <div style={{ ...card, borderColor: "var(--alpine)" }}>
          <div style={{ ...label, color: "var(--alpine)" }}>Best Bets</div>
          <ul style={{ paddingLeft: "16px" }}>
            {a.bestBets.map((b, i) => (
              <li key={i} style={{ fontSize: "13px", lineHeight: "1.7", color: "var(--ink-mid)", marginBottom: "2px" }}>{b}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Weather */}
      <section style={{ ...card, marginBottom: "24px" }}>
        <div style={label}>Weather</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "16px" }}>
          {[
            { lbl: "Summit",   val: a.weather.summitTemp },
            { lbl: "Mid",      val: a.weather.midTemp },
            { lbl: "Resort",   val: a.weather.resortTemp },
            { lbl: "Freezing", val: a.weather.freezingLevel },
          ].map(({ lbl, val }) => (
            <div key={lbl} style={{ textAlign: "center" }}>
              <div style={{ ...mono, fontSize: "9px", textTransform: "uppercase", color: "var(--ink-light)", marginBottom: "4px" }}>{lbl}</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 600, color: "var(--ink)" }}>{val}</div>
            </div>
          ))}
        </div>
        <div style={{ borderTop: "1px solid var(--ink-faint)", paddingTop: "12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          {[
            { lbl: "Wind",          val: a.weather.wind,       accent: true },
            { lbl: "Visibility",    val: a.weather.visibility,  accent: true },
            { lbl: "New snow (24h)", val: a.weather.newSnow24h, accent: false },
            { lbl: "Base depth",    val: a.weather.baseDepth,   accent: false },
          ].map(({ lbl, val, accent: isAccent }) => (
            <div key={lbl} style={{ fontSize: "13px" }}>
              <span style={{ ...mono, fontSize: "10px", color: "var(--ink-light)" }}>{lbl} </span>
              <span style={{ fontWeight: 500, color: isAccent ? "var(--accent)" : "var(--ink)" }}>{val}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Outlook */}
      <section style={{ ...card, borderLeft: "3px solid var(--alpine)", paddingLeft: "20px" }}>
        <div style={label}>Outlook</div>
        <p style={{ fontSize: "14px", lineHeight: "1.7", color: "var(--ink-mid)" }}>{a.outlook}</p>
      </section>

    </main>
  );
}
