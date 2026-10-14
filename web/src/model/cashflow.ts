import type { ModelInputs, PaymentType } from "../defaults";
import { buildYearPaths, cpiForMonth, rateForMonth, type YearPath } from "./macro";
import { annuityStep, equalPrincipalStep } from "./mortgage";

export interface MonthlyRow {
  month: number;
  year: number;
  cpi: number;
  loanRate: number;
  buyCf: number;
  rentCf: number;
  buyBalance: number;
  rentMonthly: number;
}

export function buildBuyCashflows(
  inputs: ModelInputs,
  yearPaths: YearPath[],
  paymentType: PaymentType,
  prepay: boolean,
): { cashflows: number[]; balances: number[] } {
  const T = Math.round(inputs.compareYears * 12);
  const termMonths = inputs.termYears * 12;
  const principal0 = Math.max(0, inputs.homePrice - inputs.downPayment);
  const cashflows: number[] = Array(T).fill(0);
  const balances: number[] = Array(T).fill(0);

  let balance = principal0;
  const prepayMonth = prepay ? inputs.prepayYear * 12 : -1;

  for (let m = 1; m <= T; m++) {
    let cf = 0;
    if (m === 1) {
      cf -= inputs.downPayment + inputs.renovationCost;
    }

    const annualRate = rateForMonth(yearPaths, m, inputs.startYear);
    const remainingLoanMonths = Math.max(0, termMonths - (m - 1));

    // Regular installment every month with outstanding balance (including after partial prepay)
    if (balance > 1e-6 && remainingLoanMonths > 0 && m !== prepayMonth) {
      if (paymentType === "annuity") {
        const step = annuityStep(balance, annualRate, remainingLoanMonths);
        balance = step.nextBalance;
        cf -= step.monthlyPayment;
      } else {
        const step = equalPrincipalStep(principal0, balance, annualRate, termMonths);
        balance = step.nextBalance;
        cf -= step.monthlyPayment;
      }
    }

    // Lump-sum prepayment at configured month (full remaining or capped amount)
    if (prepay && m === prepayMonth && balance > 0) {
      const lump =
        inputs.prepayMode === "all"
          ? balance
          : Math.min(Math.max(0, inputs.prepayAmount), balance);
      cf -= lump;
      balance -= lump;
    }

    // maintenance every month while comparing as owner
    cf -= inputs.maintenanceMonthly;

    if (m === T) {
      cf += inputs.salvageValue;
    }

    cashflows[m - 1] = cf;
    balances[m - 1] = balance;
  }

  return { cashflows, balances };
}

export function buildRentCashflows(
  inputs: ModelInputs,
  yearPaths: YearPath[],
): { cashflows: number[]; rents: number[] } {
  const T = Math.round(inputs.compareYears * 12);
  const cashflows: number[] = Array(T).fill(0);
  const rents: number[] = Array(T).fill(0);

  // Same CPI path as mortgage; rent growth = rentSensitivityK * cpi
  let rent = inputs.initialMonthlyRent;
  let prevYearIndex = 0;

  for (let m = 1; m <= T; m++) {
    const yearIndex = Math.floor((m - 1) / 12);
    if (yearIndex > prevYearIndex) {
      const cpi = cpiForMonth(yearPaths, m, inputs.startYear);
      rent = rent * (1 + inputs.rentSensitivityK * cpi);
      prevYearIndex = yearIndex;
    }
    cashflows[m - 1] = -rent;
    rents[m - 1] = rent;
  }

  return { cashflows, rents };
}

export function buildMonthlyRows(
  inputs: ModelInputs,
  paymentType: PaymentType = inputs.paymentType,
  prepay: boolean = inputs.prepay,
): { rows: MonthlyRow[]; yearPaths: YearPath[]; buyCf: number[]; rentCf: number[] } {
  const yearPaths = buildYearPaths(inputs);
  const { cashflows: buyCf, balances } = buildBuyCashflows(inputs, yearPaths, paymentType, prepay);
  const { cashflows: rentCf, rents } = buildRentCashflows(inputs, yearPaths);
  const T = buyCf.length;
  const rows: MonthlyRow[] = [];
  for (let m = 1; m <= T; m++) {
    rows.push({
      month: m,
      year: inputs.startYear + Math.floor((m - 1) / 12),
      cpi: cpiForMonth(yearPaths, m, inputs.startYear),
      loanRate: rateForMonth(yearPaths, m, inputs.startYear),
      buyCf: buyCf[m - 1]!,
      rentCf: rentCf[m - 1]!,
      buyBalance: balances[m - 1]!,
      rentMonthly: rents[m - 1]!,
    });
  }
  return { rows, yearPaths, buyCf, rentCf };
}
