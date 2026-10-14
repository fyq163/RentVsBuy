import { DEFAULTS, SCENARIOS, type ModelInputs, type PaymentType } from "../defaults";
import { buildMonthlyRows } from "./cashflow";
import { cumulativeFvSeries, findCrossYear, monthlyCompoundRate, totalFv } from "./fv";
import type { YearPath } from "./macro";

export interface ScenarioResult {
  id: string;
  name: string;
  fvBuy: number;
  fvRent: number;
  premium: number;
  cross: ReturnType<typeof findCrossYear>;
}

export interface RunResult {
  fvBuy: number;
  fvRent: number;
  premium: number;
  deltaPremiumVsDefaultSalvage: number;
  buyCumFv: number[];
  rentCumFv: number[];
  cross: ReturnType<typeof findCrossYear>;
  yearPaths: YearPath[];
  scenarios: ScenarioResult[];
}

function runOne(
  inputs: ModelInputs,
  paymentType: PaymentType,
  prepay: boolean,
): Omit<ScenarioResult, "id" | "name"> & {
  buyCumFv: number[];
  rentCumFv: number[];
  yearPaths: YearPath[];
} {
  const { buyCf, rentCf, yearPaths } = buildMonthlyRows(inputs, paymentType, prepay);
  // 折现 / 终值复利口径 = 中性锚定 CPI（rateCpiAnchor）
  const rM = monthlyCompoundRate(inputs.rateCpiAnchor);
  const fvBuy = totalFv(buyCf, rM);
  const fvRent = totalFv(rentCf, rM);
  const buyCumFv = cumulativeFvSeries(buyCf, rM);
  const rentCumFv = cumulativeFvSeries(rentCf, rM);
  return {
    fvBuy,
    fvRent,
    premium: fvBuy - fvRent,
    cross: findCrossYear(buyCumFv, rentCumFv),
    buyCumFv,
    rentCumFv,
    yearPaths,
  };
}

export function runModel(inputs: ModelInputs): RunResult {
  const primary = runOne(inputs, inputs.paymentType, inputs.prepay);

  const baselineSalvage = { ...inputs, salvageValue: DEFAULTS.salvageValue };
  const baseline = runOne(baselineSalvage, inputs.paymentType, inputs.prepay);

  const scenarios: ScenarioResult[] = SCENARIOS.map((s) => {
    const r = runOne(inputs, s.paymentType, s.prepay);
    return {
      id: s.id,
      name: s.name,
      fvBuy: r.fvBuy,
      fvRent: r.fvRent,
      premium: r.premium,
      cross: r.cross,
    };
  });

  return {
    fvBuy: primary.fvBuy,
    fvRent: primary.fvRent,
    premium: primary.premium,
    deltaPremiumVsDefaultSalvage: primary.premium - baseline.premium,
    buyCumFv: primary.buyCumFv,
    rentCumFv: primary.rentCumFv,
    cross: primary.cross,
    yearPaths: primary.yearPaths,
    scenarios,
  };
}
