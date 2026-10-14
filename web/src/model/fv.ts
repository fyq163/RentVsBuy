/** Future-value helpers. CF negative = outflow. */

export function monthlyCompoundRate(annualRate: number): number {
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

/** FV at horizon T of a cashflow at month t (1-based), compounded forward. */
export function compoundToHorizon(cf: number, t: number, T: number, rMonthly: number): number {
  return cf * Math.pow(1 + rMonthly, T - t);
}

export function totalFv(cashflows: number[], rMonthly: number): number {
  const T = cashflows.length;
  let sum = 0;
  for (let i = 0; i < T; i++) {
    const t = i + 1;
    sum += compoundToHorizon(cashflows[i]!, t, T, rMonthly);
  }
  return sum;
}

/** Cumulative FV series: FV of cashflows[0..k] as if horizon were k+1. */
export function cumulativeFvSeries(cashflows: number[], rMonthly: number): number[] {
  const out: number[] = [];
  let running = 0;
  // Recompute each horizon for clarity / correctness of "path to terminal"
  // For chart we use rolling: each point = FV of all CF up to t evaluated at t.
  for (let end = 1; end <= cashflows.length; end++) {
    running = 0;
    for (let i = 0; i < end; i++) {
      const t = i + 1;
      running += compoundToHorizon(cashflows[i]!, t, end, rMonthly);
    }
    out.push(running);
  }
  return out;
}

/** First month where buy cumulative FV exceeds rent (or vice versa); returns year (1-based). */
export function findCrossYear(
  buyCum: number[],
  rentCum: number[],
): { month: number; year: number; direction: "buy_overtakes" | "rent_overtakes" } | null {
  if (buyCum.length === 0) return null;
  let prevSign = Math.sign(buyCum[0]! - rentCum[0]!);
  for (let i = 1; i < buyCum.length; i++) {
    const sign = Math.sign(buyCum[i]! - rentCum[i]!);
    if (sign !== 0 && prevSign !== 0 && sign !== prevSign) {
      return {
        month: i + 1,
        year: Math.ceil((i + 1) / 12),
        direction: sign > 0 ? "buy_overtakes" : "rent_overtakes",
      };
    }
    if (sign !== 0) prevSign = sign;
  }
  return null;
}
