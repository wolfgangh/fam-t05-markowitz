import "./style.css";
import { formatNum, formatPct, parseDeNumber } from "./format";
import {
  CRISIS_RHO_CALM,
  DAX_MU,
  DAX_SIG,
  GOLD_MU,
  GOLD_SIG,
  KIPP_MU_X_HI,
  KIPP_MU_X_LO,
  KIPP_MU_Y,
  KIPP_RF,
  KIPP_RHO,
  KIPP_SIG_X,
  KIPP_SIG_Y,
  KIPP_W_HI,
  KIPP_W_LO,
  RHO_DG,
  SIG_TOL_PP,
  SOLL_MU_MVP,
  SOLL_SIG_MVP,
  SOLL_SIG_MVP_PCT,
  SOLL_W_DAX_PCT,
  SOLL_W_GOLD_PCT,
  W_TOL_PP,
  crisisVol,
  nearPctPoints,
  portReturn,
  portVol,
  tangencyWeightX,
} from "./model";

type FormValues = {
  wDaxPct: number;
  wGoldPct: number;
  sigMvpPct: number;
};

function must<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
}

const ui = {
  form: must<HTMLFormElement>("handweg-form"),
  wDax: must<HTMLInputElement>("w-dax"),
  wGold: must<HTMLInputElement>("w-gold"),
  sigMvp: must<HTMLInputElement>("sig-mvp"),
  formError: must<HTMLParagraphElement>("form-error"),
  formHint: must<HTMLParagraphElement>("form-hint"),
  compare: must<HTMLElement>("compare"),
  compareBody: must<HTMLElement>("compare-body"),
  compareNote: must<HTMLParagraphElement>("compare-note"),
  verdict: must<HTMLElement>("verdict"),
  lock: must<HTMLElement>("model-lock"),
  region: must<HTMLElement>("model-region"),
  host: must<HTMLElement>("frontier-host"),
  readout: must<HTMLElement>("readout"),
  mixCard: must<HTMLElement>("mix-card"),
  sliderW: must<HTMLInputElement>("slider-w"),
  valW: must<HTMLElement>("val-w"),
  btnLong: must<HTMLButtonElement>("btn-long"),
  btnShort: must<HTMLButtonElement>("btn-short"),
  play: must<HTMLButtonElement>("play"),
  reset: must<HTMLButtonElement>("reset"),
  example: must<HTMLButtonElement>("example"),
  kippCard: must<HTMLElement>("kipp-card"),
  kippBox: must<HTMLElement>("kipp-box"),
  kippFigure: must<HTMLElement>("kipp-figure"),
  kippLive: must<HTMLElement>("kipp-live"),
  sliderMux: must<HTMLInputElement>("slider-mux"),
  valMux: must<HTMLElement>("val-mux"),
  kippHi: must<HTMLButtonElement>("kipp-hi"),
  kippLo: must<HTMLButtonElement>("kipp-lo"),
  crisisCard: must<HTMLElement>("crisis-card"),
  crisisFigure: must<HTMLElement>("crisis-figure"),
  crisisLive: must<HTMLElement>("crisis-live"),
  sliderRho: must<HTMLInputElement>("slider-rho"),
  valRho: must<HTMLElement>("val-rho"),
};

const W_LONG_MIN = 0;
const W_LONG_MAX = 1;
const W_SHORT_MIN = -0.2;
const W_SHORT_MAX = 1.2;

const SVG_W = 720;
const SVG_H = 400;
const PAD_L = 64;
const PAD_R = 36;
const PAD_T = 28;
const PAD_B = 48;
const SIG_MIN = 0.06;
const SIG_MAX = 0.22;
const MU_MIN = 0.045;
const MU_MAX = 0.095;

let unlocked = false;
let wDax = 0.4;
let muX = KIPP_MU_X_HI;
let rho = CRISIS_RHO_CALM;
let shorts = false;
let animToken = 0;
let dragging = false;

function wMin(): number {
  return shorts ? W_SHORT_MIN : W_LONG_MIN;
}

function wMax(): number {
  return shorts ? W_SHORT_MAX : W_LONG_MAX;
}

function clampW(w: number): number {
  return Math.min(wMax(), Math.max(wMin(), w));
}

function muxFromSlider(raw: number): number {
  return KIPP_MU_X_HI - (raw / 100) * (KIPP_MU_X_HI - KIPP_MU_X_LO);
}

function sliderFromMux(m: number): number {
  const span = KIPP_MU_X_HI - KIPP_MU_X_LO;
  return Math.round(((KIPP_MU_X_HI - m) / span) * 100);
}

function xAt(sig: number): number {
  return PAD_L + ((sig - SIG_MIN) / (SIG_MAX - SIG_MIN)) * (SVG_W - PAD_L - PAD_R);
}

function yAt(mu: number): number {
  return SVG_H - PAD_B - ((mu - MU_MIN) / (MU_MAX - MU_MIN)) * (SVG_H - PAD_T - PAD_B);
}

function point(w: number): { sig: number; mu: number; x: number; y: number } {
  const sig = portVol(w, DAX_SIG, GOLD_SIG, RHO_DG);
  const mu = portReturn(w, DAX_MU, GOLD_MU);
  return { sig, mu, x: xAt(sig), y: yAt(mu) };
}

function pathFor(from: number, to: number, steps: number): string {
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const w = from + ((to - from) * i) / steps;
    const p = point(w);
    pts.push(`${p.x.toFixed(2)},${p.y.toFixed(2)}`);
  }
  return pts.join(" ");
}

function readForm(): FormValues | string {
  const wDaxPct = parseDeNumber(ui.wDax.value);
  const wGoldPct = parseDeNumber(ui.wGold.value);
  const sigMvpPct = parseDeNumber(ui.sigMvp.value);
  if (wDaxPct === null || wGoldPct === null || sigMvpPct === null) {
    return "Bitte alle drei Felder ausfüllen. Zahlen im deutschen Format, zum Beispiel 40 oder 40,00 und 9,6 oder 9,60.";
  }
  return { wDaxPct, wGoldPct, sigMvpPct };
}

function fillInputs(v: FormValues | null): void {
  if (!v) {
    ui.wDax.value = "";
    ui.wGold.value = "";
    ui.sigMvp.value = "";
    return;
  }
  ui.wDax.value = formatNum(v.wDaxPct);
  ui.wGold.value = formatNum(v.wGoldPct);
  ui.sigMvp.value = formatNum(v.sigMvpPct);
}

function fillExample(): void {
  ui.wDax.value = "40,00";
  ui.wGold.value = "60,00";
  ui.sigMvp.value = "9,60";
}

function trimNum(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return String(Math.round(rounded));
  return String(rounded);
}

function writeUrl(): void {
  if (!unlocked) {
    const clean = `${window.location.pathname}${window.location.hash}`;
    window.history.replaceState(null, "", clean);
    return;
  }
  const q = new URLSearchParams();
  q.set("w", trimNum(wDax * 100));
  q.set("mux", trimNum(muX * 100));
  q.set("rho", trimNum(rho));
  q.set("shorts", shorts ? "1" : "0");
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}?${q.toString()}${window.location.hash}`,
  );
}

function readUrl(): { w: number; mux: number; rho: number; shorts: boolean } | null {
  const q = new URLSearchParams(window.location.search);
  if (!q.has("w") && !q.has("mux") && !q.has("rho") && !q.has("shorts")) return null;
  const wPct = Number(q.get("w") ?? "40");
  const muxPct = Number(q.get("mux") ?? "8");
  const rhoRaw = Number(q.get("rho") ?? "0.2");
  const shortsRaw = q.get("shorts") ?? "0";
  if (!Number.isFinite(wPct) || !Number.isFinite(muxPct) || !Number.isFinite(rhoRaw)) return null;
  const nextShorts = shortsRaw === "1";
  const lo = nextShorts ? W_SHORT_MIN : W_LONG_MIN;
  const hi = nextShorts ? W_SHORT_MAX : W_LONG_MAX;
  const w = Math.min(hi, Math.max(lo, wPct / 100));
  const mux = Math.min(KIPP_MU_X_HI, Math.max(KIPP_MU_X_LO, muxPct / 100));
  const nextRho = Math.min(1, Math.max(0, rhoRaw));
  return { w, mux, rho: nextRho, shorts: nextShorts };
}

function verdictFor(v: FormValues): { ok: boolean; text: string } {
  const daxOk = nearPctPoints(v.wDaxPct, SOLL_W_DAX_PCT, W_TOL_PP);
  const goldOk = nearPctPoints(v.wGoldPct, SOLL_W_GOLD_PCT, W_TOL_PP);
  const sigOk = nearPctPoints(v.sigMvpPct, SOLL_SIG_MVP_PCT, SIG_TOL_PP);
  if (daxOk && goldOk && sigOk) {
    return {
      ok: true,
      text: "RICHTIG. Gewicht DAX 40,00 Prozent. Gewicht Gold 60,00 Prozent. Risiko des Minimum-Varianz-Portfolios 9,60 Prozent. Diese Mischung braucht keine Renditeprognose.",
    };
  }
  return {
    ok: false,
    text: "FALSCH. Mindestens eine Zahl weicht ab. Soll: Gewicht DAX 40,00 Prozent, Gewicht Gold 60,00 Prozent, Risiko 9,60 Prozent. Die Mischung nutzt nur Risiko und Korrelation, keine erwartete Rendite.",
  };
}

function renderCompare(v: FormValues): void {
  const rows: Array<[string, string, string]> = [
    ["Gewicht DAX", formatPct(v.wDaxPct / 100), formatPct(SOLL_W_DAX_PCT / 100)],
    ["Gewicht Gold", formatPct(v.wGoldPct / 100), formatPct(SOLL_W_GOLD_PCT / 100)],
    ["Risiko des MVP", formatPct(v.sigMvpPct / 100), formatPct(SOLL_SIG_MVP_PCT / 100)],
  ];
  ui.compareBody.innerHTML = rows
    .map(
      ([name, mine, soll]) => `
    <tr>
      <th scope="row">${name}</th>
      <td>${mine}</td>
      <td>${soll}</td>
    </tr>`,
    )
    .join("");
  const vrd = verdictFor(v);
  ui.verdict.className = `verdict${vrd.ok ? "" : " is-false"}`;
  ui.verdict.innerHTML = `<span class="verdict-word">${vrd.ok ? "RICHTIG" : "FALSCH"}</span><p>${vrd.text}</p>`;
  ui.verdict.hidden = false;
  ui.compareNote.textContent = vrd.ok
    ? "Vergleichen Sie Ihre Zahlen mit den Soll-Zahlen. Danach steht das Modell offen."
    : "Vergleichen Sie Ihre Zahlen mit den Soll-Zahlen. Das Modell ist trotzdem offen.";
}

function setControlsEnabled(on: boolean): void {
  ui.sliderW.disabled = !on;
  ui.play.disabled = !on;
  ui.btnLong.disabled = !on;
  ui.btnShort.disabled = !on;
  ui.region.setAttribute("aria-disabled", on ? "false" : "true");
}

function applyShortsRange(): void {
  const lo = Math.round(wMin() * 100);
  const hi = Math.round(wMax() * 100);
  ui.sliderW.min = String(lo);
  ui.sliderW.max = String(hi);
  wDax = clampW(wDax);
  ui.sliderW.value = String(Math.round(wDax * 100));
  ui.btnLong.setAttribute("aria-pressed", shorts ? "false" : "true");
  ui.btnShort.setAttribute("aria-pressed", shorts ? "true" : "false");
}

function ticks(): string {
  const sigs = [0.08, 0.1, 0.12, 0.14, 0.16, 0.18, 0.2];
  const mus = [0.05, 0.06, 0.07, 0.08, 0.09];
  const lines: string[] = [];
  for (const s of sigs) {
    const x = xAt(s);
    lines.push(`<line class="grid" x1="${x}" y1="${PAD_T}" x2="${x}" y2="${SVG_H - PAD_B}" />`);
    lines.push(`<text class="tick" x="${x}" y="${SVG_H - PAD_B + 16}" text-anchor="middle">${formatPct(s)}</text>`);
  }
  for (const m of mus) {
    const y = yAt(m);
    lines.push(`<line class="grid" x1="${PAD_L}" y1="${y}" x2="${SVG_W - PAD_R}" y2="${y}" />`);
    lines.push(`<text class="tick" x="${PAD_L - 8}" y="${y + 4}" text-anchor="end">${formatPct(m)}</text>`);
  }
  return lines.join("");
}

function paintFrontier(): void {
  const dax = point(1);
  const gold = point(0);
  const mvp = point(0.4);
  const fifty = point(0.5);
  const now = point(wDax);
  const solid = pathFor(0, 1, 80);
  const leftWing = shorts ? pathFor(W_SHORT_MIN, 0, 24) : "";
  const rightWing = shorts ? pathFor(1, W_SHORT_MAX, 24) : "";
  const dashLeft = leftWing
    ? `<polyline class="curve-dash" points="${leftWing}" />`
    : "";
  const dashRight = rightWing
    ? `<polyline class="curve-dash" points="${rightWing}" />`
    : "";

  ui.host.innerHTML = `
    <svg class="frontier-svg" viewBox="0 0 ${SVG_W} ${SVG_H}" role="img" aria-labelledby="front-title front-desc">
      <title id="front-title">Effiziente Grenze DAX und Gold</title>
      <desc id="front-desc">μ nach oben, σ nach rechts. MVP bei 40 Prozent DAX. Aktuell ${formatPct(wDax)} DAX.</desc>
      ${ticks()}
      <line class="axis" x1="${PAD_L}" y1="${PAD_T}" x2="${PAD_L}" y2="${SVG_H - PAD_B}" />
      <line class="axis" x1="${PAD_L}" y1="${SVG_H - PAD_B}" x2="${SVG_W - PAD_R}" y2="${SVG_H - PAD_B}" />
      <text class="axis-title" x="${SVG_W / 2}" y="${SVG_H - 6}" text-anchor="middle">Risiko σ</text>
      <text class="axis-title" x="16" y="${SVG_H / 2}" text-anchor="middle" transform="rotate(-90 16 ${SVG_H / 2})">Rendite μ</text>
      ${dashLeft}
      <polyline class="curve-solid" points="${solid}" />
      ${dashRight}
      <circle class="node" cx="${dax.x}" cy="${dax.y}" r="6" />
      <circle class="node" cx="${gold.x}" cy="${gold.y}" r="6" />
      <circle class="node-fifty" cx="${fifty.x}" cy="${fifty.y}" r="5" />
      <circle class="node-mvp" cx="${mvp.x}" cy="${mvp.y}" r="6" />
      <circle class="node-now" cx="${now.x}" cy="${now.y}" r="8" />
      <text class="chart-label" x="${dax.x + 10}" y="${dax.y - 8}">DAX</text>
      <text class="chart-label" x="${gold.x + 10}" y="${gold.y + 16}">Gold</text>
      <text class="chart-label" x="${mvp.x - 8}" y="${mvp.y - 10}" text-anchor="end">MVP</text>
      <text class="chart-label" x="${fifty.x + 10}" y="${fifty.y - 8}">50/50</text>
    </svg>
  `;

  const liveMu = portReturn(wDax, DAX_MU, GOLD_MU);
  const liveSig = portVol(wDax, DAX_SIG, GOLD_SIG, RHO_DG);
  ui.readout.innerHTML = `
    <div class="fact"><dt>Gewicht DAX</dt><dd>${formatPct(wDax)}</dd></div>
    <div class="fact"><dt>Gewicht Gold</dt><dd>${formatPct(1 - wDax)}</dd></div>
    <div class="fact"><dt>Portfoliorendite</dt><dd>${formatPct(liveMu)}</dd></div>
    <div class="fact"><dt>Portfoliorisiko</dt><dd>${formatPct(liveSig)}</dd></div>
    <div class="fact"><dt>Risiko MVP</dt><dd>${formatPct(SOLL_SIG_MVP)}</dd></div>
    <div class="fact"><dt>Rendite MVP</dt><dd>${formatPct(SOLL_MU_MVP)}</dd></div>
  `;
  ui.valW.textContent = formatPct(wDax);
  ui.sliderW.value = String(Math.round(wDax * 100));

  if (!unlocked) {
    ui.mixCard.hidden = true;
    ui.mixCard.innerHTML = "";
    return;
  }
  const parts = [
    `<h3>Ihre Mischung</h3>`,
    `<p>An dieser Mischung: DAX-ETF ${formatPct(wDax)}. Gold-ETC ${formatPct(1 - wDax)}.</p>`,
    `<p>Die Portfoliorendite beträgt ${formatPct(liveMu)}. Das Portfoliorisiko beträgt ${formatPct(liveSig)}.</p>`,
    `<p>Für das Minimum-Varianz-Portfolio bleiben Risiko 9,60 Prozent und erwartete Rendite 6,80 Prozent. Das Buch mit je 50 Prozent liegt bei 7,00 Prozent Rendite und 9,80 Prozent Risiko.</p>`,
  ];
  if (shorts) {
    parts.push(`<p>Leerverkauf ist erlaubt. Die gestrichelten Flügel zeigen ein DAX-Gewicht unter 0 Prozent oder über 100 Prozent.</p>`);
  } else {
    parts.push(`<p>Nur kaufen: die Linie läuft nur zwischen 0 Prozent und 100 Prozent.</p>`);
  }
  ui.mixCard.innerHTML = parts.join("\n    ");
  ui.mixCard.hidden = false;
}

function kippWeight(m: number): number {
  return tangencyWeightX(m, KIPP_MU_Y, KIPP_SIG_X, KIPP_SIG_Y, KIPP_RHO, KIPP_RF);
}

function kippShown(m: number, live: number): string {
  if (Math.abs(m - KIPP_MU_X_HI) < 1e-9) return formatPct(KIPP_W_HI);
  if (Math.abs(m - KIPP_MU_X_LO) < 1e-9) return formatPct(KIPP_W_LO);
  return formatPct(live);
}

function paintKipp(): void {
  const live = kippWeight(muX);
  const shown = kippShown(muX, live);
  ui.kippFigure.textContent = shown;
  ui.valMux.textContent = formatPct(muX);
  ui.sliderMux.value = String(sliderFromMux(muX));
  const tipped = Math.abs(muX - KIPP_MU_X_LO) < 1e-4;
  ui.kippBox.className = tipped ? "kipp-box is-tipped" : "kipp-box";
  ui.kippLive.textContent =
    `Die erwartete Rendite von Fonds X steht bei ${formatPct(muX)}. Das Gewicht von X steht bei ${shown}. An den Endpunkten der Rechnung kippt das Gewicht von 70,00 Prozent auf 29,00 Prozent.`;
}

function paintCrisis(): void {
  const live = crisisVol(rho);
  ui.crisisFigure.textContent = formatPct(live);
  ui.valRho.textContent = formatNum(rho);
  ui.sliderRho.value = String(Math.round(rho * 100));
  ui.crisisLive.textContent =
    `Die Korrelation steht bei ${formatNum(rho)}. Das Portfoliorisiko steht bei ${formatPct(live)}. Die Portfoliorendite bleibt 5,40 Prozent. In der ruhigen Rechnung: Korrelation 0,20, Risiko 11,50 Prozent. In der Stressrechnung: Korrelation 0,80, Risiko 12,80 Prozent. Der Sprung beträgt 1,30 Prozentpunkte, ohne Umschichtung.`;
}

function paintAll(): void {
  paintFrontier();
  paintKipp();
  paintCrisis();
}

function playFrontier(): void {
  if (!unlocked) return;
  const token = ++animToken;
  const from = wMin();
  const to = wMax();
  const t0 = performance.now();
  const dur = 2200;
  function frame(now: number): void {
    if (token !== animToken) return;
    const t = Math.min(1, (now - t0) / dur);
    const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    wDax = from + (to - from) * eased;
    paintFrontier();
    writeUrl();
    if (t < 1) requestAnimationFrame(frame);
  }
  wDax = from;
  paintFrontier();
  requestAnimationFrame(frame);
}

function unlock(v: FormValues): void {
  unlocked = true;
  ui.compare.classList.remove("hidden");
  ui.kippCard.classList.remove("hidden");
  ui.crisisCard.classList.remove("hidden");
  renderCompare(v);
  ui.lock.hidden = true;
  setControlsEnabled(true);
  applyShortsRange();
  paintAll();
  writeUrl();
}

function lockEmpty(): void {
  unlocked = false;
  wDax = 0.4;
  muX = KIPP_MU_X_HI;
  rho = CRISIS_RHO_CALM;
  shorts = false;
  animToken += 1;
  fillInputs(null);
  ui.formError.textContent = "";
  ui.formHint.textContent = "";
  ui.compare.classList.add("hidden");
  ui.kippCard.classList.add("hidden");
  ui.crisisCard.classList.add("hidden");
  ui.verdict.hidden = true;
  ui.lock.hidden = false;
  ui.mixCard.hidden = true;
  ui.mixCard.innerHTML = "";
  setControlsEnabled(false);
  applyShortsRange();
  paintAll();
  writeUrl();
}

function nearestW(x: number, y: number): number {
  const lo = wMin();
  const hi = wMax();
  let best = lo;
  let bestD = Infinity;
  const steps = 280;
  for (let i = 0; i <= steps; i++) {
    const w = lo + ((hi - lo) * i) / steps;
    const p = point(w);
    const dx = p.x - x;
    const dy = p.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = w;
    }
  }
  return best;
}

function svgLocal(ev: PointerEvent): { x: number; y: number } | null {
  const svg = ui.host.querySelector("svg");
  if (!(svg instanceof SVGSVGElement)) return null;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = ev.clientX;
  pt.y = ev.clientY;
  const loc = pt.matrixTransform(ctm.inverse());
  return { x: loc.x, y: loc.y };
}

function onPointerDown(ev: PointerEvent): void {
  if (!unlocked) return;
  const loc = svgLocal(ev);
  if (!loc) return;
  animToken += 1;
  dragging = true;
  wDax = clampW(nearestW(loc.x, loc.y));
  paintFrontier();
  writeUrl();
  ui.host.setPointerCapture(ev.pointerId);
}

function onPointerMove(ev: PointerEvent): void {
  if (!unlocked || !dragging) return;
  const loc = svgLocal(ev);
  if (!loc) return;
  wDax = clampW(nearestW(loc.x, loc.y));
  paintFrontier();
  writeUrl();
}

function onPointerUp(ev: PointerEvent): void {
  if (!dragging) return;
  dragging = false;
  if (ui.host.hasPointerCapture(ev.pointerId)) ui.host.releasePointerCapture(ev.pointerId);
}

function boot(): void {
  ui.host.tabIndex = 0;

  ui.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const parsed = readForm();
    if (typeof parsed === "string") {
      ui.formError.textContent = parsed;
      ui.formHint.textContent = "";
      return;
    }
    ui.formError.textContent = "";
    ui.formHint.textContent = "";
    unlock(parsed);
  });

  ui.reset.addEventListener("click", () => {
    lockEmpty();
  });

  ui.example.addEventListener("click", () => {
    fillExample();
    ui.formError.textContent = "";
    ui.formHint.textContent =
      "Die Beispielzahlen stehen in den Feldern. Bestätigen Sie die Zahlen. Das Modell öffnet sich erst danach.";
    ui.wDax.focus();
  });

  ui.sliderW.addEventListener("input", () => {
    if (!unlocked) return;
    animToken += 1;
    const n = Number(ui.sliderW.value);
    if (!Number.isFinite(n)) return;
    wDax = clampW(n / 100);
    paintFrontier();
    writeUrl();
  });

  ui.btnLong.addEventListener("click", () => {
    if (!unlocked) return;
    animToken += 1;
    shorts = false;
    applyShortsRange();
    paintFrontier();
    writeUrl();
  });

  ui.btnShort.addEventListener("click", () => {
    if (!unlocked) return;
    animToken += 1;
    shorts = true;
    applyShortsRange();
    paintFrontier();
    writeUrl();
  });

  ui.play.addEventListener("click", () => playFrontier());

  ui.sliderMux.addEventListener("input", () => {
    if (!unlocked) return;
    const n = Number(ui.sliderMux.value);
    if (!Number.isFinite(n)) return;
    muX = muxFromSlider(n);
    paintKipp();
    writeUrl();
  });

  ui.kippHi.addEventListener("click", () => {
    if (!unlocked) return;
    muX = KIPP_MU_X_HI;
    paintKipp();
    writeUrl();
  });

  ui.kippLo.addEventListener("click", () => {
    if (!unlocked) return;
    muX = KIPP_MU_X_LO;
    paintKipp();
    writeUrl();
  });

  ui.sliderRho.addEventListener("input", () => {
    if (!unlocked) return;
    const n = Number(ui.sliderRho.value);
    if (!Number.isFinite(n)) return;
    rho = Math.min(1, Math.max(0, n / 100));
    paintCrisis();
    writeUrl();
  });

  ui.host.addEventListener("pointerdown", onPointerDown);
  ui.host.addEventListener("pointermove", onPointerMove);
  ui.host.addEventListener("pointerup", onPointerUp);
  ui.host.addEventListener("pointercancel", onPointerUp);

  ui.host.addEventListener("keydown", (e) => {
    if (!unlocked) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      animToken += 1;
      wDax = clampW(wDax - 0.01);
      paintFrontier();
      writeUrl();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      animToken += 1;
      wDax = clampW(wDax + 0.01);
      paintFrontier();
      writeUrl();
    }
  });

  const fromUrl = readUrl();
  if (fromUrl) {
    shorts = fromUrl.shorts;
    wDax = fromUrl.w;
    muX = fromUrl.mux;
    rho = fromUrl.rho;
    fillExample();
    const parsed = readForm();
    if (typeof parsed !== "string") unlock(parsed);
    else lockEmpty();
  } else {
    lockEmpty();
  }
}

void boot();
