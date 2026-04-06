// web/app/validity-window.tsx
//
// Displays a visual timeline showing the bulletin's validity window.
// Evening bulletins run 16:00–16:00 (24h), morning bulletins 07:00–16:00 (9h).
// Shows elapsed progress when the bulletin is currently active.

import type { Bulletin } from "../../generated/prisma/client";

const mono: React.CSSProperties = { fontFamily: "var(--font-mono)", letterSpacing: "0.04em" };

function formatTime(date: Date): string {
  return date.toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatShortDate(date: Date): string {
  return date.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function getBulletinType(validFrom: Date, validTo: Date): { label: string; duration: string } {
  const hours = Math.round((validTo.getTime() - validFrom.getTime()) / (1000 * 60 * 60));
  if (hours >= 20) {
    return { label: "Evening Bulletin", duration: `${hours}h` };
  }
  return { label: "Morning Update", duration: `${hours}h` };
}

type Status = "active" | "expired" | "upcoming";

function getStatus(validFrom: Date, validTo: Date, now: Date): Status {
  if (now < validFrom) return "upcoming";
  if (now > validTo) return "expired";
  return "active";
}

function getProgress(validFrom: Date, validTo: Date, now: Date): number {
  const total = validTo.getTime() - validFrom.getTime();
  if (total <= 0) return 0;
  const elapsed = now.getTime() - validFrom.getTime();
  return Math.max(0, Math.min(1, elapsed / total));
}

const STATUS_STYLES: Record<Status, { color: string; bg: string; label: string }> = {
  active: { color: "var(--safe)", bg: "rgba(45,74,62,0.12)", label: "LIVE" },
  expired: { color: "var(--ink-light)", bg: "rgba(138,125,110,0.10)", label: "EXPIRED" },
  upcoming: { color: "var(--accent)", bg: "rgba(196,114,42,0.10)", label: "UPCOMING" },
};

export function ValidityWindow({ bulletin }: { bulletin: Bulletin }) {
  const { validFrom, validTo } = bulletin;
  const now = new Date();
  const status = getStatus(validFrom, validTo, now);
  const progress = getProgress(validFrom, validTo, now);
  const { label: typeLabel, duration } = getBulletinType(validFrom, validTo);
  const s = STATUS_STYLES[status];

  const sameDay = validFrom.toLocaleDateString("en-GB") === validTo.toLocaleDateString("en-GB");

  return (
    <div
      style={{
        padding: "12px 16px",
        border: "1px solid var(--ink-faint)",
        borderRadius: "2px",
        background: "rgba(245,240,232,0.7)",
        marginBottom: "20px",
      }}
    >
      {/* Header row: bulletin type + status badge */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "8px",
        }}
      >
        <span
          style={{
            ...mono,
            fontSize: "10px",
            textTransform: "uppercase",
            color: "var(--ink-light)",
            letterSpacing: "0.06em",
          }}
        >
          {typeLabel} · {duration}
        </span>
        <span
          style={{
            ...mono,
            fontSize: "9px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: s.color,
            background: s.bg,
            padding: "2px 8px",
            borderRadius: "2px",
          }}
        >
          {s.label}
        </span>
      </div>

      {/* Timeline bar */}
      <div
        style={{
          position: "relative",
          height: "6px",
          background: "var(--ink-faint)",
          borderRadius: "3px",
          overflow: "hidden",
          marginBottom: "6px",
        }}
      >
        {/* Elapsed fill */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            width: status === "expired" ? "100%" : `${(progress * 100).toFixed(1)}%`,
            background:
              status === "active"
                ? "var(--alpine)"
                : status === "expired"
                  ? "var(--ink-light)"
                  : "transparent",
            borderRadius: "3px",
            transition: "width 0.3s ease",
          }}
        />
        {/* Now marker (only when active) */}
        {status === "active" && (
          <div
            style={{
              position: "absolute",
              top: "-2px",
              left: `${(progress * 100).toFixed(1)}%`,
              width: "2px",
              height: "10px",
              background: "var(--alpine)",
              borderRadius: "1px",
              transform: "translateX(-1px)",
            }}
          />
        )}
      </div>

      {/* Time labels */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <span style={{ ...mono, fontSize: "10px", color: "var(--ink-mid)" }}>
          {formatTime(validFrom)}
          {!sameDay && (
            <span style={{ color: "var(--ink-light)", marginLeft: "4px" }}>
              {formatShortDate(validFrom)}
            </span>
          )}
        </span>
        <span style={{ ...mono, fontSize: "10px", color: "var(--ink-mid)" }}>
          {formatTime(validTo)}
          <span style={{ color: "var(--ink-light)", marginLeft: "4px" }}>
            {formatShortDate(validTo)}
          </span>
        </span>
      </div>
    </div>
  );
}
