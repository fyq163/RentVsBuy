import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Legend,
  Tooltip,
  Filler,
  type ChartConfiguration,
} from "chart.js";
import type { RunResult } from "./model/run";
import { formatPct } from "./format";

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Legend,
  Tooltip,
  Filler,
);

let fvChart: Chart | null = null;
let rateChart: Chart | null = null;

function yearlySample<T>(arr: T[], every = 12): T[] {
  const out: T[] = [];
  for (let i = every - 1; i < arr.length; i += every) out.push(arr[i]!);
  if (arr.length && (arr.length % every !== 0 || out.length === 0)) {
    out.push(arr[arr.length - 1]!);
  }
  return out;
}

export function renderCharts(result: RunResult, fvCanvas: HTMLCanvasElement, rateCanvas: HTMLCanvasElement) {
  const years = yearlySample(
    result.buyCumFv.map((_, i) => Math.ceil((i + 1) / 12)),
  );
  const buyY = yearlySample(result.buyCumFv).map((v) => v / 10_000);
  const rentY = yearlySample(result.rentCumFv).map((v) => v / 10_000);

  const fvConfig: ChartConfiguration<"line"> = {
    type: "line",
    data: {
      labels: years.map((y) => `Y${y}`),
      datasets: [
        {
          label: "买房累计 FV（万）",
          data: buyY,
          borderColor: "#1a5f4a",
          backgroundColor: "rgba(26,95,74,0.08)",
          tension: 0.2,
          pointRadius: 0,
          borderWidth: 2,
        },
        {
          label: "租房累计 FV（万）",
          data: rentY,
          borderColor: "#b45309",
          backgroundColor: "rgba(180,83,9,0.06)",
          tension: 0.2,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 8, right: 12, bottom: 4, left: 4 } },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 12 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.parsed.y).toFixed(1)} 万`,
          },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          ticks: {
            callback: (v) => `${v}`,
          },
          title: { display: true, text: "累计终值（万元）" },
        },
      },
    },
  };

  if (fvChart) fvChart.destroy();
  fvChart = new Chart(fvCanvas, fvConfig);

  const rateConfig: ChartConfiguration<"line"> = {
    type: "line",
    data: {
      labels: result.yearPaths.map((y) => String(y.year)),
      datasets: [
        {
          label: "CPI",
          data: result.yearPaths.map((y) => y.cpi * 100),
          borderColor: "#0f766e",
          tension: 0.25,
          pointRadius: 2,
          borderWidth: 2,
        },
        {
          label: "房贷利率",
          data: result.yearPaths.map((y) => y.loanRate * 100),
          borderColor: "#9f1239",
          tension: 0.25,
          pointRadius: 2,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 8, right: 12, bottom: 4, left: 4 } },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12 } },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatPct(Number(ctx.parsed.y) / 100)}`,
          },
        },
      },
      scales: {
        y: { title: { display: true, text: "%" } },
      },
    },
  };

  if (rateChart) rateChart.destroy();
  rateChart = new Chart(rateCanvas, rateConfig);
}
