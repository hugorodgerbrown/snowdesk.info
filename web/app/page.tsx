import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function Home() {
  const latestBulletin = await prisma.bulletin.findFirst({
    orderBy: { issuedAt: "desc" },
    include: { regions: true },
  });

  if (!latestBulletin) {
    return (
      <main style={{ padding: "20px" }}>
        <h1>Snowdesk</h1>
        <p>No avalanche bulletin data available yet.</p>
        <p style={{ fontSize: "14px", color: "#666" }}>
          Bulletins are fetched every 5 minutes from the SLF (Swiss Avalanche Authority).
        </p>
      </main>
    );
  }

  const summary = latestBulletin.summary as Record<string, unknown>;
  const keyProblems = (summary.keyProblems as Array<unknown>) || [];
  const regions = (summary.regions as Array<unknown>) || [];
  const mainDanger = summary.mainDanger as string;

  return (
    <main style={{ padding: "20px", maxWidth: "900px", margin: "0 auto" }}>
      <h1>Snowdesk</h1>

      <section style={{ marginBottom: "30px" }}>
        <h2 style={{ color: getDangerColor(mainDanger) }}>
          {summary.headline}
        </h2>
        <p style={{ fontSize: "16px", color: "#666", lineHeight: "1.6" }}>
          {summary.overview}
        </p>
        <small style={{ color: "#999" }}>
          Issued: {new Date(latestBulletin.issuedAt).toLocaleString()} |
          Valid until: {new Date(latestBulletin.validTo).toLocaleString()}
        </small>
      </section>

      <section style={{ marginBottom: "30px" }}>
        <h3>Danger Levels by Region</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "12px",
          }}
        >
          {regions.map((r) => {
            const reg = r as Record<string, unknown>;
            return (
              <div
                key={reg.name as string}
                style={{
                  padding: "12px",
                  backgroundColor: getDangerBgColor(
                    reg.dangerLevel as string
                  ),
                  borderRadius: "4px",
                  color:
                    ["high", "very_high"].includes(reg.dangerLevel as string)
                      ? "white"
                      : "black",
                  border:
                    "1px solid " +
                    getDangerBorderColor(reg.dangerLevel as string),
                }}
              >
                <strong>{reg.name}</strong>
                <div style={{ fontSize: "12px", marginTop: "4px" }}>
                  {formatDangerLevel(reg.dangerLevel as string)}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section style={{ marginBottom: "30px" }}>
        <h3>Avalanche Problems</h3>
        {keyProblems.length > 0 ? (
          <div>
            {keyProblems.map((p, i) => {
              const prob = p as Record<string, unknown>;
              return (
                <div
                  key={i}
                  style={{
                    padding: "12px",
                    marginBottom: "10px",
                    backgroundColor: "#fafafa",
                    borderLeft: "4px solid #ff9800",
                    borderRadius: "2px",
                  }}
                >
                  <strong style={{ textTransform: "capitalize" }}>
                    {String(prob.type).replace(/_/g, " ")}
                  </strong>
                  <p style={{ margin: "8px 0", fontSize: "14px" }}>
                    {prob.description}
                  </p>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#666",
                      display: "flex",
                      gap: "16px",
                    }}
                  >
                    {prob.elevation && (
                      <div>📍 {prob.elevation}</div>
                    )}
                    {prob.aspects && (
                      <div>🧭 {prob.aspects}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ color: "#999" }}>No major problems reported.</p>
        )}
      </section>

      <section style={{ marginBottom: "30px" }}>
        <h3>Travel Advice</h3>
        <div
          style={{
            padding: "12px",
            backgroundColor: "#e3f2fd",
            borderRadius: "4px",
            borderLeft: "4px solid #2196f3",
            whiteSpace: "pre-wrap",
            fontSize: "14px",
            lineHeight: "1.6",
          }}
        >
          {summary.travelAdvice}
        </div>
      </section>

      <details
        style={{
          marginTop: "40px",
          padding: "12px",
          backgroundColor: "#f9f9f9",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        <summary
          style={{ fontWeight: "bold", marginBottom: "10px", cursor: "pointer" }}
        >
          Raw Bulletin Data (GeoJSON)
        </summary>
        <pre
          style={{
            fontSize: "11px",
            overflow: "auto",
            marginTop: "10px",
            maxHeight: "400px",
            backgroundColor: "#fff",
            padding: "10px",
            borderRadius: "2px",
          }}
        >
          {JSON.stringify(latestBulletin.rawData, null, 2)}
        </pre>
      </details>
    </main>
  );
}

function getDangerColor(level: string): string {
  const colors: Record<string, string> = {
    low: "#4caf50",
    moderate: "#ffc107",
    considerable: "#ff9800",
    high: "#f44336",
    very_high: "#7d1414",
  };
  return colors[level] || "#999";
}

function getDangerBgColor(level: string): string {
  const colors: Record<string, string> = {
    low: "#c8e6c9",
    moderate: "#fff9c4",
    considerable: "#ffe0b2",
    high: "#ffcdd2",
    very_high: "#ffebee",
  };
  return colors[level] || "#eeeeee";
}

function getDangerBorderColor(level: string): string {
  const colors: Record<string, string> = {
    low: "#4caf50",
    moderate: "#fbc02d",
    considerable: "#fb8c00",
    high: "#d32f2f",
    very_high: "#c62828",
  };
  return colors[level] || "#999";
}

function formatDangerLevel(level: string): string {
  const formatted: Record<string, string> = {
    low: "🟢 Low",
    moderate: "🟡 Moderate",
    considerable: "🟠 Considerable",
    high: "🔴 High",
    very_high: "🔴 Very High",
  };
  return formatted[level] || level;
}
