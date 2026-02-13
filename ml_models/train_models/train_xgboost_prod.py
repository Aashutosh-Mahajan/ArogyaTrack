#!/usr/bin/env python3
"""
train_xgboost_prod.py
Production-ready XGBoost outbreak classifier
Saves:
    - xgboost.model
    - scaler.pkl
    - features.json
    - metrics.json
    - metadata.json
"""

import os
import json
import numpy as np
import pandas as pd
import xgboost as xgb
import joblib
from tqdm import tqdm
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, roc_auc_score
from datetime import datetime
import warnings
warnings.filterwarnings("ignore")

# ==========================================================
# CONFIG
# ==========================================================

class Config:
    DATA_DIR = r"D:\python\ml_models\ml_datasets_large_scale"
    OUTPUT_DIR = r"D:\python\ml_models\saved_models\xgboost_prod"
    TEST_SIZE = 0.2
    RANDOM_STATE = 42
    N_ESTIMATORS = 500
    LEARNING_RATE = 0.05
    MAX_DEPTH = 6
    EARLY_STOPPING_ROUNDS = 30

os.makedirs(Config.OUTPUT_DIR, exist_ok=True)
np.random.seed(Config.RANDOM_STATE)

print("="*60)
print("XGBOOST PRODUCTION TRAINING")
print("="*60)

# ==========================================================
# LOAD DATA
# ==========================================================

print("\nLoading datasets...")

with tqdm(total=3, desc="Loading Data") as pbar:

    labels = pd.read_csv(
        os.path.join(Config.DATA_DIR, "outbreak_labels.csv"),
        parse_dates=['date'],
        low_memory=False
    )
    pbar.update(1)

    regions = pd.read_csv(
        os.path.join(Config.DATA_DIR, "regions.csv"),
        usecols=['region_id','population','sanitation_index','hospital_count'],
        low_memory=False
    )
    pbar.update(1)

    env = pd.read_csv(
        os.path.join(Config.DATA_DIR, "environmental_data.csv"),
        parse_dates=['date'],
        usecols=['date','region_id','temperature_celsius','rainfall_mm','aqi'],
        low_memory=False
    )
    pbar.update(1)

# ==========================================================
# FEATURE ENGINEERING
# ==========================================================

print("\nEngineering features...")

with tqdm(total=2, desc="Feature Engineering") as pbar:

    env = env.sort_values(['region_id','date'])

    env['temp_14d'] = env.groupby('region_id')['temperature_celsius'] \
                         .transform(lambda x: x.rolling(14, min_periods=1).mean())

    env['rain_14d'] = env.groupby('region_id')['rainfall_mm'] \
                         .transform(lambda x: x.rolling(14, min_periods=1).mean())

    env['aqi_14d'] = env.groupby('region_id')['aqi'] \
                        .transform(lambda x: x.rolling(14, min_periods=1).mean())

    pbar.update(1)

    env_feat = env[['date','region_id','temp_14d','rain_14d','aqi_14d']].drop_duplicates()
    pbar.update(1)

df = labels.merge(env_feat, on=['region_id','date'], how='left') \
           .merge(regions, on='region_id', how='left')

df = df.fillna(0)

# ==========================================================
# FEATURES
# ==========================================================

FEATURES = [
    'temp_14d',
    'rain_14d',
    'aqi_14d',
    'sanitation_index',
    'hospital_count',
    'population'
]

X = df[FEATURES].astype(float)
y = df['outbreak_occurred'].astype(int)

# ==========================================================
# SPLIT
# ==========================================================

X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=Config.TEST_SIZE,
    stratify=y,
    random_state=Config.RANDOM_STATE
)

scaler = StandardScaler()
X_train_s = scaler.fit_transform(X_train)
X_test_s = scaler.transform(X_test)

joblib.dump(scaler, os.path.join(Config.OUTPUT_DIR,"scaler.pkl"))

# ==========================================================
# TRAIN MODEL
# ==========================================================

print("\nTraining XGBoost...")

dtrain = xgb.DMatrix(X_train_s, label=y_train)
dtest = xgb.DMatrix(X_test_s, label=y_test)

params = {
    'objective': 'binary:logistic',
    'eval_metric': 'auc',
    'eta': Config.LEARNING_RATE,
    'max_depth': Config.MAX_DEPTH,
    'seed': Config.RANDOM_STATE
}

evals_result = {}

model = xgb.train(
    params,
    dtrain,
    num_boost_round=Config.N_ESTIMATORS,
    evals=[(dtrain,'train'),(dtest,'eval')],
    early_stopping_rounds=Config.EARLY_STOPPING_ROUNDS,
    evals_result=evals_result,
    verbose_eval=50
)

model.save_model(os.path.join(Config.OUTPUT_DIR,"xgboost.model"))

# ==========================================================
# SAVE FEATURES
# ==========================================================

with open(os.path.join(Config.OUTPUT_DIR,"features.json"), "w") as f:
    json.dump(FEATURES, f, indent=2)

# ==========================================================
# EVALUATION
# ==========================================================

pred_probs = model.predict(dtest)
preds = (pred_probs > 0.5).astype(int)

roc = roc_auc_score(y_test, pred_probs)
report = classification_report(y_test, preds, output_dict=True)

metrics = {
    'roc_auc': float(roc),
    'classification_report': report,
    'best_iteration': int(model.best_iteration)
}

with open(os.path.join(Config.OUTPUT_DIR,"metrics.json"), "w") as f:
    json.dump(metrics, f, indent=2)

# ==========================================================
# METADATA
# ==========================================================

metadata = {
    'model': 'xgboost',
    'timestamp_utc': datetime.utcnow().isoformat(),
    'config': {
        'n_estimators': Config.N_ESTIMATORS,
        'learning_rate': Config.LEARNING_RATE,
        'max_depth': Config.MAX_DEPTH,
        'early_stopping_rounds': Config.EARLY_STOPPING_ROUNDS
    },
    'features': FEATURES
}

with open(os.path.join(Config.OUTPUT_DIR,"metadata.json"), "w") as f:
    json.dump(metadata, f, indent=2)

print("\nTraining Complete.")
print("ROC-AUC:", round(roc,4))
print("Artifacts saved at:", Config.OUTPUT_DIR)
