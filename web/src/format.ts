export function formatCny(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 10_000) {
    return `${sign}${(abs / 10_000).toLocaleString("zh-CN", { maximumFractionDigits: 1 })} 万`;
  }
  return `${sign}${abs.toLocaleString("zh-CN", { maximumFractionDigits: 0 })}`;
}

export function formatPct(decimal: number, digits = 2): string {
  return `${(decimal * 100).toFixed(digits)}%`;
}

export function formatSignedCny(n: number): string {
  if (n > 0) return `+${formatCny(n)}`;
  return formatCny(n);
}

/** Terminal FV → PV at annual rate over years. */
export function fvToPv(fv: number, annualRate: number, years: number): number {
  const r = Math.max(-0.99, annualRate);
  return fv / Math.pow(1 + r, years);
}

export function formatFvWithPv(
  fv: number,
  annualRate: number,
  years: number,
  signed = false,
): string {
  const fmt = signed ? formatSignedCny : formatCny;
  const pv = fvToPv(fv, annualRate, years);
  return `${fmt(fv)}（PV ${fmt(pv)}）`;
}
