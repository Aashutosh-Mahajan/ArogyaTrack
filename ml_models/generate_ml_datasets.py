import pandas as pd
import numpy as np
import random
from faker import Faker
from datetime import date
from datetime import datetime, timedelta
import os

fake = Faker()
np.random.seed(42)
random.seed(42)

os.makedirs("ml_datasets", exist_ok=True)

# -------------------------------------------------
# REGIONS (100 regions to scale data)
# -------------------------------------------------
regions = []
states = ["Maharashtra","Delhi","Karnataka","Tamil Nadu","West Bengal"]

for i in range(1,101):
    regions.append([
        i,
        f"Region_{i}",
        "ward",
        None,
        random.choice(states),
        round(random.uniform(8,28),4),
        round(random.uniform(72,88),4),
        random.randint(80000,700000),
        round(random.uniform(5,35),1),
        random.randint(5,20),
        round(random.uniform(5.0,9.0),1)
    ])

regions_df = pd.DataFrame(regions, columns=[
    "region_id","region_name","region_type","parent_region_id",
    "state","latitude","longitude","population",
    "area_sq_km","hospital_count","sanitation_index"
])

regions_df.to_csv("ml_datasets/regions.csv", index=False)

# -------------------------------------------------
# DATE RANGE (120 DAYS)
# -------------------------------------------------
dates = pd.date_range("2024-10-01", "2025-01-28")

# -------------------------------------------------
# DISEASE DEFINITIONS
# -------------------------------------------------
diseases = {
    "A90":("Dengue Fever",(2,8)),
    "B50":("Malaria",(1,5)),
    "A01":("Typhoid Fever",(3,7)),
    "A00":("Cholera",(1,4)),
    "U07.1":("COVID-19",(5,15)),
    "A15":("Tuberculosis",(2,6)),
    "J18":("Pneumonia",(4,9)),
    "A09":("Gastroenteritis",(5,12)),
    "B15":("Hepatitis A",(1,3)),
    "J10":("Influenza",(6,14))
}

# -------------------------------------------------
# ENVIRONMENTAL DATA (~12,000 rows)
# -------------------------------------------------
env_rows = []

for d in dates:
    for r in regions_df.itertuples():
        temp = np.random.uniform(20,38)
        humidity = np.random.randint(40,90)
        rainfall = np.random.uniform(0,30)
        aqi = np.random.randint(90,250)
        env_rows.append([
            d.date(), r.region_id, round(temp,1), humidity,
            round(rainfall,1), aqi,
            int(aqi*0.5), int(aqi*0.7),
            round(r.sanitation_index + random.uniform(-0.5,0.5),1)
        ])

env_df = pd.DataFrame(env_rows, columns=[
    "date","region_id","temperature_celsius","humidity_percent",
    "rainfall_mm","aqi","pm25","pm10","water_quality_index"
])

env_df.to_csv("ml_datasets/environmental_data.csv", index=False)

# -------------------------------------------------
# DISEASE SURVEILLANCE (~12,000 rows)
# -------------------------------------------------
surv_rows = []

for d in dates:
    for r in regions_df.itertuples():
        for code,(name,base) in random.sample(list(diseases.items()),3):
            cases = random.randint(*base)
            severity = round(random.uniform(1.8,3.4),2)

            if r.region_id <= 20 and code == "A90" and d >= pd.Timestamp("2024-12-15"):
                cases *= random.randint(3,8)
                severity = round(random.uniform(2.8,3.5),2)

            if cases < 5:
                cases = 0

            surv_rows.append([
                d.date(), r.region_id, code, name,
                cases, severity,
                round((cases / r.population) * 100000,2)
            ])

surv_df = pd.DataFrame(surv_rows, columns=[
    "date","region_id","disease_code","disease_name",
    "case_count","severity_avg","population_normalized_rate"
])

surv_df.to_csv("ml_datasets/disease_surveillance_historical.csv", index=False)

# -------------------------------------------------
# PATIENT DIAGNOSES (~15,000 rows)
# -------------------------------------------------
patients = []
pid = 1

for _ in range(15000):
    disease = random.choice(list(diseases.items()))
    patients.append([
        pid,
        f"P{pid:05d}",
        random.randint(1,100),
        fake.date_between(
            start_date=date(2024, 10, 1),
            end_date=date(2025, 1, 28)
        ),
        disease[0],
        disease[1][0],
        random.choices(["mild","moderate","severe"], [0.6,0.3,0.1])[0],
        random.randint(18,75),
        random.choice(["M","F"]),
        ",".join(fake.words(3)),
        random.random() < 0.85
    ])
    pid += 1

patients_df = pd.DataFrame(patients, columns=[
    "diagnosis_id","patient_id","region_id","diagnosis_date",
    "disease_code","disease_name","severity",
    "age","gender","symptoms","consent_surveillance"
])

patients_df.to_csv("ml_datasets/patient_diagnoses_raw.csv", index=False)

# -------------------------------------------------
# OUTBREAK LABELS (~1,000 rows)
# -------------------------------------------------
labels = []

for _ in range(1000):
    labels.append([
        random.randint(1,100),
        fake.date_between(
            start_date=date(2024, 11, 1),
            end_date=date(2025, 1, 15)
        ),
        "A90",
        1,
        random.choice(["low","medium","high","critical"]),
        random.randint(0,21),
        "high_temperature,poor_sanitation,rising_cases"
    ])

labels_df = pd.DataFrame(labels, columns=[
    "region_id","date","disease_code","outbreak_occurred",
    "outbreak_severity","days_until_outbreak","contributing_factors"
])

labels_df.to_csv("ml_datasets/outbreak_labels.csv", index=False)

print("✅ ALL CSV FILES GENERATED SUCCESSFULLY")
