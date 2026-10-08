"""Evaluate a frozen bundle on independent observations; never fit or tune here."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import time

ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'backend'))
import numpy as np
import pandas as pd
from surveillance.ml.features import prepare_daily,build_features
from surveillance.ml.runtime import load_bundle,risk_predict,anomaly_predict,forecast_predict
from train_validated import classification_metrics,forecast_metrics,LEADS


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-dir',type=Path,required=True)
    parser.add_argument('--bundle-dir',type=Path)
    parser.add_argument('--data-kind',choices=['synthetic','observational'],default='synthetic')
    parser.add_argument('--report',type=Path,default=ROOT/'ml_models/test_results/validated_independent.json')
    args=parser.parse_args()
    root=ROOT/'ml_models/saved_models/validated'
    bundle_dir=args.bundle_dir or root/json.loads((root/'active.json').read_text())['version']
    bundle,manifest=load_bundle(bundle_dir)
    tick=time.perf_counter()
    cases=pd.read_csv(args.data_dir/'disease_surveillance_historical.csv')
    regions=pd.read_csv(args.data_dir/'regions.csv');env=pd.read_csv(args.data_dir/'environmental_data.csv')
    if args.data_kind=='synthetic' and regions.sanitation_index.max()<=10:regions['sanitation_index']*=10
    if args.data_kind=='synthetic' and env.water_quality_index.max()<=10:env['water_quality_index']*=10
    frame,X=build_features(prepare_daily(cases,regions,env),bundle['disease_codes'])
    cutoff=max(pd.Timestamp(manifest['training_end']),frame.date.max()-pd.Timedelta(days=240))
    mask=(frame.date>cutoff)&(frame.observed==1)&(frame.observed_28>=21)
    risk=risk_predict(bundle,X.loc[mask]);anomaly=anomaly_predict(bundle,X.loc[mask])
    y=frame.loc[mask,'outbreak_occurred'].astype(int).to_numpy()
    report={'model_version':bundle['version'],'evaluation':'Independent simulation seed; fixed thresholds, no fitting',
            'real_world_validated':False,'source_sha256':hashlib.sha256((args.data_dir/'disease_surveillance_historical.csv').read_bytes()).hexdigest(),
            'risk':classification_metrics(y,risk,bundle['risk_threshold']),
            'anomaly':classification_metrics(y,anomaly,bundle['anomaly_threshold']),'forecasts':{}}
    # Outbreak event recall: at least one alert in each consecutive labelled episode.
    test=frame.loc[mask,['region_id','disease_code','date','outbreak_occurred']].copy()
    test['detected']=risk>=bundle['risk_threshold']
    events=0;detected=0
    for _,group in test.groupby(['region_id','disease_code']):
        positive=group.outbreak_occurred.astype(bool)
        episodes=(positive!=positive.shift(fill_value=False)).cumsum()
        for _,episode in group[positive].groupby(episodes[positive]):
            events+=1;detected+=int(episode.detected.any())
    report['event_recall']=detected/max(events,1)
    report['outbreak_events']=events
    report['false_positive_days_per_1000_observations']=float(((risk>=bundle['risk_threshold'])&(y==0)).sum()/len(y)*1000)
    target_group=frame.groupby(['region_id','disease_code'])
    for lead in LEADS:
        target=target_group.case_count.shift(-lead)
        selected=mask & target.notna() & (frame.history_days%7==0)
        if not selected.any():continue
        p=forecast_predict(bundle,frame.loc[selected],X.loc[selected],lead)
        actual=target.loc[selected].to_numpy()
        metrics=forecast_metrics(actual,p)
        q=bundle['forecast_intervals'].get(str(lead),bundle['forecast_interval_fallback'])
        width=q*np.sqrt(p+1)
        metrics['interval_coverage']=float(np.mean((actual>=np.maximum(0,p-width))&(actual<=p+width)))
        metrics['baseline_mae']=float(np.abs(actual-np.maximum(X.loc[selected,'cases_mean_7'],0)).mean())
        report['forecasts'][str(lead)]=metrics
    report['evaluation_seconds']=time.perf_counter()-tick
    args.report.parent.mkdir(parents=True,exist_ok=True)
    args.report.write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2))


if __name__=='__main__':main()
