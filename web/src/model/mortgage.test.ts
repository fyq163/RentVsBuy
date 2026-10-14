import { describe, expect, it } from "vitest";
import { DEFAULTS } from "../defaults";
import { annuityStep, equalPrincipalStep } from "./mortgage";
import { monthlyCompoundRate, totalFv } from "./fv";
import { buildCpiPath, buildLoanRatePath } from "./macro";
import { runModel } from "./run";

describe("annuityStep", () => {
  it("pays down a 30y loan roughly on schedule", () => {
    let bal = 3_800_000;
    const n = 360;
    const r = 0.0305;
    for (let k = 0; k < 12; k++) {
      const step = annuityStep(bal, r, n - k);
      expect(step.monthlyPayment).toBeGreaterThan(0);
      expect(step.principalPayment).toBeGreaterThan(0);
      bal = step.nextBalance;
    }
    expect(bal).toBeLessThan(3_800_000);
  });
});

describe("equalPrincipalStep", () => {
  it("uses fixed principal slice", () => {
    const P = 3_800_000;
    const step = equalPrincipalStep(P, P, 0.03, 360);
    expect(step.principalPayment).toBeCloseTo(P / 360, 6);
    expect(step.nextBalance).toBeCloseTo(P - P / 360, 4);
  });
});

describe("macro path", () => {
  it("piecewise reaches dip min then recovers", () => {
    const cpi = buildCpiPath(DEFAULTS);
    expect(cpi.length).toBe(30);
    expect(cpi[DEFAULTS.dipYears - 1]).toBeCloseTo(DEFAULTS.dipMinRate, 6);
    const rates = buildLoanRatePath(DEFAULTS, cpi);
    expect(rates[0]).toBeCloseTo(DEFAULTS.initialRate, 6);
  });
});

describe("runModel", () => {
  it("returns finite FV and premium = buy - rent", () => {
    const r = runModel(DEFAULTS);
    expect(Number.isFinite(r.fvBuy)).toBe(true);
    expect(Number.isFinite(r.fvRent)).toBe(true);
    expect(r.premium).toBeCloseTo(r.fvBuy - r.fvRent, 6);
    expect(r.scenarios).toHaveLength(4);
  });

  it("higher salvage raises buy FV and premium", () => {
    const low = runModel({ ...DEFAULTS, salvageValue: 1_000_000 });
    const high = runModel({ ...DEFAULTS, salvageValue: 3_000_000 });
    expect(high.fvBuy).toBeGreaterThan(low.fvBuy);
    expect(high.premium).toBeGreaterThan(low.premium);
  });

  it("flat CPI level moves loan rate and both FVs", () => {
    const low = runModel({ ...DEFAULTS, cpiMethod: "flat", flatCpi: 0 });
    const high = runModel({ ...DEFAULTS, cpiMethod: "flat", flatCpi: 0.05 });
    expect(high.yearPaths[0]!.loanRate).toBeGreaterThan(low.yearPaths[0]!.loanRate);
    expect(high.fvBuy).not.toBeCloseTo(low.fvBuy, 0);
    expect(high.fvRent).toBeLessThan(low.fvRent);
  });

  it("rentSensitivityK scales rent growth on shared CPI path", () => {
    const low = runModel({ ...DEFAULTS, rentSensitivityK: 0 });
    const high = runModel({ ...DEFAULTS, rentSensitivityK: 2 });
    expect(high.fvRent).toBeLessThan(low.fvRent);
    expect(high.fvBuy).toBeCloseTo(low.fvBuy, 4);
  });

  it("partial prepay differs from paying off remaining balance", () => {
    const all = runModel({ ...DEFAULTS, prepay: true, prepayMode: "all" });
    const partial = runModel({
      ...DEFAULTS,
      prepay: true,
      prepayMode: "amount",
      prepayAmount: 500_000,
    });
    expect(partial.fvBuy).not.toBeCloseTo(all.fvBuy, 0);
  });

  it("FV of zero cashflows is zero", () => {
    expect(totalFv(Array(12).fill(0), monthlyCompoundRate(DEFAULTS.rateCpiAnchor))).toBe(0);
  });

  it("compounds with rateCpiAnchor not legacy discountRate", () => {
    const a = runModel({ ...DEFAULTS, rateCpiAnchor: 0.02, discountRate: 0.09 });
    const b = runModel({ ...DEFAULTS, rateCpiAnchor: 0.02, discountRate: 0.01 });
    expect(a.fvBuy).toBeCloseTo(b.fvBuy, 4);
    const c = runModel({ ...DEFAULTS, rateCpiAnchor: 0.05 });
    expect(c.fvBuy).not.toBeCloseTo(a.fvBuy, 0);
  });
});
