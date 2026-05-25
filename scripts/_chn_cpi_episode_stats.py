"""Stats for China CPI YoY during 2009 and 2023-2025 low-inflation episodes."""

from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
EXCEL = ROOT / "data" / "Inflation-data.xlsx"


def load_chn() -> pd.DataFrame:
    wide = pd.read_excel(EXCEL, sheet_name="hcpi_m")
    meta = [
        "Country Code",
        "IMF Country Code",
        "Country",
        "Indicator Type",
        "Series Name",
    ]
    wide = wide[wide["Country Code"] == "CHN"]
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
    df["date"] = pd.to_datetime(df["period"].astype(str), format="%Y%m")
    df = df.sort_values("date").dropna(subset=["hcpi_index"])
    df["yoy"] = df["hcpi_index"].pct_change(12) * 100
    return df


def print_stats(s: pd.DataFrame, name: str) -> None:
    x = s["yoy"].dropna()
    q = x.quantile([0.25, 0.5, 0.75])
    d0 = s["date"].min().strftime("%Y-%m")
    d1 = s["date"].max().strftime("%Y-%m")
    print(f"\n=== {name} ===")
    print(f"Months: {len(x)}  ({d0} .. {d1})")
    print(f"mean:  {x.mean():.4f}%")
    print(f"std:   {x.std():.4f}%")
    print(f"low:   {x.min():.4f}%")
    print(f"high:  {x.max():.4f}%")
    print(f"Q1:    {q[0.25]:.4f}%")
    print(f"Q2:    {q[0.50]:.4f}%  (median)")
    print(f"Q3:    {q[0.75]:.4f}%")
    print("Monthly YoY:")
    print(s[["date", "hcpi_index", "yoy"]].to_string(index=False))


def main() -> None:
    chn = load_chn()

    # 2009 contiguous YoY < 0 (9 months: 2009-02 .. 2009-10)
    ep2009 = chn[(chn["date"] >= "2009-02-01") & (chn["date"] <= "2009-10-01")]
    print_stats(ep2009, "2009 episode (9 mo, all YoY < 0)")

    # 2023 late .. 2025-03 full window
    ep_recent = chn[
        (chn["date"] >= "2023-11-01") & (chn["date"] <= "2025-03-01")
    ]
    print_stats(ep_recent, "2023-11 .. 2025-03 (full window, all months)")

    neg_recent = ep_recent[ep_recent["yoy"] < 0]
    print_stats(neg_recent, "2023-11 .. 2025-03 (YoY < 0 months only)")

    # all negative months from 2023-07 onward
    neg_all = chn[(chn["date"] >= "2023-07-01") & (chn["yoy"] < 0)]
    print("\n=== All CHN YoY < 0 from 2023-07 ===")
    print(neg_all[["date", "yoy"]].to_string(index=False))

    # reference: historical minimum YoY
    print(f"\nHistorical CHN YoY low (full sample): {chn['yoy'].min():.4f}%")
    print(f"  at {chn.loc[chn['yoy'].idxmin(), 'date'].strftime('%Y-%m')}")


if __name__ == "__main__":
    main()
