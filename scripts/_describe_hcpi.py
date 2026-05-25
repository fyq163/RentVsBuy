"""Print descriptive stats for all countries in the HCPI parquet."""

from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
EXCEL = ROOT / "data" / "Inflation-data.xlsx"
PARQUET = ROOT / "data" / "imf_hcpi_jpn_chn_usa.parquet"
CODES = ["JPN", "USA", "CHN", "GBR", "DEU"]
META = [
    "Country Code",
    "IMF Country Code",
    "Country",
    "Indicator Type",
    "Series Name",
]


def load() -> pd.DataFrame:
    try:
        return pd.read_parquet(PARQUET)
    except Exception:
        wide = pd.read_excel(EXCEL, sheet_name="hcpi_m")
        wide = wide[wide["Country Code"].isin(CODES)]
        time_cols = [
            c
            for c in wide.columns
            if c not in META and str(c).isdigit() and len(str(c)) == 6
        ]
        df = pd.melt(
            wide,
            id_vars=META,
            value_vars=time_cols,
            var_name="period",
            value_name="hcpi_index",
        )
        df = df.rename(columns={"Country Code": "country_code", "Country": "country"})
        df["date"] = pd.to_datetime(df["period"].astype(str), format="%Y%m")
        return df.dropna(subset=["hcpi_index"])


def report_duplicate_series(df: pd.DataFrame) -> None:
    wide = df.pivot(index="date", columns="country_code", values="hcpi_index")
    dup_pairs = []
    cols = list(wide.columns)
    for i, left in enumerate(cols):
        for right in cols[i + 1 :]:
            if wide[left].equals(wide[right]):
                dup_pairs.append((left, right))
    if dup_pairs:
        print("\nPossible source-data duplicates:")
        for left, right in dup_pairs:
            print(f"  {left} matches {right} exactly")


def main() -> None:
    df = load()
    df = df.sort_values(["country_code", "date"])
    df["yoy"] = df.groupby("country_code")["hcpi_index"].pct_change(12) * 100
    report_duplicate_series(df)

    for code in CODES:
        s = df[df["country_code"] == code]
        y = s["yoy"].dropna()
        print(
            f"\n{code} ({s['country'].iloc[0]}): "
            f"{s['date'].min().date()} .. {s['date'].max().date()}, n={len(s)}"
        )
        print(
            f"  YoY: mean={y.mean():.2f}% std={y.std():.2f}% "
            f"low={y.min():.2f}% high={y.max():.2f}%"
        )
        print(f"  YoY<0 months: {(y < 0).sum()} ({100*(y<0).mean():.1f}%)")
        print(f"  YoY<1 months: {(y < 1).sum()} ({100*(y<1).mean():.1f}%)")


if __name__ == "__main__":
    main()
