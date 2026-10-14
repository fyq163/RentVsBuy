/** Defaults mirrored from root config.yaml — browser-only, no Python. */

export type PaymentType = "annuity" | "equal_principal";
export type CpiMethod = "piecewise" | "flat";
/** all = 还清当时剩余本金；amount = 按 prepayAmount 部分提前还 */
export type PrepayMode = "all" | "amount";

export interface ModelInputs {
  homePrice: number;
  downPayment: number;
  renovationCost: number;
  maintenanceMonthly: number;
  salvageValue: number;
  initialMonthlyRent: number;
  termYears: number;
  compareYears: number;
  prepayYear: number;
  prepay: boolean;
  prepayMode: PrepayMode;
  /** 指定提前还款金额（CNY）；仅 prepayMode=amount 时生效，且不超过当时剩余本金 */
  prepayAmount: number;
  paymentType: PaymentType;
  initialRate: number;
  /** 房贷利率对路径 CPI 的敏感度：rate = initial + k_rate * (cpi - anchor) */
  rateSensitivityK: number;
  /** 房租对路径 CPI 的敏感度：年增 = k_rent * cpi */
  rentSensitivityK: number;
  rateFloor: number;
  /** @deprecated 已由 rateCpiAnchor 兼任折现率；保留字段仅兼容旧状态 */
  discountRate: number;
  cpiMethod: CpiMethod;
  /** Flat 模式：路径上每一年的 CPI（租金与房贷共用） */
  flatCpi: number;
  /**
   * 中性锚定 CPI：兼任 (1) Flat 模式下房贷利率锚
   * (2) 全模式终值复利 / 残值 PV 折现率
   */
  rateCpiAnchor: number;
  startYear: number;
  dipYears: number;
  dipMinRate: number;
  recoveryYears: number;
  recoveryTargetRate: number;
  /** Piecewise 模式：下跌/复苏结束后的长期稳态 CPI（不影响 Flat） */
  longTermMean: number;
}

export const DEFAULTS: ModelInputs = {
  homePrice: 6_300_000,
  downPayment: 2_500_000,
  renovationCost: 300_000,
  maintenanceMonthly: 250,
  salvageValue: 2_000_000,
  initialMonthlyRent: 10_000,
  termYears: 30,
  compareYears: 30,
  prepayYear: 10,
  prepay: true,
  prepayMode: "all",
  prepayAmount: 1_000_000,
  paymentType: "annuity",
  initialRate: 0.0305,
  rateSensitivityK: 1.0,
  rentSensitivityK: 1.0,
  rateFloor: 0.01,
  discountRate: 0.02,
  cpiMethod: "piecewise",
  flatCpi: 0.019,
  rateCpiAnchor: 0.02,
  startYear: 2023,
  dipYears: 5,
  dipMinRate: -0.0179,
  recoveryYears: 7,
  recoveryTargetRate: 0.02,
  longTermMean: 0.019,
};

export const SCENARIOS = [
  { id: "s1_prepay_annuity", name: "提前还款 · 等额本息", prepay: true, paymentType: "annuity" as PaymentType },
  { id: "s2_prepay_equal_principal", name: "提前还款 · 等额本金", prepay: true, paymentType: "equal_principal" as PaymentType },
  { id: "s3_no_prepay_annuity", name: "不提前还款 · 等额本息", prepay: false, paymentType: "annuity" as PaymentType },
  { id: "s4_no_prepay_equal_principal", name: "不提前还款 · 等额本金", prepay: false, paymentType: "equal_principal" as PaymentType },
] as const;
