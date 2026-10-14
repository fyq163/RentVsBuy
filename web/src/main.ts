import "./style.css";
import {
  DEFAULTS,
  type ModelInputs,
  type CpiMethod,
  type PaymentType,
  type PrepayMode,
} from "./defaults";
import { runModel, type RunResult } from "./model/run";
import { formatCny, formatPct, formatFvWithPv, fvToPv } from "./format";
import { renderCharts } from "./charts";

const state: ModelInputs = { ...DEFAULTS };

type NumKey = {
  [K in keyof ModelInputs]: ModelInputs[K] extends number ? K : never;
}[keyof ModelInputs];

function setNum(key: NumKey, value: number) {
  state[key] = value;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) node.append(typeof c === "string" ? document.createTextNode(c) : c);
  return node;
}

type SliderKind = "money" | "pct" | "num";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function sliderField(
  key: NumKey,
  label: string,
  min: number,
  max: number,
  step: number,
  kind: SliderKind,
  onChange: () => void,
  formatExtra?: (n: number) => string,
  /** Optional external label node (e.g. salvage FV/PV); otherwise auto-format. */
  externalLabel?: HTMLElement,
): HTMLElement {
  const wrap = el("div", { class: "field" });
  const valueLabel =
    externalLabel ??
    el("strong", {}, [
      kind === "money"
        ? formatCny(state[key])
        : kind === "pct"
          ? formatPct(state[key])
          : (formatExtra?.(state[key]) ?? String(state[key])),
    ]);
  const lab = el("label", {}, [label, valueLabel]);

  const range = el("input", {
    type: "range",
    min: String(min),
    max: String(max),
    step: String(step),
    value: String(state[key]),
  }) as HTMLInputElement;

  const toBox = (model: number): string => {
    if (kind === "pct") {
      const digits = step < 0.001 ? 3 : 2;
      return (model * 100).toFixed(digits);
    }
    if (kind === "money") return String(Math.round(model));
    if (formatExtra) return formatExtra(model);
    return String(model);
  };

  const fromBox = (raw: string): number | null => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return kind === "pct" ? n / 100 : n;
  };

  const box = el("input", {
    type: "number",
    class: "num-input",
    min: kind === "pct" ? String(min * 100) : String(min),
    max: kind === "pct" ? String(max * 100) : String(max),
    step: kind === "pct" ? String(step * 100) : String(step),
    value: toBox(state[key]),
  }) as HTMLInputElement;
  if (kind === "pct") box.title = "单位：%";
  if (kind === "money") box.title = "单位：元";

  const syncLabel = () => {
    if (externalLabel) return;
    valueLabel.textContent =
      kind === "money"
        ? formatCny(state[key])
        : kind === "pct"
          ? formatPct(state[key])
          : (formatExtra?.(state[key]) ?? String(state[key]));
  };

  const apply = (model: number) => {
    const v = clamp(model, min, max);
    setNum(key, v);
    range.value = String(v);
    box.value = toBox(v);
    syncLabel();
    onChange();
  };

  range.addEventListener("input", () => apply(Number(range.value)));
  box.addEventListener("change", () => {
    const parsed = fromBox(box.value);
    if (parsed === null) {
      box.value = toBox(state[key]);
      return;
    }
    apply(parsed);
  });
  box.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      box.blur();
    }
  });

  const edit = el("div", { class: "num-edit" }, [box]);
  if (kind === "pct") edit.append(el("span", { class: "unit" }, ["%"]));
  else if (kind === "money") edit.append(el("span", { class: "unit" }, ["元"]));

  wrap.append(lab, el("div", { class: "slider-row" }, [range, edit]));
  return wrap;
}

function moneyField(
  key: NumKey,
  label: string,
  min: number,
  max: number,
  step: number,
  onChange: () => void,
): HTMLElement {
  return sliderField(key, label, min, max, step, "money", onChange);
}

function pctField(
  key: NumKey,
  label: string,
  min: number,
  max: number,
  step: number,
  onChange: () => void,
): HTMLElement {
  return sliderField(key, label, min, max, step, "pct", onChange);
}

function numField(
  key: NumKey,
  label: string,
  min: number,
  max: number,
  step: number,
  onChange: () => void,
  format: (n: number) => string = (n) => String(n),
): HTMLElement {
  return sliderField(key, label, min, max, step, "num", onChange, format);
}

function selectField<T extends string>(
  label: string,
  options: { value: T; text: string }[],
  current: T,
  onPick: (v: T) => void,
): HTMLElement {
  const wrap = el("div", { class: "field" });
  wrap.append(el("label", {}, [label]));
  const sel = el("select", {}) as HTMLSelectElement;
  for (const o of options) {
    const opt = el("option", { value: o.value }, [o.text]) as HTMLOptionElement;
    if (o.value === current) opt.selected = true;
    sel.append(opt);
  }
  sel.addEventListener("change", () => onPick(sel.value as T));
  wrap.append(sel);
  return wrap;
}

const app = document.querySelector<HTMLDivElement>("#app")!;

const kpiBuy = el("div", { class: "value" }, ["—"]);
const kpiRent = el("div", { class: "value" }, ["—"]);
const kpiPremium = el("div", { class: "value" }, ["—"]);
const kpiDelta = el("div", { class: "value" }, ["—"]);
const premiumCard = el("div", { class: "kpi premium" }, [
  el("div", { class: "label" }, ["溢价 (买 − 租)"]),
  kpiPremium,
]);
const crossNote = el("p", { class: "note" }, [""]);
const scenarioBody = el("tbody");
const fvCanvas = el("canvas") as HTMLCanvasElement;
const rateCanvas = el("canvas") as HTMLCanvasElement;

function formatSalvageFvPv(fv: number, annualRate: number, years: number): string {
  return `FV ${formatCny(fv)}（PV 相当于 ${formatCny(fvToPv(fv, annualRate, years))}）`;
}

const salvageValueLabel = el("strong", {}, [
  formatSalvageFvPv(state.salvageValue, state.rateCpiAnchor, state.compareYears),
]);

function refresh() {
  state.discountRate = state.rateCpiAnchor;
  const r = state.rateCpiAnchor;
  const years = state.compareYears;
  salvageValueLabel.textContent = formatSalvageFvPv(state.salvageValue, r, years);

  const result: RunResult = runModel(state);
  kpiBuy.textContent = formatFvWithPv(result.fvBuy, r, years);
  kpiRent.textContent = formatFvWithPv(result.fvRent, r, years);
  kpiPremium.textContent = formatFvWithPv(result.premium, r, years, true);
  kpiDelta.textContent = formatFvWithPv(result.deltaPremiumVsDefaultSalvage, r, years, true);
  premiumCard.classList.toggle("neg", result.premium < 0);

  if (result.cross) {
    const dir =
      result.cross.direction === "buy_overtakes" ? "买房累计 FV 反超租房" : "租房累计 FV 反超买房";
    crossNote.innerHTML = `交叉：约第 <strong>${result.cross.year}</strong> 年（第 ${result.cross.month} 月）${dir}。`;
  } else {
    crossNote.textContent = "对比期内累计 FV 路径未交叉。";
  }

  scenarioBody.replaceChildren();
  for (const s of result.scenarios) {
    const tr = el("tr", {}, [
      el("td", {}, [s.name]),
      el("td", { class: "num" }, [formatFvWithPv(s.fvBuy, r, years)]),
      el("td", { class: "num" }, [formatFvWithPv(s.fvRent, r, years)]),
      el("td", { class: "num" }, [formatFvWithPv(s.premium, r, years, true)]),
    ]);
    scenarioBody.append(tr);
  }

  renderCharts(result, fvCanvas, rateCanvas);
}

const piecewiseBlock = el("div", { class: "controls" });
const flatBlock = el("div", { class: "controls" });
const cpiHint = el("p", { class: "field-hint" }, [""]);

function syncPathVisibility() {
  piecewiseBlock.hidden = state.cpiMethod !== "piecewise";
  flatBlock.hidden = state.cpiMethod !== "flat";
  cpiHint.textContent =
    state.cpiMethod === "piecewise"
      ? "租金与房贷共用这条 CPI 路径；敏感度 k 在「更多假设」里调。"
      : "每年同一 CPI，租金与房贷共用；敏感度 k 在「更多假设」里调。";
}

const loanPrincipalLabel = el("strong", {}, [
  formatCny(Math.max(0, state.homePrice - state.downPayment)),
]);

function updateLoanPrincipalLabel() {
  loanPrincipalLabel.textContent = formatCny(Math.max(0, state.homePrice - state.downPayment));
}

const prepayAmountField = moneyField(
  "prepayAmount",
  "提前还多少",
  0,
  8_000_000,
  50_000,
  refresh,
);
const prepayDetailBlock = el("div", { class: "controls" }, [
  numField("prepayYear", "提前还款年份", 1, 30, 1, refresh),
  selectField<PrepayMode>(
    "提前还款方式",
    [
      { value: "all", text: "还清当时剩余本金" },
      { value: "amount", text: "指定金额" },
    ],
    state.prepayMode,
    (v) => {
      state.prepayMode = v;
      prepayAmountField.hidden = v !== "amount";
      refresh();
    },
  ),
  prepayAmountField,
]);

function syncPrepayVisibility() {
  prepayDetailBlock.hidden = !state.prepay;
  prepayAmountField.hidden = !state.prepay || state.prepayMode !== "amount";
}

function onHomeChange() {
  updateLoanPrincipalLabel();
  refresh();
}

const controls = el("div", { class: "controls" }, [
  el("h2", {}, ["我的房子"]),
  moneyField("homePrice", "房屋总价", 1_000_000, 20_000_000, 100_000, onHomeChange),
  moneyField("downPayment", "首付", 0, 10_000_000, 50_000, onHomeChange),
  el("div", { class: "field readonly" }, [
    el("label", {}, ["贷款本金（总价 − 首付）", loanPrincipalLabel]),
  ]),
  moneyField("initialMonthlyRent", "同房型初始月租", 1000, 50_000, 500, refresh),
  moneyField("renovationCost", "装修（t0）", 0, 2_000_000, 10_000, refresh),

  el("h2", {}, ["残值与宏观"]),
  sliderField(
    "salvageValue",
    "期末残值（disposal）",
    0,
    8_000_000,
    50_000,
    "money",
    refresh,
    undefined,
    salvageValueLabel,
  ),
  pctField("rateCpiAnchor", "中性锚定 CPI（= 折现率；Flat 时兼利率锚）", -0.01, 0.06, 0.0001, refresh),
  selectField<CpiMethod>(
    "CPI 投影方式",
    [
      { value: "piecewise", text: "路径：下跌 → 复苏 → 长期稳态" },
      { value: "flat", text: "恒定：每年同一 CPI" },
    ],
    state.cpiMethod,
    (v) => {
      state.cpiMethod = v;
      syncPathVisibility();
      refresh();
    },
  ),
  cpiHint,
  piecewiseBlock,
  flatBlock,
  pctField("initialRate", "初始房贷利率", 0.01, 0.08, 0.0005, refresh),

  el("h2", {}, ["提前还款"]),
  selectField<"true" | "false">(
    "是否提前还款",
    [
      { value: "true", text: "是" },
      { value: "false", text: "否" },
    ],
    state.prepay ? "true" : "false",
    (v) => {
      state.prepay = v === "true";
      syncPrepayVisibility();
      refresh();
    },
  ),
  prepayDetailBlock,

  el("details", { class: "advanced" }, [
    el("summary", {}, ["更多假设"]),
    el("div", { class: "controls" }, [
      numField("rateSensitivityK", "利率对 CPI 敏感度 k", 0, 3, 0.05, refresh, (n) => n.toFixed(2)),
      numField("rentSensitivityK", "房租对 CPI 敏感度 k", 0, 3, 0.05, refresh, (n) => n.toFixed(2)),
      moneyField("maintenanceMonthly", "月修缮", 0, 5000, 50, refresh),
      numField("compareYears", "对比年数", 5, 30, 1, refresh),
      selectField<PaymentType>(
        "还款方式",
        [
          { value: "annuity", text: "等额本息" },
          { value: "equal_principal", text: "等额本金" },
        ],
        state.paymentType,
        (v) => {
          state.paymentType = v;
          refresh();
        },
      ),
    ]),
  ]),
]);

piecewiseBlock.append(
  numField("dipYears", "下跌年数", 1, 15, 1, refresh),
  pctField("dipMinRate", "下跌极值 CPI", -0.05, 0.02, 0.0001, refresh),
  numField("recoveryYears", "复苏年数", 1, 15, 1, refresh),
  pctField("recoveryTargetRate", "复苏终点 CPI", -0.01, 0.06, 0.0001, refresh),
  pctField("longTermMean", "长期稳态 CPI（路径末端）", -0.01, 0.06, 0.0001, refresh),
);

flatBlock.append(pctField("flatCpi", "每年 CPI（租金与房贷共用）", -0.03, 0.06, 0.0001, refresh));

app.append(
  el("header", { class: "hero" }, [
    el("h1", { class: "brand" }, ["Rent vs Buy"]),
    el("p", { class: "tagline" }, [
      "纯前端终值对比：拖动残值与利率投影参数，在本机浏览器即时重算。溢价 = 买房 FV − 租房 FV。",
    ]),
  ]),
  el("div", { class: "layout" }, [
    el("aside", { class: "panel controls-panel" }, [
      controls,
      // Spacer so the last controls (e.g. 还款方式) can scroll up to the panel top.
      el("div", { class: "controls-spacer", "aria-hidden": "true" }),
    ]),
    el("main", { class: "results" }, [
      el("div", { class: "kpis" }, [
        el("div", { class: "kpi" }, [el("div", { class: "label" }, ["买房 FV"]), kpiBuy]),
        el("div", { class: "kpi" }, [el("div", { class: "label" }, ["租房 FV"]), kpiRent]),
        premiumCard,
        el("div", { class: "kpi" }, [
          el("div", { class: "label" }, ["Δ溢价 vs 默认残值"]),
          kpiDelta,
        ]),
      ]),
      crossNote,
      el("section", { class: "panel chart-panel" }, [
        el("h2", {}, ["累计终值路径"]),
        el("div", { class: "chart-box" }, [fvCanvas]),
      ]),
      el("section", { class: "panel chart-panel" }, [
        el("h2", {}, ["CPI / 房贷利率路径"]),
        el("div", { class: "chart-box" }, [rateCanvas]),
      ]),
      el("section", { class: "panel" }, [
        el("h2", {}, ["四情景溢价一览"]),
        el("div", { class: "table-wrap" }, [
          el("table", {}, [
            el("thead", {}, [
              el("tr", {}, [
                el("th", {}, ["情景"]),
                el("th", {}, ["买房 FV"]),
                el("th", {}, ["租房 FV"]),
                el("th", {}, ["溢价"]),
              ]),
            ]),
            scenarioBody,
          ]),
        ]),
      ]),
      el("p", { class: "foot" }, [
        "计算全部在浏览器本地完成，无服务端。终值按月复利滚到对比期末；支出为负、残值回收为正。",
      ]),
    ]),
  ]),
);

syncPathVisibility();
syncPrepayVisibility();
refresh();
