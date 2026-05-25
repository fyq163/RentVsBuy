"""Analyze deflation / low-inflation episodes in imf_hcpi_jpn_chn_usa.parquet.

Thresholds:
  - strict: YoY < 0%
  - low:    YoY < 1%  (near-deflation / disinflation)
"""

from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
PARQUET = ROOT / "data" / "imf_hcpi_jpn_chn_usa.parquet"
EXCEL = ROOT / "data" / "Inflation-data.xlsx"
COUNTRY_CODES = ["JPN", "USA", "CHN", "GBR", "DEU"]

COUNTRIES = [
    ("JPN", "Japan"),
    ("USA", "United States"),
    ("CHN", "China"),
    ("GBR", "United Kingdom"),
    ("DEU", "Germany"),
]


def find_episodes(dates, mask, label: str) -> list[dict]:
    s = pd.DataFrame({"date": dates, "hit": mask}).reset_index(drop=True)
    s["grp"] = (s["hit"] != s["hit"].shift()).cumsum()
    episodes = []
    for _, gdf in s[s["hit"]].groupby("grp"):
        episodes.append(
            {
                "label": label,
                "start": gdf["date"].min(),
                "end": gdf["date"].max(),
                "months": len(gdf),
            }
        )
    return episodes


def months_to_positive_after(end: pd.Timestamp, dates, yoy, threshold: float = 0.0) -> int | None:
    sub = pd.DataFrame({"date": dates, "yoy": yoy})
    sub = sub[sub["date"] > end]
    pos = sub[sub["yoy"] > threshold]
    if pos.empty:
        return None
    return (pos.iloc[0]["date"].to_period("M") - end.to_period("M")).n


def months_to_12_positive(end: pd.Timestamp, dates, yoy, threshold: float = 0.0) -> int | None:
    sub = pd.DataFrame({"date": dates, "yoy": yoy}).reset_index(drop=True)
    sub = sub[sub["date"] > end].copy()
    sub["ok"] = sub["yoy"] > threshold
    run = 0
    for _, row in sub.iterrows():
        if row["ok"]:
            run += 1
            if run >= 12:
                return (row["date"].to_period("M") - end.to_period("M")).n
        else:
            run = 0
    return None


def analyze_country(code: str, name: str, yoy: pd.Series, dates: pd.Series) -> None:
    print(f"\n{'=' * 60}")
    print(f"{name} ({code})")
    print("=" * 60)

    for label, thresh, mask in [
        ("strict deflation (YoY < 0%)", 0.0, yoy < 0),
        ("low inflation (YoY < 1%)", 1.0, yoy < 1),
    ]:
        n = mask.sum()
        pct = 100 * mask.mean()
        print(f"\n--- {label} ---")
        print(f"Months: {n} / {len(yoy)} ({pct:.1f}%)")
        print(f"Mean YoY when active: {yoy[mask].mean():.2f}%")

        eps = find_episodes(dates, mask, label)
        print(f"Contiguous episodes: {len(eps)}")
        for i, e in enumerate(eps):
            print(
                f"  #{i+1}: {e['start'].strftime('%Y-%m')} .. "
                f"{e['end'].strftime('%Y-%m')} ({e['months']} mo)"
            )
        if eps:
            longest = max(eps, key=lambda x: x["months"])
            print(
                f"  Longest: {longest['start'].strftime('%Y-%m')} .. "
                f"{longest['end'].strftime('%Y-%m')} ({longest['months']} mo)"
            )
            first6 = next((e for e in eps if e["months"] >= 6), None)
            if first6:
                print(
                    f"  First >=6 mo: {first6['start'].strftime('%Y-%m')} .. "
                    f"{first6['end'].strftime('%Y-%m')}"
                )

    # Decade shares for YoY < 1%
    print("\n--- By decade (YoY < 1%) ---")
    df = pd.DataFrame({"date": dates, "yoy": yoy})
    df["decade"] = (df["date"].dt.year // 10) * 10
    for decade, g in df.groupby("decade"):
        if pd.isna(g["yoy"]).all():
            continue
        low = (g["yoy"] < 1).mean() * 100
        strict = (g["yoy"] < 0).mean() * 100
        print(
            f"  {decade}s: low={low:.0f}% months, strict={strict:.0f}%, "
            f"mean YoY={g['yoy'].mean():.2f}%"
        )

    # Recovery after longest low-inflation episode
    low_mask = yoy < 1
    eps = find_episodes(dates, low_mask, "low")
    if not eps:
        return
    longest = max(eps, key=lambda x: x["months"])
    end = longest["end"]
    m1 = months_to_positive_after(end, dates, yoy, threshold=1.0)
    m12 = months_to_12_positive(end, dates, yoy, threshold=1.0)
    print(f"\n--- Recovery after longest YoY<1% episode ({end.strftime('%Y-%m')}) ---")
    print(f"  First month YoY >= 1%: +{m1} months" if m1 is not None else "  Never reached YoY >= 1%")
    print(
        f"  First 12 consecutive months YoY >= 1%: +{m12} months"
        if m12 is not None
        else "  Never had 12 consecutive months YoY >= 1%"
    )

    print("\nLowest YoY months:")
    tmp = pd.DataFrame({"date": dates, "yoy": yoy})
    print(tmp.nsmallest(6, "yoy").to_string(index=False))


def load_data() -> pd.DataFrame:
    try:
        df = pd.read_parquet(PARQUET)
        print(f"Source: {PARQUET}")
        return df
    except Exception as exc:
        print(f"Parquet read failed ({exc}); loading from Excel...")
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
        df = df.rename(
            columns={
                "Country Code": "country_code",
                "Country": "country",
            }
        )
        df["date"] = pd.to_datetime(df["period"].astype(str), format="%Y%m")
        df = df.dropna(subset=["hcpi_index"])
        print(f"Source: {EXCEL} (sheet hcpi_m)")
        return df


def main() -> None:
    df = load_data()
    print(f"Rows: {len(df)}, cols: {list(df.columns)}")

    for code, name in COUNTRIES:
        s = df[df["country_code"] == code].sort_values("date").copy()
        s["yoy"] = s["hcpi_index"].pct_change(12) * 100
        analyze_country(code, name, s["yoy"], s["date"])


if __name__ == "__main__":
    main()
