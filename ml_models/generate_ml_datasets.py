# generate_large_scale_surveillance.py
"""
Large-scale Disease Surveillance Dataset Generator
- Downloads India places (GeoNames by default) and ICD-10 codes (optional).
- Streams large CSVs for: regions, environmental_data, disease_surveillance_historical,
  patient_diagnoses_raw, outbreak_labels.
- Configurable target sizes so you can scale to 100k - 2M+ rows per file.
"""

import os
import sys
import csv
import json
import math
import gzip
import shutil
import random
from datetime import datetime, timedelta
from collections import defaultdict, Counter

import numpy as np
import pandas as pd
import requests
from tqdm import tqdm

# ---------------------------
# CONFIG - Tune these values
# ---------------------------
class Config:
    # Output directory
    OUTPUT_DIR = "./ml_datasets_large_scale"
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Data sources (auto-download if not provided)
    GEONAMES_IN_URL = "https://download.geonames.org/export/dump/IN.zip"
    SIMPLEMAPS_IN_CSV = "https://simplemaps.com/static/data/country-cities/in/in.csv"
    # ICD CSV raw on GitHub (fallback)
    ICD10_CSV_URL = "https://raw.githubusercontent.com/k4m1113/ICD-10-CSV/master/codes.csv"

    # Target sizes (set these to large numbers if you want 1-2M rows)
    TARGET_REGIONS = 25000        # number of region rows (e.g., wards) to generate
    TARGET_ENV_ROWS = 1000000     # environmental rows (date x region)
    TARGET_SURVEILLANCE = 1000000 # surveillance rows
    TARGET_PATIENTS = 1000000     # patient records
    TARGET_LABELS = 200000        # outbreak label rows

    # Time range for environmental & surveillance
    START_DATE = "2023-01-01"
    END_DATE = "2024-12-31"

    # Random seed
    RANDOM_SEED = 42

    # Chunk size for writes
    WRITE_CHUNK = 100000

    # City sampling strategy: "geonames" or "simplemaps" or "kaggle"
    CITY_SOURCE = "geonames"

    # Whether to download the remote datasets (set False to use local files)
    AUTO_DOWNLOAD = True

    # Minimal population filter for cities (to avoid tiny hamlets if desired)
    MIN_CITY_POP = 1000

    # Hospital/hygiene heuristics
    HOSPITALS_PER_100k = 20

np.random.seed(Config.RANDOM_SEED)
random.seed(Config.RANDOM_SEED)

# ---------------------------
# UTIL: download helpers
# ---------------------------
def download_file(url, dest_path, chunk_size=1024*1024):
    r = requests.get(url, stream=True, timeout=60)
    r.raise_for_status()
    total = int(r.headers.get('content-length', 0))
    with open(dest_path, "wb") as f, tqdm(
        desc=f"Downloading {os.path.basename(dest_path)}",
        total=total, unit="iB", unit_scale=True
    ) as pbar:
        for chunk in r.iter_content(chunk_size=chunk_size):
            if chunk:
                f.write(chunk)
                pbar.update(len(chunk))

# ---------------------------
# Step 1: Acquire / load cities
# ---------------------------
def ensure_city_file():
    """Return path to a CSV of cities with columns: name, lat, lng, population, admin1 (state)."""
    if Config.CITY_SOURCE == "simplemaps":
        dest = os.path.join(Config.OUTPUT_DIR, "simplemaps_in.csv")
        if Config.AUTO_DOWNLOAD and not os.path.exists(dest):
            download_file(Config.SIMPLEMAPS_IN_CSV, dest)
        return dest
    else:
        # GeoNames IN dump (IN.zip -> IN.txt). Use geonames if available.
        zip_path = os.path.join(Config.OUTPUT_DIR, "IN.zip")
        txt_path = os.path.join(Config.OUTPUT_DIR, "IN.txt")
        if Config.AUTO_DOWNLOAD and not os.path.exists(txt_path):
            if not os.path.exists(zip_path):
                download_file(Config.GEONAMES_IN_URL, zip_path)
            # unzip (safe small number of files)
            import zipfile
            with zipfile.ZipFile(zip_path, "r") as z:
                # geonames IN.txt is the country file
                z.extractall(Config.OUTPUT_DIR)
        return txt_path

def load_cities_geonames(txt_path):
    """Load geonames IN.txt (tab-separated). Return DataFrame with name, lat, lng, population, admin1."""
    cols = [
        "geonameid","name","asciiname","alternatenames","latitude","longitude",
        "feature_class","feature_code","country_code","cc2","admin1","admin2","admin3","admin4",
        "population","elevation","dem","timezone","modification_date"
    ]
    df = pd.read_csv(txt_path, sep="\t", header=None, names=cols, dtype=str, low_memory=False)
    df['latitude'] = df['latitude'].astype(float)
    df['longitude'] = df['longitude'].astype(float)
    df['population'] = pd.to_numeric(df['population'], errors='coerce').fillna(0).astype(int)
    # Keep populated places feature_class 'P'
    df = df[df['feature_class'] == 'P']
    df = df[df['population'] >= Config.MIN_CITY_POP]
    df = df.rename(columns={'name':'city','admin1':'state','latitude':'lat','longitude':'lng'})
    df = df[['city','lat','lng','population','state']]
    df = df.reset_index(drop=True)
    return df

def load_cities_simplemaps(csv_path):
    df = pd.read_csv(csv_path)
    # simplemaps column names vary, try to standardize
    mapping = {}
    for c in df.columns:
        lc = c.lower()
        if 'city' in lc and 'name' in lc: mapping[c] = 'city'
        if lc in ('lat','latitude'): mapping[c] = 'lat'
        if lc in ('lng','lon','longitude'): mapping[c] = 'lng'
        if 'population' in lc: mapping[c] = 'population'
        if 'state' in lc or 'admin_name' in lc: mapping[c] = 'state'
    df = df.rename(columns=mapping)
    if 'population' not in df.columns:
        df['population'] = 10000
    df['population'] = pd.to_numeric(df['population'], errors='coerce').fillna(0).astype(int)
    df = df[df['population'] >= Config.MIN_CITY_POP]
    df = df[['city','lat','lng','population','state']].reset_index(drop=True)
    return df

# ---------------------------
# Step 2: Load ICD-10 disease list
# ---------------------------
def ensure_icd_file():
    dest = os.path.join(Config.OUTPUT_DIR, "icd10_codes.csv")
    if Config.AUTO_DOWNLOAD and not os.path.exists(dest):
        download_file(Config.ICD10_CSV_URL, dest)
    return dest

def load_icd_codes(path):
    df = pd.read_csv(path, encoding='utf-8', low_memory=False)
    # Try to find code and description columns
    candidates = [c for c in df.columns if c.lower() in ('code','icd10','icd_code')]
    descs = [c for c in df.columns if 'description' in c.lower() or 'meaning' in c.lower()]
    code_col = candidates[0] if candidates else df.columns[0]
    desc_col = descs[0] if descs else (df.columns[1] if len(df.columns)>1 else None)
    df = df[[code_col] + ([desc_col] if desc_col else [])].drop_duplicates()
    df.columns = ['code'] + (['description'] if desc_col else [])
    df['description'] = df['description'].fillna(df['code'])
    return df

# ---------------------------
# Step 3: Generate regions (wards) from cities
# ---------------------------
def generate_regions_from_cities(cities_df, target_regions):
    """
    Generate 'wards' around cities and produce a regions DataFrame.
    Strategy:
      - For each city, create ceil(pop / city_split_pop) wards until reaching target_regions
      - Random small lat/lng perturbations within ~0.02 degrees (~2km)
    """
    regions = []
    # Define desired average region population (adaptive)
    avg_pop = max(5000, int(cities_df['population'].median() / 4))
    region_id = 1
    cities_sorted = cities_df.sort_values('population', ascending=False)
    # iterate cities round-robin to spread regions across states
    city_iter = cities_sorted.iterrows()
    idx = 0
    pbar = tqdm(total=target_regions, desc="Generating regions")
    # We'll create wards by subdividing city population
    while len(regions) < target_regions:
        # rotate through top N cities
        row = cities_sorted.iloc[idx % len(cities_sorted)]
        idx += 1
        city_pop = int(row['population'])
        # number of wards to create for this city (at least 1)
        wards_for_city = max(1, min(10, int(math.ceil(city_pop / (avg_pop*2)))))  # cap per city to 10
        for w in range(wards_for_city):
            if len(regions) >= target_regions:
                break
            lat = float(row['lat']) + np.random.normal(0, 0.02)
            lng = float(row['lng']) + np.random.normal(0, 0.02)
            pop = max(100, int(np.random.normal(city_pop / wards_for_city, city_pop/ (wards_for_city*10))))
            area = round(np.random.uniform(1, 15), 2)
            hospitals = max(0, int(round((pop/100000) * Config.HOSPITALS_PER_100k + np.random.poisson(1))))
            sanitation = round(np.clip(np.random.normal(6.5, 1.5), 2.0, 9.5), 1)
            regions.append({
                'region_id': region_id,
                'region_name': f"{row['city']}_Ward_{w+1}",
                'region_type': 'ward',
                'parent_city': row['city'],
                'state': row.get('state', ''),
                'latitude': round(lat, 6),
                'longitude': round(lng, 6),
                'population': pop,
                'area_sq_km': area,
                'hospital_count': hospitals,
                'sanitation_index': sanitation
            })
            region_id += 1
            pbar.update(1)
            if len(regions) >= target_regions:
                break
    pbar.close()
    regions_df = pd.DataFrame(regions)
    return regions_df

# ---------------------------
# Small env & disease helpers
# ---------------------------
def month_temperature_by_state(month, state_hint):
    """Rudimentary temperature profile by month using state hint"""
    # we keep simplistic buckets; these are not authoritative climate values
    north = {"Punjab","Haryana","Delhi","Uttar Pradesh","Jammu and Kashmir","Himachal Pradesh"}
    south = {"Kerala","Tamil Nadu","Karnataka","Andhra Pradesh","Telangana"}
    west = {"Rajasthan","Gujarat","Maharashtra","Goa"}
    east = {"West Bengal","Bihar","Odisha","Jharkhand"}
    if state_hint in north:
        base = [10,12,18,25,30,33,32,31,29,24,18,12]
    elif state_hint in south:
        base = [25,26,28,30,31,30,29,29,29,28,26,25]
    elif state_hint in west:
        base = [20,23,30,35,38,37,35,34,33,30,25,20]
    elif state_hint in east:
        base = [18,20,26,30,32,31,30,30,30,28,23,19]
    else:
        base = [20,22,28,32,34,33,31,30,30,28,23,20]
    return base[month-1] + np.random.uniform(-2,2)

def rainfall_by_month(month, state_hint):
    if month in (6,7,8,9):
        return max(0.0, np.random.gamma(2.0, 50))
    if month in (10,11):
        return max(0.0, np.random.gamma(1.2, 15))
    if month in (1,2):
        return max(0.0, np.random.gamma(0.8, 6))
    return max(0.0, np.random.gamma(0.5, 3))

def aqi_by_month(month, state_hint):
    # a simple seasonal AQI bump in winter for north
    north = {"Punjab","Haryana","Delhi","Uttar Pradesh"}
    if state_hint in north and month in (11,12,1):
        return int(np.random.uniform(150, 320))
    return int(np.random.uniform(40, 160))

# ---------------------------
# Stream writers
# ---------------------------
def stream_environmental_data(regions_df, start_date, end_date, target_rows, out_path):
    """Write environmental rows until target_rows reached, iterating date x region in round-robin"""
    start = datetime.fromisoformat(start_date)
    end = datetime.fromisoformat(end_date)
    delta_days = (end - start).days + 1
    dates = [start + timedelta(days=i) for i in range(delta_days)]
    regions = regions_df.to_dict('records')
    total_possible = len(dates) * len(regions)
    # We'll sample combinations to reach target_rows (if target < total_possible) else write all
    write_all = (target_rows is None) or (target_rows >= total_possible)
    writer = None
    written = 0
    with open(out_path, 'w', newline='', encoding='utf-8') as f:
        fieldnames = ['date','region_id','temperature_celsius','humidity_percent','rainfall_mm','aqi','pm25','pm10','water_quality_index']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        if write_all:
            for date in tqdm(dates, desc="Env dates"):
                for reg in regions:
                    temp = round(month_temperature_by_state(date.month, reg['state']),1)
                    humidity = int(np.random.uniform(40,95))
                    rainfall = round(rainfall_by_month(date.month, reg['state']),1)
                    aqi = aqi_by_month(date.month, reg['state'])
                    writer.writerow({
                        'date': date.date().isoformat(),
                        'region_id': reg['region_id'],
                        'temperature_celsius': temp,
                        'humidity_percent': humidity,
                        'rainfall_mm': rainfall,
                        'aqi': aqi,
                        'pm25': int(aqi * 0.5),
                        'pm10': int(aqi * 0.75),
                        'water_quality_index': round(reg['sanitation_index'] + np.random.uniform(-1,1),1)
                    })
                    written += 1
        else:
            # sample random (date, region) combos
            pbar = tqdm(total=target_rows, desc="Streaming environmental rows")
            while written < target_rows:
                date = random.choice(dates)
                reg = random.choice(regions)
                temp = round(month_temperature_by_state(date.month, reg['state']),1)
                humidity = int(np.random.uniform(40,95))
                rainfall = round(rainfall_by_month(date.month, reg['state']),1)
                aqi = aqi_by_month(date.month, reg['state'])
                writer.writerow({
                    'date': date.date().isoformat(),
                    'region_id': reg['region_id'],
                    'temperature_celsius': temp,
                    'humidity_percent': humidity,
                    'rainfall_mm': rainfall,
                    'aqi': aqi,
                    'pm25': int(aqi * 0.5),
                    'pm10': int(aqi * 0.75),
                    'water_quality_index': round(reg['sanitation_index'] + np.random.uniform(-1,1),1)
                })
                written += 1
                pbar.update(1)
            pbar.close()
    return written

def stream_surveillance(regions_df, icd_df, env_csv_path, start_date, end_date, target_rows, out_path):
    """Stream surveillance rows by sampling region/date/disease combos and using env correlations"""
    start = datetime.fromisoformat(start_date)
    end = datetime.fromisoformat(end_date)
    delta_days = (end - start).days + 1
    dates = [start + timedelta(days=i) for i in range(delta_days)]
    regions = regions_df.to_dict('records')
    disease_codes = icd_df['code'].tolist()
    # Preload environmental map keyed by (date, region_id) if small; otherwise sample environmental functions directly
    # For performance / memory we will approximate environmental values using deterministic functions above.
    fieldnames = ['date','region_id','disease_code','disease_name','case_count','severity_avg','population_normalized_rate']
    written = 0
    with open(out_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        pbar = tqdm(total=target_rows, desc="Generating surveillance")
        while written < target_rows:
            date = random.choice(dates)
            reg = random.choice(regions)
            # choose 1-3 diseases per sampled instance
            num_d = np.random.choice([1,1,2], p=[0.6,0.2,0.2])
            chosen = random.sample(disease_codes, k=num_d)
            for disease_code in chosen:
                # base case sizes (sketch)
                base = np.random.poisson(3) + 1
                seasonal_mult = 1.0
                # slightly vary by disease family (use letter prefix)
                prefix = disease_code[0] if isinstance(disease_code, str) and len(disease_code)>0 else "X"
                if prefix in ['A','B','J']:  # infectious / respiratory seasons
                    if date.month in (6,7,8,9): seasonal_mult *= np.random.uniform(1.0,2.5)
                    if date.month in (11,12,1,2): seasonal_mult *= np.random.uniform(1.0,2.0)
                # environmental factors
                temp = round(month_temperature_by_state(date.month, reg['state']),1)
                rain = rainfall_by_month(date.month, reg['state'])
                aqi = aqi_by_month(date.month, reg['state'])
                temp_factor = 1.0 + max(0, (temp - 28) * 0.02) if prefix in ['A','B'] else 1.0
                rain_factor = 1.0 + min(3.0, (rain/100.0) * 0.25) if prefix in ['A','B'] else 1.0
                sanitation_factor = (10 - reg['sanitation_index']) / 10.0
                case_count = int(max(0, (base * seasonal_mult * temp_factor * rain_factor * (1 + sanitation_factor*0.4)) + np.random.normal(0,2)))
                if case_count < 3 and np.random.rand() < 0.6:
                    continue  # skip low noise rows for quality
                severity = round(np.clip(np.random.normal(2.2, 0.5) + (0.5 if case_count>20 else 0), 1.0, 4.0),2)
                p_rate = round((case_count / reg['population']) * 100000, 3)
                writer.writerow({
                    'date': date.date().isoformat(),
                    'region_id': reg['region_id'],
                    'disease_code': disease_code,
                    'disease_name': disease_code,
                    'case_count': case_count,
                    'severity_avg': severity,
                    'population_normalized_rate': p_rate
                })
                written += 1
                pbar.update(1)
                if written >= target_rows:
                    break
        pbar.close()
    return written

def stream_patients(surveillance_csv_path, target_patients, out_path):
    """Stream patient rows by sampling surveillance rows; read surveillance CSV in chunks for memory efficiency."""
    fieldnames = ['diagnosis_id','patient_id','region_id','diagnosis_date','disease_code','disease_name','severity','age','gender','symptoms','consent_surveillance']
    diagnosis_id = 1
    written = 0
    # read surveillance in chunks
    surv_iter = pd.read_csv(surveillance_csv_path, chunksize=100000, parse_dates=['date'], low_memory=False)
    # Create a reservoir of surveillance indices to sample from if surv rows < target
    surv_samples = []
    for chunk in surv_iter:
        chunk = chunk[chunk['case_count'] > 0]
        if len(chunk) == 0:
            continue
        # expand some rows by case_count to allow sampling
        expand = chunk.sample(n=min(len(chunk), 2000), replace=True)  # sample subset for speed
        surv_samples.append(expand)
    if len(surv_samples) == 0:
        return 0
    surv_df = pd.concat(surv_samples, ignore_index=True)
    symptom_pool = ['fever','cough','headache','fatigue','body_ache','nausea','vomiting','rash','diarrhea','shortness_of_breath']
    with open(out_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        pbar = tqdm(total=target_patients, desc="Generating patients")
        while written < target_patients:
            row = surv_df.sample(n=1).iloc[0]
            num_patients = min(max(1, int(np.random.poisson(1.5))), 6)
            for _ in range(num_patients):
                severity = np.random.choice(['mild','moderate','severe','critical'], p=[0.55,0.30,0.12,0.03])
                age = int(max(0, np.random.gamma(5,9)))
                gender = np.random.choice(['M','F','O'], p=[0.49,0.49,0.02])
                symptoms = ','.join(np.random.choice(symptom_pool, size=np.random.randint(1,5), replace=False))
                consent = np.random.rand() < 0.88
                writer.writerow({
                    'diagnosis_id': diagnosis_id,
                    'patient_id': f"P{diagnosis_id:07d}",
                    'region_id': int(row['region_id']),
                    'diagnosis_date': pd.to_datetime(row['date']).date().isoformat(),
                    'disease_code': row['disease_code'],
                    'disease_name': row.get('disease_name', row['disease_code']),
                    'severity': severity,
                    'age': age,
                    'gender': gender,
                    'symptoms': symptoms,
                    'consent_surveillance': consent
                })
                diagnosis_id += 1
                written += 1
                pbar.update(1)
                if written >= target_patients:
                    break
        pbar.close()
    return written

def stream_labels(regions_df, surveillance_csv, env_csv, target_labels, out_path):
    """Generate outbreak labels by sampling regions & dates and computing recent-case window."""
    fieldnames = ['region_id','date','disease_code','outbreak_occurred','outbreak_severity','days_until_outbreak','contributing_factors']
    # For simplicity, build a small summary map of recent surveillance per (region,date)
    # Read surveillance into dataframe (if too large, read sample)
    surv_df = pd.read_csv(surveillance_csv, parse_dates=['date'], low_memory=False)
    surv_df['date'] = pd.to_datetime(surv_df['date'])
    # Build grouped sums per region x date
    grp = surv_df.groupby(['region_id','date'])['case_count'].sum().reset_index()
    # Create a pivot-like approach: for a chosen date and region, sum the prior 14 days
    dates = sorted(grp['date'].unique())
    regions = regions_df['region_id'].tolist()
    written = 0
    with open(out_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        pbar = tqdm(total=target_labels, desc="Generating labels")
        while written < target_labels:
            region = random.choice(regions)
            date = random.choice(dates)
            window_start = date - pd.Timedelta(days=14)
            hist = grp[(grp['region_id']==region) & (grp['date'] >= window_start) & (grp['date'] < date)]
            recent_cases = int(hist['case_count'].sum()) if len(hist) else 0
            is_outbreak = recent_cases > 50 or (np.random.rand() < 0.25 and recent_cases > 10)
            if is_outbreak:
                if recent_cases >= 200:
                    severity = 'critical'
                elif recent_cases >= 100:
                    severity = 'high'
                elif recent_cases >= 50:
                    severity = 'medium'
                else:
                    severity = 'low'
            else:
                severity = 'low'
            # contributing factors from env (approx)
            # sample env row if available
            factors = []
            # quick approximate environmental pulls
            # If we had env file we would read specific row; approximate here
            sample_temp = month_temperature_by_state(date.month, regions_df.loc[regions_df['region_id']==region,'state'].values[0])
            if sample_temp > 32:
                factors.append('high_temperature')
            if np.random.rand() < 0.05:
                factors.append('heavy_rainfall')
            if np.random.rand() < 0.03:
                factors.append('poor_air_quality')
            writer.writerow({
                'region_id': region,
                'date': date.date().isoformat(),
                'disease_code': hist['case_count'].idxmax() if len(hist) else 'A90',
                'outbreak_occurred': 1 if is_outbreak else 0,
                'outbreak_severity': severity,
                'days_until_outbreak': 0 if is_outbreak else np.random.randint(7,21),
                'contributing_factors': ','.join(factors) if factors else 'none'
            })
            written += 1
            pbar.update(1)
        pbar.close()
    return written

# ---------------------------
# Orchestration
# ---------------------------
def main():
    print("="*80)
    print("LARGE-SCALE SURVEILLANCE DATASET GENERATOR (streaming, scalable)")
    print("="*80)

    # Acquire city file
    city_path = ensure_city_file()
    print(f"Loaded city source: {city_path}")
    if city_path.endswith(".txt"):
        cities_df = load_cities_geonames(city_path)
    else:
        cities_df = load_cities_simplemaps(city_path)
    print(f"Cities available: {len(cities_df):,} (sample: {cities_df.head(2).to_dict('records')})")

    # ICD codes
    icd_path = ensure_icd_file()
    icd_df = load_icd_codes(icd_path)
    print(f"Loaded ICD codes count: {len(icd_df):,}")

    # Regions
    regions_out = os.path.join(Config.OUTPUT_DIR, "regions.csv")
    print("\nGenerating regions (this may take a while)...")
    regions_df = generate_regions_from_cities(cities_df, Config.TARGET_REGIONS)
    regions_df.to_csv(regions_out, index=False)
    print(f"Saved regions: {regions_out} ({len(regions_df):,} rows)")

    # Environmental data
    env_out = os.path.join(Config.OUTPUT_DIR, "environmental_data.csv")
    print("\nStreaming environmental data...")
    env_written = stream_environmental_data(regions_df, Config.START_DATE, Config.END_DATE, Config.TARGET_ENV_ROWS, env_out)
    print(f"Environmental rows written: {env_written:,} -> {env_out}")

    # Surveillance
    surv_out = os.path.join(Config.OUTPUT_DIR, "disease_surveillance_historical.csv")
    print("\nStreaming disease surveillance data...")
    surv_written = stream_surveillance(regions_df, icd_df, env_out, Config.START_DATE, Config.END_DATE, Config.TARGET_SURVEILLANCE, surv_out)
    print(f"Surveillance rows written: {surv_written:,} -> {surv_out}")

    # Patients
    patients_out = os.path.join(Config.OUTPUT_DIR, "patient_diagnoses_raw.csv")
    print("\nStreaming patient diagnoses...")
    patients_written = stream_patients(surv_out, Config.TARGET_PATIENTS, patients_out)
    print(f"Patient rows written: {patients_written:,} -> {patients_out}")

    # Labels
    labels_out = os.path.join(Config.OUTPUT_DIR, "outbreak_labels.csv")
    print("\nStreaming outbreak labels...")
    labels_written = stream_labels(regions_df, surv_out, env_out, Config.TARGET_LABELS, labels_out)
    print(f"Labels rows written: {labels_written:,} -> {labels_out}")

    # Summary
    manifest = {
        'regions': {'path': regions_out, 'rows': len(regions_df)},
        'environmental_data': {'path': env_out, 'rows': env_written},
        'disease_surveillance_historical': {'path': surv_out, 'rows': surv_written},
        'patient_diagnoses_raw': {'path': patients_out, 'rows': patients_written},
        'outbreak_labels': {'path': labels_out, 'rows': labels_written},
        'config': {
            'target_regions': Config.TARGET_REGIONS,
            'target_env_rows': Config.TARGET_ENV_ROWS,
            'target_surveillance': Config.TARGET_SURVEILLANCE,
            'target_patients': Config.TARGET_PATIENTS,
            'target_labels': Config.TARGET_LABELS,
            'date_range': f"{Config.START_DATE} to {Config.END_DATE}"
        }
    }
    with open(os.path.join(Config.OUTPUT_DIR,'dataset_manifest.json'),'w') as mf:
        json.dump(manifest, mf, indent=2)
    print("\n==== DATASET GENERATION COMPLETE ====")
    print(json.dumps(manifest, indent=2))
    print(f"Files saved to: {os.path.abspath(Config.OUTPUT_DIR)}")

if __name__ == "__main__":
    main()
