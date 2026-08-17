/** Two-asset helpers. Inputs as decimals (0.08 = 8 %). */

export const DAX_MU = 0.08;
export const DAX_SIG = 0.161;
export const GOLD_MU = 0.06;
export const GOLD_SIG = 0.13;
export const RHO_DG = -0.1;

export const SOLL_W_DAX_PCT = 40;
export const SOLL_W_GOLD_PCT = 60;
export const SOLL_SIG_MVP_PCT = 9.6;
export const SOLL_MU_MVP = 0.068;
export const SOLL_SIG_MVP = 0.096;
export const FIFTY_MU = 0.07;
export const FIFTY_SIG = 0.098;

export const W_TOL_PP = 0.6;
export const SIG_TOL_PP = 0.15;

export const KIPP_MU_X_HI = 0.08;
export const KIPP_MU_X_LO = 0.07;
export const KIPP_SIG_X = 0.16;
export const KIPP_MU_Y = 0.09;
export const KIPP_SIG_Y = 0.2;
export const KIPP_RHO = 0.8;
export const KIPP_RF = 0.02;
export const KIPP_W_HI = 0.7;
export const KIPP_W_LO = 0.29;

export const CRISIS_W_EQ = 0.6;
export const CRISIS_MU_EQ = 0.07;
export const CRISIS_SIG_EQ = 0.18;
export const CRISIS_W_BD = 0.4;
export const CRISIS_MU_BD = 0.03;
export const CRISIS_SIG_BD = 0.06;
export const CRISIS_RHO_CALM = 0.2;
export const CRISIS_RHO_STRESS = 0.8;
export const CRISIS_MU = 0.054;
export const CRISIS_SIG_CALM = 0.115;
export const CRISIS_SIG_STRESS = 0.128;
export const CRISIS_JUMP_PP = 1.3;

export function portReturn(w1: number, mu1: number, mu2: number): number {
  return w1 * mu1 + (1 - w1) * mu2;
}

export function portVol(w1: number, s1: number, s2: number, rho: number): number {
  const w2 = 1 - w1;
  const v = w1 * w1 * s1 * s1 + w2 * w2 * s2 * s2 + 2 * w1 * w2 * s1 * s2 * rho;
  return Math.sqrt(Math.max(0, v));
}

export function mvpWeights(s1: number, s2: number, rho: number): { w1: number; w2: number } {
  const num = s2 * s2 - s1 * s2 * rho;
  const den = s1 * s1 + s2 * s2 - 2 * s1 * s2 * rho;
  if (den === 0) return { w1: Number.NaN, w2: Number.NaN };
  const w1 = num / den;
  return { w1, w2: 1 - w1 };
}

export function tangencyWeightX(
  muX: number,
  muY: number,
  sX: number,
  sY: number,
  rho: number,
  rf: number,
): number {
  const ex = muX - rf;
  const ey = muY - rf;
  const sY2 = sY * sY;
  const sX2 = sX * sX;
  const cross = sX * sY * rho;
  const num = ex * sY2 - ey * cross;
  const den = ex * sY2 + ey * sX2 - (ex + ey) * cross;
  if (den === 0) return Number.NaN;
  return num / den;
}

export function crisisVol(rho: number): number {
  return portVol(CRISIS_W_EQ, CRISIS_SIG_EQ, CRISIS_SIG_BD, rho);
}

export function nearPctPoints(valuePct: number, sollPct: number, tol: number): boolean {
  return Math.abs(valuePct - sollPct) <= tol;
}
