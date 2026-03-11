#!/usr/bin/env python3
"""
Generate Production-Quality CSV Data for Disease Surveillance ML Models
=======================================================================
Creates three CSV files that feed all 4 ML models and the Django dashboard:
  1. regions.csv              — 35 Indian regions with demographics
  2. disease_surveillance_historical.csv — 2+ years of daily case data
  3. environmental_data.csv   — Daily environmental readings per region

The data models realistic Indian disease epidemiology:
  - Seasonal patterns (monsoon → dengue/malaria, winter → flu/pneumonia)
  - Regional variation (population density, sanitation, climate zones)
  - Outbreak events with realistic build-up, peak, and decay
  - Environmental correlations (temp, rainfall, AQI → disease incidence)

Usage:
    python generate_csv_data.py                      # Default: 730 days, 35 regions
    python generate_csv_data.py --days 365           # 1 year
    python generate_csv_data.py --output ./my_data   # Custom output directory
"""

import os
import csv
import json
import argparse
import random
import math
from datetime import datetime, timedelta

import numpy as np

np.random.seed(42)
random.seed(42)

# ═══════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════

REGIONS = [
    # Maharashtra
    {"region_name": "Andheri_West", "region_type": "ward", "city": "Mumbai", "state": "Maharashtra", "lat": 19.1357, "lon": 72.8262, "pop": 650000, "area_sq_km": 18.5, "hosp": 12, "san": 6.5, "urban_rural": "urban"},
    {"region_name": "Borivali", "region_type": "ward", "city": "Mumbai", "state": "Maharashtra", "lat": 19.2304, "lon": 72.8569, "pop": 800000, "area_sq_km": 25.0, "hosp": 8, "san": 5.8, "urban_rural": "urban"},
    {"region_name": "Thane", "region_type": "district", "city": "Thane", "state": "Maharashtra", "lat": 19.2183, "lon": 72.9781, "pop": 1841488, "area_sq_km": 147.0, "hosp": 15, "san": 5.5, "urban_rural": "urban"},
    {"region_name": "Pune_City", "region_type": "ward", "city": "Pune", "state": "Maharashtra", "lat": 18.5204, "lon": 73.8567, "pop": 3124458, "area_sq_km": 331.0, "hosp": 20, "san": 7.0, "urban_rural": "urban"},
    {"region_name": "Nagpur", "region_type": "district", "city": "Nagpur", "state": "Maharashtra", "lat": 21.1458, "lon": 79.0882, "pop": 2405421, "area_sq_km": 228.0, "hosp": 18, "san": 5.2, "urban_rural": "urban"},
    {"region_name": "Nashik", "region_type": "district", "city": "Nashik", "state": "Maharashtra", "lat": 19.9975, "lon": 73.7898, "pop": 1486053, "area_sq_km": 264.0, "hosp": 10, "san": 5.0, "urban_rural": "urban"},
    # Karnataka
    {"region_name": "Koramangala", "region_type": "ward", "city": "Bangalore", "state": "Karnataka", "lat": 12.9352, "lon": 77.6245, "pop": 180000, "area_sq_km": 6.5, "hosp": 6, "san": 7.2, "urban_rural": "urban"},
    {"region_name": "Whitefield", "region_type": "ward", "city": "Bangalore", "state": "Karnataka", "lat": 12.9698, "lon": 77.7500, "pop": 250000, "area_sq_km": 12.0, "hosp": 5, "san": 6.8, "urban_rural": "urban"},
    {"region_name": "Mysore", "region_type": "district", "city": "Mysore", "state": "Karnataka", "lat": 12.2958, "lon": 76.6394, "pop": 920550, "area_sq_km": 128.0, "hosp": 10, "san": 6.0, "urban_rural": "urban"},
    {"region_name": "Hubli", "region_type": "district", "city": "Hubli", "state": "Karnataka", "lat": 15.3647, "lon": 75.1240, "pop": 943857, "area_sq_km": 202.0, "hosp": 8, "san": 5.3, "urban_rural": "urban"},
    # Delhi
    {"region_name": "Dwarka", "region_type": "ward", "city": "Delhi", "state": "Delhi", "lat": 28.5921, "lon": 77.0460, "pop": 700000, "area_sq_km": 56.0, "hosp": 7, "san": 6.0, "urban_rural": "urban"},
    {"region_name": "Rohini", "region_type": "ward", "city": "Delhi", "state": "Delhi", "lat": 28.7495, "lon": 77.0736, "pop": 1500000, "area_sq_km": 42.0, "hosp": 12, "san": 5.5, "urban_rural": "urban"},
    {"region_name": "Saket", "region_type": "ward", "city": "Delhi", "state": "Delhi", "lat": 28.5244, "lon": 77.2066, "pop": 300000, "area_sq_km": 8.0, "hosp": 5, "san": 7.0, "urban_rural": "urban"},
    {"region_name": "Karol_Bagh", "region_type": "ward", "city": "Delhi", "state": "Delhi", "lat": 28.6519, "lon": 77.1909, "pop": 400000, "area_sq_km": 10.0, "hosp": 6, "san": 5.0, "urban_rural": "urban"},
    # Tamil Nadu
    {"region_name": "T_Nagar", "region_type": "ward", "city": "Chennai", "state": "Tamil Nadu", "lat": 13.0418, "lon": 80.2341, "pop": 400000, "area_sq_km": 9.0, "hosp": 8, "san": 6.5, "urban_rural": "urban"},
    {"region_name": "Velachery", "region_type": "ward", "city": "Chennai", "state": "Tamil Nadu", "lat": 12.9759, "lon": 80.2209, "pop": 350000, "area_sq_km": 12.0, "hosp": 5, "san": 6.0, "urban_rural": "urban"},
    {"region_name": "Coimbatore", "region_type": "district", "city": "Coimbatore", "state": "Tamil Nadu", "lat": 11.0168, "lon": 76.9558, "pop": 1061447, "area_sq_km": 107.0, "hosp": 14, "san": 6.8, "urban_rural": "urban"},
    {"region_name": "Madurai", "region_type": "district", "city": "Madurai", "state": "Tamil Nadu", "lat": 9.9252, "lon": 78.1198, "pop": 1017865, "area_sq_km": 148.0, "hosp": 11, "san": 5.5, "urban_rural": "urban"},
    # West Bengal
    {"region_name": "Salt_Lake_City", "region_type": "ward", "city": "Kolkata", "state": "West Bengal", "lat": 22.5843, "lon": 88.4175, "pop": 280000, "area_sq_km": 12.0, "hosp": 4, "san": 6.0, "urban_rural": "urban"},
    {"region_name": "Howrah", "region_type": "district", "city": "Howrah", "state": "West Bengal", "lat": 22.5958, "lon": 88.2636, "pop": 1077075, "area_sq_km": 63.0, "hosp": 9, "san": 4.8, "urban_rural": "urban"},
    # Gujarat
    {"region_name": "Ahmedabad", "region_type": "district", "city": "Ahmedabad", "state": "Gujarat", "lat": 23.0225, "lon": 72.5714, "pop": 5577940, "area_sq_km": 464.0, "hosp": 25, "san": 6.2, "urban_rural": "urban"},
    {"region_name": "Surat", "region_type": "district", "city": "Surat", "state": "Gujarat", "lat": 21.1702, "lon": 72.8311, "pop": 4467797, "area_sq_km": 327.0, "hosp": 20, "san": 6.0, "urban_rural": "urban"},
    # Rajasthan
    {"region_name": "Jaipur", "region_type": "district", "city": "Jaipur", "state": "Rajasthan", "lat": 26.9124, "lon": 75.7873, "pop": 3046163, "area_sq_km": 467.0, "hosp": 18, "san": 5.5, "urban_rural": "urban"},
    {"region_name": "Jodhpur", "region_type": "district", "city": "Jodhpur", "state": "Rajasthan", "lat": 26.2389, "lon": 73.0243, "pop": 1033918, "area_sq_km": 321.0, "hosp": 8, "san": 4.5, "urban_rural": "semi-urban"},
    # Uttar Pradesh
    {"region_name": "Lucknow", "region_type": "district", "city": "Lucknow", "state": "Uttar Pradesh", "lat": 26.8467, "lon": 80.9462, "pop": 2817105, "area_sq_km": 350.0, "hosp": 16, "san": 5.0, "urban_rural": "urban"},
    {"region_name": "Noida", "region_type": "ward", "city": "Noida", "state": "Uttar Pradesh", "lat": 28.5355, "lon": 77.3910, "pop": 637272, "area_sq_km": 203.0, "hosp": 8, "san": 6.5, "urban_rural": "urban"},
    {"region_name": "Varanasi", "region_type": "district", "city": "Varanasi", "state": "Uttar Pradesh", "lat": 25.3176, "lon": 82.9739, "pop": 1201815, "area_sq_km": 82.0, "hosp": 10, "san": 4.2, "urban_rural": "urban"},
    # Telangana
    {"region_name": "Hyderabad", "region_type": "district", "city": "Hyderabad", "state": "Telangana", "lat": 17.3850, "lon": 78.4867, "pop": 6809970, "area_sq_km": 650.0, "hosp": 30, "san": 6.8, "urban_rural": "urban"},
    {"region_name": "Secunderabad", "region_type": "ward", "city": "Secunderabad", "state": "Telangana", "lat": 17.4399, "lon": 78.4983, "pop": 520000, "area_sq_km": 25.0, "hosp": 7, "san": 6.3, "urban_rural": "urban"},
    # Kerala
    {"region_name": "Kochi", "region_type": "district", "city": "Kochi", "state": "Kerala", "lat": 9.9312, "lon": 76.2673, "pop": 677381, "area_sq_km": 94.0, "hosp": 12, "san": 7.5, "urban_rural": "urban"},
    {"region_name": "Thiruvananthapuram", "region_type": "district", "city": "Thiruvananthapuram", "state": "Kerala", "lat": 8.5241, "lon": 76.9366, "pop": 957730, "area_sq_km": 215.0, "hosp": 14, "san": 7.8, "urban_rural": "urban"},
    # Other major states
    {"region_name": "Bhopal", "region_type": "district", "city": "Bhopal", "state": "Madhya Pradesh", "lat": 23.2599, "lon": 77.4126, "pop": 1798218, "area_sq_km": 286.0, "hosp": 12, "san": 5.2, "urban_rural": "urban"},
    {"region_name": "Patna", "region_type": "district", "city": "Patna", "state": "Bihar", "lat": 25.6093, "lon": 85.1376, "pop": 1684222, "area_sq_km": 136.0, "hosp": 10, "san": 4.0, "urban_rural": "urban"},
    {"region_name": "Chandigarh", "region_type": "district", "city": "Chandigarh", "state": "Chandigarh", "lat": 30.7333, "lon": 76.7794, "pop": 1055450, "area_sq_km": 114.0, "hosp": 10, "san": 7.5, "urban_rural": "urban"},
    {"region_name": "Guwahati", "region_type": "district", "city": "Guwahati", "state": "Assam", "lat": 26.1445, "lon": 91.7362, "pop": 968000, "area_sq_km": 216.0, "hosp": 8, "san": 5.0, "urban_rural": "semi-urban"},
]

DISEASES = {
    "A90":   {"name": "Dengue Fever",       "base_rate": 35,  "seasonality": "monsoon",    "severity_range": (1.5, 4.0)},
    "U07.1": {"name": "COVID-19",           "base_rate": 45,  "seasonality": "year_round", "severity_range": (1.0, 4.5)},
    "B50.0": {"name": "Malaria",            "base_rate": 25,  "seasonality": "monsoon",    "severity_range": (2.0, 4.5)},
    "A00.9": {"name": "Cholera",            "base_rate": 12,  "seasonality": "monsoon",    "severity_range": (2.5, 4.0)},
    "J10.1": {"name": "Influenza",          "base_rate": 50,  "seasonality": "winter",     "severity_range": (1.0, 3.0)},
    "J18.9": {"name": "Pneumonia",          "base_rate": 30,  "seasonality": "winter",     "severity_range": (2.0, 4.0)},
    "B05":   {"name": "Measles",            "base_rate": 10,  "seasonality": "winter",     "severity_range": (1.5, 3.5)},
    "A09":   {"name": "Gastroenteritis",    "base_rate": 40,  "seasonality": "summer",     "severity_range": (1.0, 3.0)},
    "J45.9": {"name": "Asthma",            "base_rate": 20,  "seasonality": "winter",     "severity_range": (1.5, 3.5)},
    "I10":   {"name": "Hypertension",       "base_rate": 55,  "seasonality": "year_round", "severity_range": (1.0, 2.5)},
    "E11":   {"name": "Type 2 Diabetes",    "base_rate": 40,  "seasonality": "year_round", "severity_range": (1.0, 2.5)},
    "K29.7": {"name": "Gastritis",          "base_rate": 25,  "seasonality": "summer",     "severity_range": (1.0, 2.5)},
    "A39.9": {"name": "Meningococcal Infection", "base_rate": 5, "seasonality": "winter", "severity_range": (3.0, 4.5)},
    "B16":   {"name": "Hepatitis B",        "base_rate": 8,   "seasonality": "year_round", "severity_range": (2.0, 4.0)},
    "A37.9": {"name": "Whooping Cough",     "base_rate": 7,   "seasonality": "winter",     "severity_range": (1.5, 3.0)},
}

SEASONAL_MULTIPLIERS = {
    "monsoon":    {1:0.3, 2:0.3, 3:0.4, 4:0.6, 5:0.9, 6:2.5, 7:3.8, 8:4.2, 9:3.0, 10:1.5, 11:0.5, 12:0.3},
    "winter":     {1:3.2, 2:2.8, 3:1.5, 4:0.5, 5:0.3, 6:0.2, 7:0.2, 8:0.3, 9:0.4, 10:1.2, 11:2.2, 12:3.5},
    "summer":     {1:0.4, 2:0.6, 3:1.5, 4:2.8, 5:3.5, 6:2.8, 7:1.2, 8:0.8, 9:0.5, 10:0.4, 11:0.3, 12:0.4},
    "year_round": {m: 1.0 + 0.15 * math.sin(2 * math.pi * m / 12) for m in range(1, 13)},
}

CLIMATE_ZONES = {
    "Maharashtra": "tropical_wet",
    "Karnataka":   "tropical_wet",
    "Delhi":       "semi_arid",
    "Tamil Nadu":  "tropical_wet",
    "West Bengal": "tropical_wet",
    "Gujarat":     "semi_arid",
    "Rajasthan":   "arid",
    "Uttar Pradesh": "subtropical",
    "Telangana":   "tropical_dry",
    "Kerala":      "tropical_wet",
    "Madhya Pradesh": "subtropical",
    "Bihar":       "subtropical",
    "Chandigarh":  "subtropical",
    "Assam":       "subtropical_humid",
}

# Temperature baselines by climate zone (month: (mean_temp, std_dev))
TEMP_PROFILES = {
    "tropical_wet":      {m: (26 + 6*math.sin(2*math.pi*(m-4)/12), 2.5) for m in range(1,13)},
    "semi_arid":         {m: (22 + 14*math.sin(2*math.pi*(m-5)/12), 3.0) for m in range(1,13)},
    "arid":              {m: (24 + 15*math.sin(2*math.pi*(m-5)/12), 4.0) for m in range(1,13)},
    "subtropical":       {m: (20 + 12*math.sin(2*math.pi*(m-5)/12), 3.0) for m in range(1,13)},
    "tropical_dry":      {m: (27 + 6*math.sin(2*math.pi*(m-4)/12), 2.0) for m in range(1,13)},
    "subtropical_humid": {m: (22 + 10*math.sin(2*math.pi*(m-5)/12), 2.5) for m in range(1,13)},
}

# Rainfall patterns (mm/day) by climate zone
RAINFALL_PROFILES = {
    "tropical_wet":      {1:1, 2:1, 3:2, 4:4, 5:8, 6:25, 7:35, 8:30, 9:18, 10:8, 11:3, 12:1},
    "semi_arid":         {1:2, 2:2, 3:1, 4:1, 5:2, 6:8, 7:15, 8:12, 9:6, 10:2, 11:1, 12:1},
    "arid":              {1:0.5, 2:0.5, 3:0.3, 4:0.2, 5:0.5, 6:3, 7:8, 8:6, 9:3, 10:1, 11:0.3, 12:0.3},
    "subtropical":       {1:3, 2:3, 3:2, 4:2, 5:4, 6:12, 7:25, 8:22, 9:12, 10:4, 11:2, 12:2},
    "tropical_dry":      {1:1, 2:1, 3:2, 4:3, 5:6, 6:12, 7:15, 8:14, 9:10, 10:5, 11:2, 12:1},
    "subtropical_humid": {1:2, 2:3, 3:5, 4:8, 5:12, 6:20, 7:28, 8:25, 9:15, 10:6, 11:3, 12:2},
}

INDIAN_HOLIDAYS = [
    (1, 26), (3, 14), (10, 2), (8, 15), (12, 25), (5, 1),
    (1, 15), (4, 10), (11, 1), (10, 25), (11, 12), (4, 14),
]


def generate_outbreak_events(n_days, n_regions, n_diseases):
    """Generate realistic outbreak events distributed across the timeline."""
    outbreaks = []
    n_outbreaks = max(15, n_days * n_regions * n_diseases // 8000)

    for _ in range(n_outbreaks):
        start_day = random.randint(30, n_days - 40)
        duration = random.randint(10, 35)
        peak_day = start_day + random.randint(duration // 3, 2 * duration // 3)
        intensity = random.uniform(2.0, 6.0)
        region_ids = random.sample(range(n_regions), min(random.randint(1, 5), n_regions))
        disease_idx = random.randint(0, n_diseases - 1)

        outbreaks.append({
            "start": start_day,
            "end": start_day + duration,
            "peak": peak_day,
            "intensity": intensity,
            "regions": region_ids,
            "disease_idx": disease_idx,
        })
    return outbreaks


def generate_surveillance_data(regions, diseases, start_date, n_days, outbreaks):
    """Generate daily surveillance records for every region × disease combination."""
    disease_codes = list(diseases.keys())
    rows = []

    for day in range(n_days):
        current_date = start_date + timedelta(days=day)
        month = current_date.month
        day_of_week = current_date.weekday()
        is_holiday = (current_date.month, current_date.day) in INDIAN_HOLIDAYS

        for rid, region in enumerate(regions):
            pop_factor = region["pop"] / 1_000_000  # Scale cases by population (millions)
            san_factor = (10 - region["san"]) / 5.0  # Lower sanitation → more cases

            for didx, disease_code in enumerate(disease_codes):
                disease = diseases[disease_code]
                base = disease["base_rate"]
                season_type = disease["seasonality"]
                sev_lo, sev_hi = disease["severity_range"]

                # Seasonal multiplier
                seasonal = SEASONAL_MULTIPLIERS[season_type][month]

                # Population scaling (sub-linear)
                case_base = base * (pop_factor ** 0.6) * (1 + 0.15 * san_factor)

                # Day-of-week effect (slight dip on weekends due to reporting)
                dow_factor = 0.88 if day_of_week >= 5 else 1.0
                # Holiday effect
                holiday_factor = 0.75 if is_holiday else 1.0

                # Compute expected cases
                expected = case_base * seasonal * dow_factor * holiday_factor

                # Add outbreak contribution
                outbreak_boost = 0
                for ob in outbreaks:
                    if ob["disease_idx"] == didx and rid in ob["regions"]:
                        if ob["start"] <= day <= ob["end"]:
                            # Bell-curve centered at peak
                            dist_from_peak = abs(day - ob["peak"])
                            sigma = (ob["end"] - ob["start"]) / 4
                            ob_factor = ob["intensity"] * math.exp(-0.5 * (dist_from_peak / max(sigma, 1)) ** 2)
                            outbreak_boost += ob_factor * base * pop_factor

                total = expected + outbreak_boost

                # Add noise
                noise_std = max(total * 0.25, 2)
                case_count = max(0, int(np.random.normal(total, noise_std)))

                # Severity correlates with case surge
                if outbreak_boost > 0 and total > expected * 1.5:
                    severity_avg = round(np.random.uniform(sev_lo + 0.5, sev_hi), 2)
                else:
                    severity_avg = round(np.random.uniform(sev_lo, sev_hi - 0.3), 2)

                # Outbreak flag: cases > 1.5× seasonal baseline for this disease+region
                threshold = expected * 1.5
                outbreak_occurred = 1 if case_count > threshold and case_count > 10 else 0

                rows.append({
                    "date": current_date.strftime("%Y-%m-%d"),
                    "region_id": rid + 1,
                    "disease_code": disease_code,
                    "disease_name": disease["name"],
                    "case_count": case_count,
                    "severity_avg": severity_avg,
                    "outbreak_occurred": outbreak_occurred,
                })

    return rows


def generate_environmental_data(regions, start_date, n_days):
    """Generate daily environmental readings for each region."""
    rows = []

    for day in range(n_days):
        current_date = start_date + timedelta(days=day)
        month = current_date.month

        for rid, region in enumerate(regions):
            climate = CLIMATE_ZONES.get(region["state"], "subtropical")
            temp_profile = TEMP_PROFILES.get(climate, TEMP_PROFILES["subtropical"])
            rain_profile = RAINFALL_PROFILES.get(climate, RAINFALL_PROFILES["subtropical"])

            # Temperature
            mean_temp, temp_std = temp_profile[month]
            temperature = round(np.random.normal(mean_temp, temp_std), 1)

            # Humidity (correlated with rainfall and temperature)
            base_humidity = 45 + 25 * (rain_profile[month] / max(rain_profile.values()))
            humidity = round(np.clip(np.random.normal(base_humidity, 8), 15, 98), 1)

            # Rainfall (exponential distribution scaled by profile)
            rain_base = rain_profile[month]
            if rain_base > 1:
                rainfall = round(max(0, np.random.exponential(rain_base)), 1)
            else:
                rainfall = round(max(0, rain_base * np.random.exponential(1)), 1)

            # AQI: worse in winter (inversion), better during monsoon (washout)
            aqi_base = {1:140, 2:130, 3:110, 4:90, 5:80, 6:60, 7:50, 8:55, 9:70, 10:95, 11:160, 12:175}[month]
            # Delhi-NCR has higher AQI
            if region["state"] in ("Delhi", "Uttar Pradesh"):
                aqi_base *= 1.4
            elif region["state"] in ("Kerala", "Karnataka"):
                aqi_base *= 0.7
            aqi = max(20, int(np.random.normal(aqi_base, 20)))

            # PM2.5 and PM10 correlate with AQI
            pm25 = round(max(5, aqi * np.random.uniform(0.15, 0.45)), 1)
            pm10 = round(max(10, aqi * np.random.uniform(0.35, 0.85)), 1)

            # Water quality (higher = better, 0-10 scale)
            base_wqi = region["san"]
            # Monsoon degrades water quality
            monsoon_deg = -1.5 if month in (6, 7, 8, 9) else 0
            wqi = round(np.clip(np.random.normal(base_wqi + monsoon_deg, 0.6), 2.0, 10.0), 1)

            rows.append({
                "date": current_date.strftime("%Y-%m-%d"),
                "region_id": rid + 1,
                "temperature_celsius": temperature,
                "humidity_percent": humidity,
                "rainfall_mm": rainfall,
                "aqi": aqi,
                "pm25": pm25,
                "pm10": pm10,
                "water_quality_index": wqi,
            })

    return rows


def write_csv(filepath, rows, fieldnames):
    """Write rows to a CSV file."""
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"  ✓ {filepath} ({len(rows):,} rows)")


def main():
    parser = argparse.ArgumentParser(description="Generate surveillance CSV data")
    parser.add_argument("--days", type=int, default=730, help="Number of days of data (default: 730)")
    parser.add_argument("--output", type=str, default=None, help="Output directory")
    args = parser.parse_args()

    n_days = args.days
    start_date = datetime(2024, 1, 1)

    # Output directory
    if args.output:
        out_dir = args.output
    else:
        out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "india_surveillance_extreme_quality")
    os.makedirs(out_dir, exist_ok=True)

    print(f"\n{'='*60}")
    print(f" Generating Production Surveillance CSV Data")
    print(f"{'='*60}")
    print(f"  Regions  : {len(REGIONS)}")
    print(f"  Diseases : {len(DISEASES)}")
    print(f"  Days     : {n_days}")
    print(f"  Date range: {start_date.strftime('%Y-%m-%d')} → {(start_date + timedelta(days=n_days-1)).strftime('%Y-%m-%d')}")
    print(f"  Output   : {out_dir}")
    print(f"{'='*60}\n")

    # 1. Regions CSV
    print("Generating regions.csv ...")
    region_rows = []
    for rid, r in enumerate(REGIONS):
        region_rows.append({
            "region_id": rid + 1,
            "region_name": r["region_name"],
            "region_type": r["region_type"],
            "city": r["city"],
            "state": r["state"],
            "latitude": r["lat"],
            "longitude": r["lon"],
            "population": r["pop"],
            "area_sq_km": r["area_sq_km"],
            "hospital_count": r["hosp"],
            "sanitation_index": r["san"],
            "urban_rural": r["urban_rural"],
        })
    write_csv(
        os.path.join(out_dir, "regions.csv"),
        region_rows,
        ["region_id", "region_name", "region_type", "city", "state",
         "latitude", "longitude", "population", "area_sq_km",
         "hospital_count", "sanitation_index", "urban_rural"],
    )

    # 2. Surveillance CSV
    print("Generating disease_surveillance_historical.csv ...")
    outbreaks = generate_outbreak_events(n_days, len(REGIONS), len(DISEASES))
    print(f"  Generated {len(outbreaks)} outbreak events")
    surv_rows = generate_surveillance_data(REGIONS, DISEASES, start_date, n_days, outbreaks)
    write_csv(
        os.path.join(out_dir, "disease_surveillance_historical.csv"),
        surv_rows,
        ["date", "region_id", "disease_code", "disease_name",
         "case_count", "severity_avg", "outbreak_occurred"],
    )

    # 3. Environmental CSV
    print("Generating environmental_data.csv ...")
    env_rows = generate_environmental_data(REGIONS, start_date, n_days)
    write_csv(
        os.path.join(out_dir, "environmental_data.csv"),
        env_rows,
        ["date", "region_id", "temperature_celsius", "humidity_percent",
         "rainfall_mm", "aqi", "pm25", "pm10", "water_quality_index"],
    )

    # 4. Metadata
    outbreak_count = sum(1 for r in surv_rows if r["outbreak_occurred"] == 1)
    metadata = {
        "data_type": "production_surveillance_data",
        "created_date": datetime.now().isoformat(),
        "parameters": {
            "n_regions": len(REGIONS),
            "n_diseases": len(DISEASES),
            "n_days": n_days,
            "start_date": start_date.strftime("%Y-%m-%d"),
            "end_date": (start_date + timedelta(days=n_days - 1)).strftime("%Y-%m-%d"),
            "seed": 42,
        },
        "files": {
            "regions": "regions.csv",
            "disease_surveillance_historical": "disease_surveillance_historical.csv",
            "environmental_data": "environmental_data.csv",
        },
        "statistics": {
            "n_regions": len(REGIONS),
            "n_diseases": len(DISEASES),
            "n_surveillance_records": len(surv_rows),
            "n_environmental_records": len(env_rows),
            "n_outbreak_events": len(outbreaks),
            "outbreak_record_percentage": round(outbreak_count / len(surv_rows) * 100, 2),
            "date_range": f"{start_date.strftime('%Y-%m-%d')} to {(start_date + timedelta(days=n_days-1)).strftime('%Y-%m-%d')}",
            "diseases": list(DISEASES.keys()),
            "states": list(set(r["state"] for r in REGIONS)),
        },
    }
    meta_path = os.path.join(out_dir, "dataset_metadata.json")
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"  ✓ {meta_path}")

    print(f"\n{'='*60}")
    print(f" DATA GENERATION COMPLETE")
    print(f"   Surveillance records : {len(surv_rows):>10,}")
    print(f"   Environmental records: {len(env_rows):>10,}")
    print(f"   Outbreak % of records: {outbreak_count / len(surv_rows) * 100:>9.1f}%")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
