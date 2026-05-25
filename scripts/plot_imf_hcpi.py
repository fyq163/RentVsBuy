"""Plot IMF HCPI index and YoY inflation for JPN / USA / CHN / GBR / DEU."""

from pathlib import Path

import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
PARQUET = ROOT / "data" / "imf_hcpi_jpn_chn_usa.parquet"
EXCEL = ROOT / "data" / "Inflation-data.xlsx"
FIG_DIR = ROOT / "figures"

COUNTRY_CODES = ["JPN", "USA", "CHN", "GBR", "DEU"]
LABELS = {
    "JPN": "Japan",
    "USA": "United States",
    "CHN": "China",
    "GBR": "United Kingdom",
    "DEU": "Germany",
}
COLORS = {
    "JPN": "#c0392b",
    "USA": "#2980b9",
    "CHN": "#27ae60",
    "GBR": "#8e44ad",
    "DEU": "#d35400",
}


def load_data() -> pd.DataFrame:
    try:
        return pd.read_parquet(PARQUET)
    except Exception:
        wide = pd.read_excel(EXCEL, sheet_name="hcpi_m")
        meta = [
            "Country Code",
            "IMF Country Code",
            "Country",
            "Indicator Type",
            "Series Name",
        ]
        wide = wide[wide["Country Code"].isin(COUNTRY_CODES)]
        time_cols = [
            c
            for c in wide.columns
            if c not in meta and str(c).isdigit() and len(str(c)) == 6
        ]
        df = pd.melt(
            wide,
            id_vars=meta,
            value_vars=time_cols,
            var_name="period",
            value_name="hcpi_index",
        )
        df = df.rename(columns={"Country Code": "country_code", "Country": "country"})
        df["date"] = pd.to_datetime(df["period"].astype(str), format="%Y%m")
        return df.dropna(subset=["hcpi_index"])


def prepare_series(df: pd.DataFrame) -> pd.DataFrame:
    out = df.sort_values(["country_code", "date"]).copy()
    out["inflation_yoy"] = (
        out.groupby("country_code")["hcpi_index"].pct_change(12) * 100
    )
    out["cpi_rebased"] = out.groupby("country_code")["hcpi_index"].transform(
        lambda s: s / s.iloc[0] * 100
    )
    return out


def style_axes(ax, title: str, ylabel: str) -> None:
    ax.set_title(title, fontsize=13, fontweight="bold")
    ax.set_ylabel(ylabel)
    ax.set_xlabel("Year")
    ax.grid(True, alpha=0.3, linestyle="--")
    ax.xaxis.set_major_locator(mdates.YearLocator(5))
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
    ax.legend(loc="upper left", framealpha=0.9, fontsize=9, ncol=2)


def plot_inflation(df: pd.DataFrame, path: Path) -> None:
    fig, ax = plt.subplots(figsize=(13, 6))
    for code in COUNTRY_CODES:
        s = df[df["country_code"] == code]
        if s.empty:
            continue
        ax.plot(
            s["date"],
            s["inflation_yoy"],
            label=LABELS[code],
            color=COLORS[code],
            linewidth=1.1,
            alpha=0.9,
        )
    ax.axhline(0, color="#555", linewidth=0.8, linestyle="-")
    ax.axhline(1, color="#999", linewidth=0.8, linestyle=":", label="1% threshold")
    style_axes(
        ax,
        "Headline CPI YoY Inflation (JPN / USA / CHN / GBR / DEU)",
        "Year-on-year change (%)",
    )
    fig.tight_layout()
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)


def plot_cpi_index(df: pd.DataFrame, path: Path) -> None:
    fig, ax = plt.subplots(figsize=(13, 6))
    for code in COUNTRY_CODES:
        s = df[df["country_code"] == code]
        if s.empty:
            continue
        ax.plot(
            s["date"],
            s["cpi_rebased"],
            label=f"{LABELS[code]} (rebased=100)",
            color=COLORS[code],
            linewidth=1.1,
            alpha=0.9,
        )
    style_axes(
        ax,
        "Headline CPI Index — Rebased to 100 at Series Start",
        "Index (first month = 100)",
    )
    fig.tight_layout()
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)


def main() -> None:
    FIG_DIR.mkdir(parents=True, exist_ok=True)
    df = prepare_series(load_data())

    inflation_path = FIG_DIR / "imf_hcpi_inflation_yoy.png"
    index_path = FIG_DIR / "imf_hcpi_index_rebased.png"

    plot_inflation(df, inflation_path)
    plot_cpi_index(df, index_path)

    print(f"Wrote {inflation_path}")
    print(f"Wrote {index_path}")


if __name__ == "__main__":
    main()
