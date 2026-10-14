/** Amortization steps — annuity (等额本息) and equal principal (等额本金). */

export interface AmortStep {
  monthlyPayment: number;
  principalPayment: number;
  monthlyInterest: number;
  nextBalance: number;
}

export function annuityStep(
  balance: number,
  annualRate: number,
  remainingMonths: number,
): AmortStep {
  if (balance <= 0 || remainingMonths <= 0) {
    return { monthlyPayment: 0, principalPayment: 0, monthlyInterest: 0, nextBalance: 0 };
  }
  const i = annualRate / 12;
  if (i === 0) {
    const principalPayment = balance / remainingMonths;
    return {
      monthlyPayment: principalPayment,
      principalPayment,
      monthlyInterest: 0,
      nextBalance: Math.max(0, balance - principalPayment),
    };
  }
  const factor = Math.pow(1 + i, remainingMonths);
  const monthlyPayment = (balance * i * factor) / (factor - 1);
  const monthlyInterest = balance * i;
  const principalPayment = monthlyPayment - monthlyInterest;
  return {
    monthlyPayment,
    principalPayment,
    monthlyInterest,
    nextBalance: Math.max(0, balance - principalPayment),
  };
}

/**
 * Equal principal: fixed principal = originalPrincipal / originalTermMonths.
 * `k` is 1-based month index from loan start; remainingBalance is current start balance.
 */
export function equalPrincipalStep(
  originalPrincipal: number,
  remainingBalance: number,
  annualRate: number,
  originalTermMonths: number,
): AmortStep {
  if (remainingBalance <= 0 || originalTermMonths <= 0) {
    return { monthlyPayment: 0, principalPayment: 0, monthlyInterest: 0, nextBalance: 0 };
  }
  const monthlyRate = annualRate / 12;
  const principalPayment = Math.min(originalPrincipal / originalTermMonths, remainingBalance);
  const monthlyInterest = remainingBalance * monthlyRate;
  const monthlyPayment = principalPayment + monthlyInterest;
  return {
    monthlyPayment,
    principalPayment,
    monthlyInterest,
    nextBalance: Math.max(0, remainingBalance - principalPayment),
  };
}
