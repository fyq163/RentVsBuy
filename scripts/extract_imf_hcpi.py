"""Extract headline CPI (hcpi_m) for JPN/CHN/USA/GBR/DEU to long Parquet."""

from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "Inflation-data.xlsx"
OUT = ROOT / "data" / "imf_hcpi_jpn_chn_usa.parquet"

COUNTRIES = ["JPN", "CHN", "USA", "GBR", "DEU"]
META = [
    "Country Code",
    "IMF Country Code",
    "Country",
    "Indicator Type",
    "Series Name",
]


def is_period_col(col) -> bool:
    s = str(col)
    return s.isdigit() and len(s) == 6


def main() -> None:
    wide = pd.read_excel(SRC, sheet_name="hcpi_m")
    wide = wide[wide["Country Code"].isin(COUNTRIES)].copy()

    time_cols = [c for c in wide.columns if c not in META and is_period_col(c)]
    long = pd.melt(
        wide,
        id_vars=META,
        value_vars=time_cols,
        var_name="period",
        value_name="hcpi_index",
    )

    long["period"] = long["period"].astype(str)
    long["date"] = pd.to_datetime(long["period"], format="%Y%m")
    long = long.dropna(subset=["hcpi_index"])
    long["freq"] = "M"

    long = long.rename(
        columns={
            "Country Code": "country_code",
            "IMF Country Code": "imf_country_code",
            "Country": "country",
            "Indicator Type": "indicator_type",
            "Series Name": "series_name",
        }
    )

    cols = [
        "country_code",
        "imf_country_code",
        "country",
        "indicator_type",
        "series_name",
        "period",
        "date",
        "hcpi_index",
        "freq",
    ]
    long = long[cols].sort_values(["country_code", "date"]).reset_index(drop=True)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    try:
        long.to_parquet(OUT, index=False)
    except ImportError:
        import fastparquet  # noqa: F401

        long.to_parquet(OUT, index=False, engine="fastparquet")

    print(f"Wrote {OUT} ({len(long)} rows)")
    for code in COUNTRIES:
        sub = long[long["country_code"] == code]
        print(
            f"  {code}: n={len(sub)}, "
            f"date={sub['date'].min().date()} .. {sub['date'].max().date()}"
        )
    print(long.groupby("country_code")["hcpi_index"].describe().round(2))


if __name__ == "__main__":
    main()
