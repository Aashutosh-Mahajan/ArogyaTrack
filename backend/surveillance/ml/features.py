"""Causal daily features. This module is used unchanged offline and by Django.

Absent observations remain missing: neither suppressed reports nor gaps are zeros.
All baseline/lag features exclude the current case count. No outbreak labels enter X.
"""
import numpy as np
import pandas as pd

SCHEMA_VERSION = "daily-causal-v2"
ENVIRONMENT = ["temperature_celsius", "humidity_percent", "rainfall_mm", "aqi", "water_quality_index"]
NUMERIC = ["case_count", "severity_avg", "month_sin", "month_cos", "week_sin", "week_cos",
           "day_of_week", "is_monsoon", "population_log", "population_density", "sanitation_index",
           "hospital_count", "cases_per_100k", "observed_28", "history_days", "growth_7", "zscore_28"]
NUMERIC += [f"cases_lag_{n}" for n in (1, 7, 14, 28)]
NUMERIC += [f"cases_{stat}_{n}" for n in (7, 14, 28) for stat in ("mean", "std", "max")]
NUMERIC += ENVIRONMENT + [f"{name}_missing" for name in ENVIRONMENT]
NUMERIC += ["rainfall_prior_7", "severity_prior_7"]
NUMERIC += ["seasonal_month_median", "seasonal_ratio", "prior_year_mean", "prior_year_ratio", "latitude", "longitude"]


def prepare_daily(cases, regions, environment):
    """Merge real daily observations, preserving calendar gaps and source labels."""
    cases = cases.copy()
    cases["date"] = pd.to_datetime(cases["date"]).dt.normalize()
    if cases.duplicated(["region_id", "disease_code", "date"]).any():
        raise ValueError("Duplicate region/disease/date observations; aggregate upstream")
    if (cases.case_count < 0).any() or not np.isfinite(cases.case_count.dropna()).all():
        raise ValueError("Case counts must be finite and nonnegative")
    pieces = []
    for (rid, disease), group in cases.groupby(["region_id", "disease_code"], sort=False):
        group = group.set_index("date").sort_index()
        group = group.reindex(pd.date_range(group.index.min(), group.index.max(), freq="D"))
        group.index.name = "date"
        group["region_id"], group["disease_code"] = rid, disease
        pieces.append(group.reset_index())
    if not pieces:
        raise ValueError("No surveillance observations")
    daily = pd.concat(pieces, ignore_index=True)
    daily["observed"] = daily.case_count.notna().astype(int)
    daily = daily.merge(regions, on="region_id", how="left", validate="many_to_one")
    env = environment.copy()
    if not env.empty:
        env["date"] = pd.to_datetime(env["date"]).dt.normalize()
        daily = daily.merge(env[["region_id", "date"] + [c for c in ENVIRONMENT if c in env]],
                            on=["region_id", "date"], how="left", validate="many_to_one")
    for c in ENVIRONMENT:
        if c not in daily:
            daily[c] = np.nan
    return daily.sort_values(["region_id", "disease_code", "date"]).reset_index(drop=True)


def build_features(daily, disease_codes):
    df = daily.copy()
    grp = df.groupby(["region_id", "disease_code"], sort=False)
    date = pd.to_datetime(df.date)
    month = date.dt.month
    week = date.dt.isocalendar().week.astype(int)
    df["month_sin"], df["month_cos"] = np.sin(2*np.pi*month/12), np.cos(2*np.pi*month/12)
    df["week_sin"], df["week_cos"] = np.sin(2*np.pi*week/52), np.cos(2*np.pi*week/52)
    df["day_of_week"], df["is_monsoon"] = date.dt.dayofweek, month.isin([6, 7, 8, 9]).astype(int)
    for n in (1, 7, 14, 28):
        df[f"cases_lag_{n}"] = grp.case_count.shift(n)
    for n in (7, 14, 28):
        for stat in ("mean", "std", "max"):
            df[f"cases_{stat}_{n}"] = grp.case_count.transform(
                lambda s, n=n, stat=stat: getattr(s.shift(1).rolling(n, min_periods=3), stat)())
    df["observed_28"] = grp["observed"].transform(lambda s: s.shift(1).rolling(28, min_periods=1).sum())
    df["history_days"] = grp.cumcount()
    df["growth_7"] = ((df.case_count - df.cases_lag_7) / (df.cases_lag_7 + 1)).clip(-10, 10)
    df["zscore_28"] = ((df.case_count - df.cases_mean_28) / (df.cases_std_28 + 1)).clip(-20, 20)
    pop = df.population.clip(lower=1)
    df["population_log"] = np.log1p(pop)
    df["population_density"] = pop / df.get("area_sq_km", pd.Series(np.nan, index=df.index)).replace(0, np.nan)
    df["cases_per_100k"] = df.case_count / pop * 100_000
    for name in ENVIRONMENT:
        df[f"{name}_missing"] = df[name].isna().astype(int)
    df["rainfall_prior_7"] = grp.rainfall_mm.transform(lambda s: s.shift(1).rolling(7, min_periods=3).sum())
    df["severity_prior_7"] = grp.severity_avg.transform(lambda s: s.shift(1).rolling(7, min_periods=3).mean())
    # Robust same-month history, shifted before expanding; never uses current/future labels or counts.
    df["seasonal_month_median"] = df.groupby(["region_id","disease_code",month])["case_count"].transform(
        lambda s:s.shift(1).expanding(min_periods=7).median())
    df["seasonal_ratio"] = df.case_count/(df.seasonal_month_median+1)
    df["prior_year_mean"] = grp.case_count.transform(lambda s:s.shift(350).rolling(28,min_periods=14).mean())
    df["prior_year_ratio"] = df.case_count/(df.prior_year_mean+1)
    for column in ("latitude","longitude"):
        if column not in df:
            df[column]=np.nan
    for disease in disease_codes:
        df[f"disease_{disease}"] = (df.disease_code == disease).astype(int)
    columns = NUMERIC + [f"disease_{d}" for d in disease_codes]
    # Sentinel is explicit and consistent; environmental missingness is also encoded.
    X = df[columns].replace([np.inf, -np.inf], np.nan).fillna(-1).astype("float32")
    return df, X


def forecast_features(frame, X, lead):
    """Features at the origin plus known target calendar; never target observations."""
    result = X.copy()
    result["lead_days"] = np.asarray(lead) if not np.isscalar(lead) else lead
    future = pd.to_datetime(frame.date) + pd.to_timedelta(result.lead_days, unit="D")
    result["target_month_sin"] = np.sin(2*np.pi*future.dt.month/12)
    result["target_month_cos"] = np.cos(2*np.pi*future.dt.month/12)
    result["target_day_of_week"] = future.dt.dayofweek
    return result.astype("float32")
