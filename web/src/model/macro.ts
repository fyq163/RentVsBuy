import type { ModelInputs } from "../defaults";

export interface YearPath {
  year: number;
  cpi: number;
  loanRate: number;
}

/** Linear interpolate from start → end over `years` steps (inclusive of end at last year). */
function lerpSeries(start: number, end: number, years: number): number[] {
  if (years <= 0) return [];
  if (years === 1) return [end];
  const out: number[] = [];
  for (let i = 0; i < years; i++) {
    const t = i / (years - 1);
    out.push(start + (end - start) * t);
  }
  return out;
}

/** Annual CPI path for compareYears calendar years starting at startYear. */
export function buildCpiPath(inputs: ModelInputs): number[] {
  const n = Math.max(1, Math.ceil(inputs.compareYears));
  if (inputs.cpiMethod === "flat") {
    return Array.from({ length: n }, () => inputs.flatCpi);
  }

  // piecewise: dip years → min, then recovery → target, then long-term mean
  const dip = lerpSeries(0, inputs.dipMinRate, inputs.dipYears);
  // recovery starts from dip min
  const recovery = lerpSeries(inputs.dipMinRate, inputs.recoveryTargetRate, inputs.recoveryYears);
  // avoid duplicating the dip-min point at recovery start
  const recoveryTail = recovery.slice(1);
  const head = [...dip, ...recoveryTail];
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(i < head.length ? head[i]! : inputs.longTermMean);
  }
  return out;
}

/**
 * Loan rate path: rate_t = max(floor, initial_rate + k * (cpi_t - anchor))
 *
 * - piecewise: anchor = path year-0 CPI（相对路径自身的冲击）
 * - flat: anchor = rateCpiAnchor（中性 CPI，与 piecewise 的「长期稳态」无关）
 */
export function buildLoanRatePath(inputs: ModelInputs, cpiPath: number[]): number[] {
  const anchor =
    inputs.cpiMethod === "flat" ? inputs.rateCpiAnchor : (cpiPath[0] ?? 0);
  return cpiPath.map((cpi) =>
    Math.max(inputs.rateFloor, inputs.initialRate + inputs.rateSensitivityK * (cpi - anchor)),
  );
}

export function buildYearPaths(inputs: ModelInputs): YearPath[] {
  const cpiPath = buildCpiPath(inputs);
  const rates = buildLoanRatePath(inputs, cpiPath);
  return cpiPath.map((cpi, i) => ({
    year: inputs.startYear + i,
    cpi,
    loanRate: rates[i]!,
  }));
}

/** Map month index (1..T) to annual rate for that calendar year. */
export function rateForMonth(yearPaths: YearPath[], month: number, startYear: number): number {
  const yearIndex = Math.floor((month - 1) / 12);
  const year = startYear + yearIndex;
  const row = yearPaths.find((y) => y.year === year) ?? yearPaths[yearPaths.length - 1];
  return row?.loanRate ?? 0.03;
}

export function cpiForMonth(yearPaths: YearPath[], month: number, startYear: number): number {
  const yearIndex = Math.floor((month - 1) / 12);
  const year = startYear + yearIndex;
  const row = yearPaths.find((y) => y.year === year) ?? yearPaths[yearPaths.length - 1];
  return row?.cpi ?? 0;
}
