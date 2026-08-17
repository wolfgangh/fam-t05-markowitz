const MINUS = "\u2212";

const eur0 = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

const pct2 = new Intl.NumberFormat("de-DE", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function withMinus(text: string): string {
  return text.replace(/-/g, MINUS);
}

export function formatEuro(value: number): string {
  if (!Number.isFinite(value)) return `${MINUS} €`;
  return withMinus(eur0.format(value));
}

/** ratio (0.50 = 50 %) → de-DE two decimals with % */
export function formatPct(ratio: number): string {
  if (!Number.isFinite(ratio)) return `${MINUS} %`;
  return withMinus(pct2.format(ratio));
}

/** Classroom display snap. Used only on formatted teaching-point outputs. */
export const DISPLAY_SNAP_TOL = 0.002;
export const CRISIS_RHO_DISPLAY_TOL = 0.005;
export const KIPP_W_DISPLAY_TOL = 0.005;
export const KIPP_MUX_DISPLAY_TOL = 1e-4;

export function snapDisplay(raw: number, canon: number, tol = DISPLAY_SNAP_TOL): number {
  if (!Number.isFinite(raw) || !Number.isFinite(canon)) return raw;
  return Math.abs(raw - canon) < tol ? canon : raw;
}

/** de-DE input: 75.000, 75000, 75.000,00, −13,40, -13.4 */
export function parseDeNumber(raw: string): number | null {
  let t = raw.trim().replace(/\s/g, "").replace(/€/g, "").replace(/%/g, "");
  t = t.replace(/\u2212/g, "-");
  if (t === "" || t === "-" || t === "+" || t === "." || t === ",") return null;
  const hasComma = t.includes(",");
  const hasDot = t.includes(".");
  let normalized = t;
  if (hasComma && hasDot) {
    normalized = t.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    normalized = t.replace(",", ".");
  } else if (hasDot) {
    const parts = t.split(".");
    const last = parts[parts.length - 1] ?? "";
    if (parts.length > 2 || last.length === 3) {
      normalized = t.replace(/\./g, "");
    }
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

const num2 = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatNum(value: number): string {
  if (!Number.isFinite(value)) return MINUS;
  return withMinus(num2.format(value));
}
