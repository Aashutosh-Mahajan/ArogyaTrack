"""Reproducible causal model selection, calibration, and untouched temporal tests.

Run from the repository: backend/venv/Scripts/python ml_models/train_validated.py
No generated data or database is modified. A new immutable version is published
only after artifact smoke checks; the report never claims real-world validation.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import sys
import time
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
import joblib
import numpy as np
import pandas as pd
import sklearn
import xgboost
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor, IsolationForest
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (average_precision_score, roc_auc_score, precision_recall_curve,
    precision_score, recall_score, f1_score, confusion_matrix, brier_score_loss,
    mean_absolute_error, mean_squared_error)
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier, XGBRegressor
from surveillance.ml.features import prepare_daily, build_features, forecast_features, SCHEMA_VERSION
from surveillance.ml.runtime import load_bundle, risk_predict, anomaly_predict, forecast_predict

LEADS = [1, 3, 7, 14, 21, 30, 45, 60, 75, 90, 93]


def probability_features(model, X):
    p = np.clip(model.predict_proba(X)[:, 1], 1e-6, 1-1e-6)
    return np.log(p/(1-p)).reshape(-1, 1)


def threshold_for(y, probability):
    precision, recall, thresholds = precision_recall_curve(y, probability)
    f2 = 5*precision[:-1]*recall[:-1] / (4*precision[:-1]+recall[:-1]+1e-12)
    return float(thresholds[int(np.argmax(f2))])


def classification_metrics(y, p, threshold):
    pred = p >= threshold
    return dict(roc_auc=float(roc_auc_score(y, p)), pr_auc=float(average_precision_score(y, p)),
                precision=float(precision_score(y, pred, zero_division=0)),
                recall=float(recall_score(y, pred, zero_division=0)),
                f1=float(f1_score(y, pred, zero_division=0)),
                brier=float(brier_score_loss(y, p)), confusion_matrix=confusion_matrix(y, pred).tolist(),
                positive_rate=float(np.mean(y)), n=int(len(y)), threshold=threshold)


def forecast_metrics(y, p):
    return dict(mae=float(mean_absolute_error(y,p)), rmse=float(np.sqrt(mean_squared_error(y,p))),
                wape=float(np.abs(y-p).sum()/max(np.abs(y).sum(),1)), n=int(len(y)))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=ROOT/"ml_models/india_surveillance_extreme_quality")
    parser.add_argument("--output-dir", type=Path, default=ROOT/"ml_models/saved_models/validated")
    parser.add_argument("--max-forecast-rows", type=int, default=300000)
    parser.add_argument("--threads", type=int, default=min(os.cpu_count() or 2, 8))
    parser.add_argument("--data-kind", choices=["synthetic", "observational"], default="synthetic")
    parser.add_argument("--activate", action="store_true", help="Publish version as backend's active bundle after verification")
    args = parser.parse_args()
    start = time.perf_counter()
    timings = {}
    cases = pd.read_csv(args.data_dir/"disease_surveillance_historical.csv")
    regions = pd.read_csv(args.data_dir/"regions.csv")
    env = pd.read_csv(args.data_dir/"environmental_data.csv")
    # Legacy generated CSV indices use 0..10; canonical backend schema uses 0..100.
    if args.data_kind=='synthetic' and regions.sanitation_index.max()<=10:
        regions["sanitation_index"]*=10
    if args.data_kind=='synthetic' and env.water_quality_index.max()<=10:
        env["water_quality_index"]*=10
    if "outbreak_occurred" not in cases:
        raise ValueError("Verified outbreak labels are required; pseudo-labels are not accepted")
    codes = sorted(cases.disease_code.unique().tolist())
    frame, X = build_features(prepare_daily(cases, regions, env), codes)
    dates = sorted(frame.date.unique())
    if len(dates) < 240:
        raise ValueError("At least 240 days are required to test 90-day forecasts")
    cut1, cut2, cut3 = [pd.Timestamp(dates[int(len(dates)*q)]) for q in (.50,.65,.78)]
    good = (frame.observed == 1) & (frame.observed_28 >= 21) & frame.outbreak_occurred.notna()
    masks = [good & (frame.date < cut1), good & (frame.date >= cut1) & (frame.date < cut2),
             good & (frame.date >= cut2) & (frame.date < cut3), good & (frame.date >= cut3)]
    arrays = [X.loc[m].to_numpy() for m in masks]
    labels = [frame.loc[m, "outbreak_occurred"].astype(int).to_numpy() for m in masks]
    if any(len(np.unique(y)) != 2 for y in labels):
        raise ValueError("Each chronological partition needs positive and negative labels")
    timings["features_seconds"] = time.perf_counter()-start
    print(f"Prepared {len(frame):,} rows, {len(codes)} diseases, {X.shape[1]} causal features", flush=True)
    tick = time.perf_counter()
    ratio = (len(labels[0])-labels[0].sum())/max(labels[0].sum(),1)
    candidates = {
        "logistic": make_pipeline(StandardScaler(), LogisticRegression(max_iter=400, class_weight="balanced")),
        "hist_gradient_boosting": HistGradientBoostingClassifier(max_iter=180, max_leaf_nodes=15,
             l2_regularization=5, class_weight="balanced", random_state=42, early_stopping=False),
        "xgboost": XGBClassifier(n_estimators=250,max_depth=4,learning_rate=.05,subsample=.8,
             colsample_bytree=.8,reg_lambda=5,min_child_weight=8,scale_pos_weight=ratio,
             tree_method="hist",n_jobs=args.threads,random_state=42,eval_metric="logloss"),
        "xgboost_deeper": XGBClassifier(n_estimators=350,max_depth=6,learning_rate=.035,subsample=.8,
             colsample_bytree=.8,reg_lambda=8,min_child_weight=15,scale_pos_weight=ratio,
             tree_method="hist",n_jobs=args.threads,random_state=42,eval_metric="logloss"),
    }
    scores = {}
    for name, model in candidates.items():
        model.fit(arrays[0],labels[0])
        scores[name] = float(average_precision_score(labels[1],model.predict_proba(arrays[1])[:,1]))
        print(f"Risk candidate {name}: validation PR-AUC={scores[name]:.4f}",flush=True)
    winner = max(scores,key=scores.get)
    risk = candidates[winner]
    risk.fit(np.concatenate(arrays[:2]),np.concatenate(labels[:2]))
    # Disjoint calibration days: first half fits calibration; second selects threshold.
    calibration_dates = sorted(frame.loc[masks[2],"date"].unique())
    midpoint = pd.Timestamp(calibration_dates[len(calibration_dates)//2])
    calfit = masks[2] & (frame.date < midpoint)
    calcheck = masks[2] & (frame.date >= midpoint)
    for m in (calfit,calcheck):
        if frame.loc[m,"outbreak_occurred"].nunique() != 2:
            raise ValueError("Calibration subperiods need both label classes")
    yc = frame.loc[calfit,"outbreak_occurred"].astype(int).to_numpy()
    yt = frame.loc[calcheck,"outbreak_occurred"].astype(int).to_numpy()
    riskcal = LogisticRegression().fit(probability_features(risk,X.loc[calfit].to_numpy()),yc)
    threshold = threshold_for(yt,riskcal.predict_proba(probability_features(risk,X.loc[calcheck].to_numpy()))[:,1])
    timings["risk_training_seconds"] = time.perf_counter()-tick
    tick = time.perf_counter()
    normals = arrays[0][labels[0] == 0]
    isolation = IsolationForest(n_estimators=250,max_samples=min(len(normals),2048),
                                random_state=42,n_jobs=args.threads,contamination="auto").fit(normals)
    anomaly_candidates = {"isolation_forest":-isolation.score_samples(arrays[1]),
                          "seasonal_deviation":np.maximum(X.loc[masks[1],"seasonal_ratio"].to_numpy(),0),
                          "statistical_spike":np.maximum(X.loc[masks[1],"zscore_28"].to_numpy(),0)}
    anomaly_scores = {n:float(average_precision_score(labels[1],p)) for n,p in anomaly_candidates.items()}
    method = max(anomaly_scores,key=anomaly_scores.get)
    isolation.fit(np.concatenate(arrays[:2])[np.concatenate(labels[:2]) == 0])
    def anomaly_raw(m):
        return (-isolation.score_samples(X.loc[m].to_numpy()) if method=="isolation_forest"
                else np.maximum(X.loc[m,"seasonal_ratio"].to_numpy(),0) if method=="seasonal_deviation"
                else np.maximum(X.loc[m,"zscore_28"].to_numpy(),0)).reshape(-1,1)
    anomalycal = LogisticRegression().fit(anomaly_raw(calfit),yc)
    athreshold = threshold_for(yt,anomalycal.predict_proba(anomaly_raw(calcheck))[:,1])
    timings["anomaly_training_seconds"] = time.perf_counter()-tick
    tick = time.perf_counter()
    # Direct forecasts: every label is observed at origin+lead, partitions purge targets crossing cutoffs.
    pieces = []
    group = frame.groupby(["region_id","disease_code"],sort=False)
    for lead in LEADS:
        target = group.case_count.shift(-lead)
        target_date = frame.date + pd.Timedelta(days=lead)
        m = good & target.notna() & (frame.history_days % 3 == 0)
        feat = forecast_features(frame.loc[m],X.loc[m],lead)
        feat["label"] = target.loc[m]
        feat["origin"] = frame.loc[m,"date"]
        feat["target_date"] = target_date.loc[m]
        pieces.append(feat)
    forecasts = pd.concat(pieces,ignore_index=True)
    fcols = list(X.columns)+["lead_days","target_month_sin","target_month_cos","target_day_of_week"]
    ftrain = forecasts[(forecasts.origin < cut1) & (forecasts.target_date < cut1)]
    fval = forecasts[(forecasts.origin >= cut1) & (forecasts.target_date < cut2)]
    fcal = forecasts[(forecasts.origin >= cut2) & (forecasts.target_date < cut3)]
    ftest = forecasts[(forecasts.origin >= cut3) & (forecasts.target_date <= frame.date.max())]
    if any(len(f)==0 for f in (ftrain,fval,fcal,ftest)):
        raise ValueError("Insufficient forecast origins for temporal evaluation")
    if len(ftrain)>args.max_forecast_rows:
        ftrain=ftrain.sample(args.max_forecast_rows,random_state=42)
    fcandidates = {
        "seasonal_baseline":None,
        "hist_poisson":HistGradientBoostingRegressor(loss="poisson",max_iter=180,max_leaf_nodes=15,
                                l2_regularization=5,early_stopping=False,random_state=42),
        "xgboost_poisson":XGBRegressor(objective="count:poisson",n_estimators=250,max_depth=5,
                learning_rate=.05,subsample=.8,colsample_bytree=.8,reg_lambda=5,
                n_jobs=args.threads,random_state=42,tree_method="hist"),
    }
    fscores = {}
    for name, model in fcandidates.items():
        if model is None:
            pred=np.maximum(fval.cases_mean_7.to_numpy(),0)
        else:
            model.fit(ftrain[fcols].to_numpy(),ftrain.label.to_numpy())
            pred=np.maximum(model.predict(fval[fcols].to_numpy()),0)
        fscores[name]=float(mean_absolute_error(fval.label,pred))
        print(f"Forecast candidate {name}: validation MAE={fscores[name]:.4f}",flush=True)
    fwinner=min(fscores,key=fscores.get)
    fmodel=fcandidates[fwinner]
    if fmodel is not None:
        merged=pd.concat([ftrain,fval],ignore_index=True)
        fmodel.fit(merged[fcols].to_numpy(),merged.label.to_numpy())
    def fp(data):
        return np.maximum(data.cases_mean_7.to_numpy() if fmodel is None else fmodel.predict(data[fcols].to_numpy()),0)
    cp=fp(fcal)
    residual=np.abs(fcal.label.to_numpy()-cp)/np.sqrt(cp+1)
    intervals={}
    # Horizon-specific calibration where available; explicitly report unsupported long horizons.
    for lead in LEADS:
        values=residual[fcal.lead_days.to_numpy()==lead]
        if len(values)>=30:
            intervals[str(lead)]=float(np.quantile(values,min(1,np.ceil((len(values)+1)*.95)/len(values)),method="higher"))
    fallback=float(np.quantile(residual,.99,method="higher"))
    timings["forecast_training_seconds"] = time.perf_counter()-tick
    version=datetime.now(timezone.utc).strftime("v6-%Y%m%dT%H%M%SZ")
    bundle=dict(version=version,disease_codes=codes,feature_names=list(X.columns),risk_model=risk,
                risk_calibrator=riskcal,risk_threshold=threshold,anomaly_model=isolation,
                anomaly_method=method,anomaly_calibrator=anomalycal,anomaly_threshold=athreshold,
                forecast_model=fmodel,forecast_name=fwinner,forecast_intervals=intervals,
                forecast_interval_fallback=fallback)
    report={"version":version,"data_kind":args.data_kind,"real_world_validated":False,
            "target":"Current labelled outbreak detection; forecasts predict daily cases at origin+lead",
            "splits":{"train_end":str(cut1.date()),"selection_end":str(cut2.date()),
                      "calibration_end":str(cut3.date()),"test_end":str(frame.date.max().date())},
            "risk_selection_pr_auc":scores,"risk_selected":winner,
            "risk_test":classification_metrics(labels[3],risk_predict(bundle,X.loc[masks[3]]),threshold),
            "anomaly_selection_pr_auc":anomaly_scores,"anomaly_selected":method,
            "anomaly_test":classification_metrics(labels[3],anomaly_predict(bundle,X.loc[masks[3]]),athreshold),
            "forecast_selection_mae":fscores,"forecast_selected":fwinner,"forecast_test":{},
            "regions":len(regions),"diseases":len(codes),"source_rows":len(cases),"feature_count":len(X.columns)}
    predictions=fp(ftest)
    for lead in LEADS:
        m=ftest.lead_days.to_numpy()==lead
        if not m.any():
            report["forecast_test"][str(lead)]={"status":"insufficient_test_dates"}
            continue
        y,p=ftest.label.to_numpy()[m],predictions[m]
        metrics=forecast_metrics(y,p)
        q=intervals.get(str(lead),fallback)
        width=q*np.sqrt(p+1)
        metrics.update(interval_coverage=float(np.mean((y>=np.maximum(0,p-width)) & (y<=p+width))),
                       interval_calibrated_for_horizon=str(lead) in intervals,
                       baseline_mae=float(mean_absolute_error(y,np.maximum(ftest.loc[m,"cases_mean_7"],0))))
        report["forecast_test"][str(lead)]=metrics
    report["risk_by_disease"]={}
    p=risk_predict(bundle,X.loc[masks[3]])
    for code in codes:
        m=frame.loc[masks[3],"disease_code"].to_numpy()==code
        if len(np.unique(labels[3][m]))==2:
            report["risk_by_disease"][code]=classification_metrics(labels[3][m],p[m],threshold)
    report["timings"]={**timings,"total_seconds":time.perf_counter()-start}
    report["limitations"]=["Generated data cannot establish clinical/public-health accuracy",
        "Long horizons require more chronological history for calibration and testing",
        "Current labels detect an outbreak today, not a future outbreak",
        "Pointwise intervals are not simultaneous cumulative-horizon intervals"]
    destination=args.output_dir/version
    destination.mkdir(parents=True,exist_ok=False)
    joblib.dump(bundle,destination/"bundle.joblib",compress=3)
    (destination/"report.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    manifest=dict(version=version,schema_version=SCHEMA_VERSION,data_kind=args.data_kind,
                  real_world_validated=False,training_end=str(cut2.date()),disease_codes=codes,
                  max_forecast_lead=max(LEADS),
                  feature_names=list(X.columns),python=platform.python_version(),sklearn=sklearn.__version__,
                  xgboost=xgboost.__version__,spatial={"eps_km":25,"min_samples":2,"method":"haversine"},
                  files={n:hashlib.sha256((destination/n).read_bytes()).hexdigest() for n in ("bundle.joblib","report.json")},
                  source_hashes={n:hashlib.sha256((args.data_dir/n).read_bytes()).hexdigest() for n in
                    ("disease_surveillance_historical.csv","regions.csv","environmental_data.csv")})
    (destination/"manifest.json").write_text(json.dumps(manifest,indent=2),encoding="utf-8")
    loaded,_=load_bundle(destination)
    risk_predict(loaded,X.loc[masks[3]].iloc[:2])
    anomaly_predict(loaded,X.loc[masks[3]].iloc[:2])
    forecast_predict(loaded,frame.loc[masks[3]].iloc[:2],X.loc[masks[3]].iloc[:2],7)
    if args.activate:
        args.output_dir.mkdir(parents=True,exist_ok=True)
        temporary=args.output_dir/"active.json.tmp"
        temporary.write_text(json.dumps({"version":version}),encoding="utf-8")
        temporary.replace(args.output_dir/"active.json")
    print(json.dumps({"bundle":str(destination),"activated":args.activate,"report":report},indent=2),flush=True)


if __name__=="__main__":
    main()
