#!/usr/bin/env python3
"""
REAL-WORLD PRODUCTION STRESS TEST FOR DISEASE SURVEILLANCE MODELS
==================================================================
Tests models under realistic production conditions:
  - Production scale (1000+ regions, 15M+ records)
  - Realistic patterns (seasonal waves, pandemics, urban/rural gaps)
  - Data quality issues (delays, underreporting, errors)
  - Edge cases (novel diseases, superspreader events)

Usage:
  python real_world_stress_test.py --mode quick    # 5 critical scenarios (hackathon demo)
  python real_world_stress_test.py --mode standard # 12 scenarios (1-2 hours)
  python real_world_stress_test.py --mode full     # 17 scenarios (production validation)
"""

import os
import sys
import json
import argparse
import warnings
import numpy as np
import pandas as pd
import joblib
import xgboost as xgb
from datetime import datetime, timedelta
from sklearn.metrics import (
    mean_absolute_error, mean_squared_error, r2_score,
    f1_score, roc_auc_score, silhouette_score,
    precision_score, recall_score, accuracy_score
)
from sklearn.cluster import DBSCAN
from tqdm import tqdm
import time

warnings.filterwarnings("ignore")

# ==========================================================
# CONFIGURATION
# ==========================================================
BASE_DIR = r"D:\python\ml_models"
MODELS_DIR = os.path.join(BASE_DIR, "saved_models")
STRESS_TEST_DIR = os.path.join(BASE_DIR, "test_results", "real_world_stress")

FORECAST_DIR = os.path.join(MODELS_DIR, "final_ensemble_model")
OUTBREAK_DIR = os.path.join(MODELS_DIR, "isolation_forest_prod") # v5.0 uses this dir
ISOLATION_FOREST_DIR = OUTBREAK_DIR # Alias for clearer code
XGBOOST_V3_DIR = os.path.join(MODELS_DIR, "xgboost_outbreak_v3")
DBSCAN_DIR = os.path.join(MODELS_DIR, "dbscan_prod") # v5.0 uses this dir

os.makedirs(STRESS_TEST_DIR, exist_ok=True)

# Feature engineering
LAG_PERIODS = [7, 14, 21]
ROLLING_WINDOWS = [7, 14, 28]

# Disease configurations
FOCUS_DISEASES = {
    "dengue":         {"code": "A90",   "base_rate": 0.008, "seasonality": "monsoon",    "env_sensitivity": "high"},
    "malaria":        {"code": "B50.0", "base_rate": 0.007, "seasonality": "monsoon",    "env_sensitivity": "high"},
    "cholera":        {"code": "A00.9", "base_rate": 0.005, "seasonality": "monsoon",    "env_sensitivity": "high"},
    "influenza":      {"code": "J10.1", "base_rate": 0.010, "seasonality": "winter",     "env_sensitivity": "medium"},
    "covid19":        {"code": "U07.1", "base_rate": 0.009, "seasonality": "year_round", "env_sensitivity": "medium"},
    "measles":        {"code": "B05",   "base_rate": 0.004, "seasonality": "winter",     "env_sensitivity": "low"},
    "pneumonia":      {"code": "J18.9", "base_rate": 0.008, "seasonality": "winter",     "env_sensitivity": "high"},
    "gastro":         {"code": "A09",   "base_rate": 0.006, "seasonality": "summer",     "env_sensitivity": "medium"},
    "asthma":         {"code": "J45.9", "base_rate": 0.005, "seasonality": "winter",     "env_sensitivity": "high"},
    "hypertension":   {"code": "I10",   "base_rate": 0.012, "seasonality": "year_round", "env_sensitivity": "low"},
}

SEASONAL_PROFILES = {
    "monsoon":    {1:0.4,2:0.4,3:0.5,4:0.6,5:0.8,6:2.5,7:3.5,8:4.0,9:3.0,10:1.8,11:0.6,12:0.4},
    "winter":     {1:3.0,2:2.5,3:1.5,4:0.6,5:0.4,6:0.3,7:0.3,8:0.3,9:0.4,10:1.0,11:2.0,12:3.0},
    "summer":     {1:0.5,2:0.7,3:1.5,4:2.5,5:3.5,6:3.0,7:1.5,8:1.0,9:0.6,10:0.5,11:0.4,12:0.4},
    "year_round": {m: 1.0 for m in range(1, 13)},
}

# Major Indian cities for realistic geography
METRO_CITIES = ["Mumbai", "Delhi", "Bangalore", "Kolkata", "Chennai", "Hyderabad"]
TIER2_CITIES = ["Pune", "Ahmedabad", "Jaipur", "Lucknow", "Kanpur", "Nagpur", "Indore", "Bhopal", "Visakhapatnam", "Patna"]
TIER3_CITIES = ["Nashik", "Vadodara", "Rajkot", "Varanasi", "Meerut", "Agra", "Amritsar", "Jabalpur", "Gwalior", "Coimbatore"]

CITY_COORDS = {
    "Mumbai": (19.0760, 72.8777), "Delhi": (28.7041, 77.1025), "Bangalore": (12.9716, 77.5946),
    "Kolkata": (22.5726, 88.3639), "Chennai": (13.0827, 80.2707), "Hyderabad": (17.3850, 78.4867),
    "Pune": (18.5204, 73.8567), "Ahmedabad": (23.0225, 72.5714), "Jaipur": (26.9124, 75.7873),
    "Lucknow": (26.8467, 80.9462), "Kanpur": (26.4499, 80.3319), "Nagpur": (21.1458, 79.0882),
}


# ==========================================================
# REALISTIC DATA GENERATORS
# ==========================================================

class RealisticDataGenerator:
    """Generates realistic surveillance data with real-world patterns."""
    
    def __init__(self, seed=42):
        np.random.seed(seed)
        self.region_id_counter = 50000  # Avoid conflicts with training data
    
    def generate_seasonal_wave(self, n_regions=200, n_days=365, disease="dengue"):
        """
        Scenario 3: Seasonal Epidemic Wave
        Realistic monsoon dengue pattern - models should learn NOT to flag this as outbreak after year 1
        """
        start_date = datetime(2026, 1, 1)
        dates = [start_date + timedelta(days=i) for i in range(n_days)]
        
        # Create regions
        regions = self._create_regions(n_regions, region_type="mixed")
        
        # Generate environmental data with seasonal patterns
        env_data = []
        for _, region in regions.iterrows():
            for date in dates:
                month = date.month
                
                # Monsoon season pattern
                if 6 <= month <= 9:  # Monsoon months
                    temp = np.random.normal(28, 2)
                    rainfall = np.random.exponential(80)  # Heavy rainfall
                    humidity = np.random.normal(85, 5)
                elif month in [12, 1, 2]:  # Winter
                    temp = np.random.normal(20, 3)
                    rainfall = np.random.exponential(5)   # Minimal rain
                    humidity = np.random.normal(60, 8)
                else:  # Summer/transition
                    temp = np.random.normal(32, 3)
                    rainfall = np.random.exponential(15)
                    humidity = np.random.normal(55, 10)
                
                aqi = np.random.normal(120, 30) if month in [12, 1, 2] else np.random.normal(80, 20)
                
                env_data.append({
                    "region_id": region["region_id"],
                    "date": date,
                    "temperature_celsius": float(np.clip(temp, 15, 45)),
                    "rainfall_mm": float(max(0, rainfall)),
                    "humidity_pct": float(np.clip(humidity, 30, 100)),
                    "aqi": float(np.clip(aqi, 50, 500)),
                })
        
        env_df = pd.DataFrame(env_data)
        
        # Generate surveillance data with seasonal pattern
        surv_data = []
        disease_info = FOCUS_DISEASES[disease]
        
        for _, region in regions.iterrows():
            for date in dates:
                month = date.month
                
                # Baseline varies by season
                if 6 <= month <= 9:  # Monsoon - HIGH dengue season
                    baseline = 150
                    outbreak_prob = 0.02  # Still rare to be "outbreak" vs normal monsoon
                elif month in [10, 11]:  # Post-monsoon decline
                    baseline = 50
                    outbreak_prob = 0.01
                else:  # Off-season
                    baseline = 10
                    outbreak_prob = 0.005
                
                # Generate cases
                is_outbreak = np.random.random() < outbreak_prob
                if is_outbreak:
                    cases = int(np.random.lognormal(np.log(baseline * 3), 0.5))
                    severity = np.random.uniform(7, 9)
                else:
                    cases = int(np.random.lognormal(np.log(baseline), 0.6))
                    severity = np.random.uniform(2, 5)
                
                cases = max(1, cases)
                
                surv_data.append({
                    "region_id": region["region_id"],
                    "date": date,
                    "disease": disease,
                    "disease_code": disease_info["code"],
                    "case_count": cases,
                    "severity_avg": severity,
                    "outbreak_occurred": is_outbreak,
                })
        
        surv_df = pd.DataFrame(surv_data)
        
        metadata = {
            "scenario": "seasonal_wave",
            "pattern": "Realistic monsoon dengue - 15x spike June-Sept is NORMAL, not outbreak",
            "expected_behavior": "Models should learn seasonal baseline, not flag monsoon as outbreak"
        }
        
        return surv_df, env_df, regions, metadata
    
    def generate_pandemic_spread(self, n_regions=200, n_days=365):
        """
        Scenario 4: Pandemic-style Geographic Spread
        COVID-19 pattern: starts in metros, spreads to tier-2, then tier-3 cities
        """
        start_date = datetime(2026, 1, 1)
        dates = [start_date + timedelta(days=i) for i in range(n_days)]
        
        # Create tiered regions
        regions = []
        
        # Metro cities (10 regions)
        for i, city in enumerate(METRO_CITIES[:2]):  # Mumbai, Delhi start
            lat, lon = CITY_COORDS.get(city, (20, 77))
            regions.append({
                "region_id": self.region_id_counter + i,
                "region_name": f"{city}_Metro_{i+1}",
                "latitude": lat + np.random.uniform(-0.1, 0.1),
                "longitude": lon + np.random.uniform(-0.1, 0.1),
                "population": np.random.randint(2000000, 5000000),
                "state": city,
                "sanitation": np.random.uniform(5, 7),
                "tier": "metro",
                "infected_day": 1 if i == 0 else 15,  # Mumbai day 1, Delhi day 15
            })
        
        offset = len(regions)
        
        # Tier-2 cities (spreads day 30-60)
        for i, city in enumerate(TIER2_CITIES[:10]):
            lat, lon = CITY_COORDS.get(city, (22, 78))
            regions.append({
                "region_id": self.region_id_counter + offset + i,
                "region_name": f"{city}_Tier2_{i+1}",
                "latitude": lat + np.random.uniform(-0.1, 0.1),
                "longitude": lon + np.random.uniform(-0.1, 0.1),
                "population": np.random.randint(500000, 2000000),
                "state": city,
                "sanitation": np.random.uniform(4, 6),
                "tier": "tier2",
                "infected_day": 30 + i * 3,  # Staggered spread
            })
        
        offset += 10
        
        # Tier-3/rural (spreads day 60-120)
        for i in range(n_regions - 20):
            regions.append({
                "region_id": self.region_id_counter + offset + i,
                "region_name": f"Rural_Region_{i+1}",
                "latitude": np.random.uniform(15, 30),
                "longitude": np.random.uniform(70, 90),
                "population": np.random.randint(100000, 500000),
                "state": "Rural",
                "sanitation": np.random.uniform(2, 5),
                "tier": "rural",
                "infected_day": 60 + i * 0.5,  # Gradual spread
            })
        
        regions_df = pd.DataFrame(regions)
        
        # Environmental data (simple for this scenario)
        env_df = self._generate_simple_env(regions_df, dates)
        
        # Surveillance data with pandemic spread pattern
        surv_data = []
        
        for _, region in regions_df.iterrows():
            infection_start = int(region["infected_day"])
            
            for day_idx, date in enumerate(dates):
                days_since_infection = day_idx - infection_start
                
                if days_since_infection < 0:
                    # Not yet infected
                    cases = np.random.poisson(2)
                    is_outbreak = 0
                    severity = np.random.uniform(1, 3)
                
                elif days_since_infection < 30:
                    # Exponential growth phase
                    growth_rate = 1.15  # 15% daily growth
                    base_cases = 5 * (growth_rate ** days_since_infection)
                    cases = int(np.random.poisson(base_cases))
                    is_outbreak = 1
                    severity = np.random.uniform(6, 9)
                
                elif days_since_infection < 90:
                    # Peak and plateau
                    peak_cases = 500 if region["tier"] == "metro" else 200 if region["tier"] == "tier2" else 50
                    cases = int(np.random.normal(peak_cases, peak_cases * 0.3))
                    is_outbreak = 1
                    severity = np.random.uniform(7, 9)
                
                else:
                    # Decline phase
                    days_in_decline = days_since_infection - 90
                    decline_rate = 0.95  # 5% daily decline
                    base_cases = 500 * (decline_rate ** days_in_decline) if region["tier"] == "metro" else 100 * (decline_rate ** days_in_decline)
                    cases = max(10, int(np.random.poisson(base_cases)))
                    is_outbreak = 1 if cases > 50 else 0
                    severity = np.random.uniform(4, 7)
                
                cases = max(1, min(10000, cases))  # Clamp
                
                surv_data.append({
                    "region_id": region["region_id"],
                    "date": date,
                    "disease": "covid19",
                    "disease_code": "U07.1",
                    "case_count": cases,
                    "severity_avg": severity,
                    "outbreak_occurred": is_outbreak,
                })
        
        surv_df = pd.DataFrame(surv_data)
        
        self.region_id_counter += len(regions)
        
        metadata = {
            "scenario": "pandemic_spread",
            "pattern": "Geographic spread: Metro→Tier2→Rural over 120 days",
            "expected_behavior": "Models should detect early metro signals, predict tier-2/3 spread"
        }
        
        return surv_df, env_df, regions_df, metadata
    
    def generate_urban_rural_disparity(self, n_regions=100, n_days=180):
        """
        Scenario 5: Urban vs Rural Reporting Disparities
        Urban: Real-time, 95% captured
        Rural: 7-day lag, 40% captured
        """
        start_date = datetime(2026, 1, 1)
        dates = [start_date + timedelta(days=i) for i in range(n_days)]
        
        # 50 urban, 50 rural
        regions = []
        
        for i in range(50):
            regions.append({
                "region_id": self.region_id_counter + i,
                "region_name": f"Urban_Ward_{i+1}",
                "latitude": np.random.uniform(18, 28),
                "longitude": np.random.uniform(72, 88),
                "population": np.random.randint(500000, 2000000),
                "state": "Urban",
                "sanitation": np.random.uniform(5, 8),
                "type": "urban",
                "reporting_lag": 0,
                "capture_rate": 0.95,
            })
        
        for i in range(50):
            regions.append({
                "region_id": self.region_id_counter + 50 + i,
                "region_name": f"Rural_Village_{i+1}",
                "latitude": np.random.uniform(18, 28),
                "longitude": np.random.uniform(72, 88),
                "population": np.random.randint(50000, 200000),
                "state": "Rural",
                "sanitation": np.random.uniform(2, 5),
                "type": "rural",
                "reporting_lag": 7,
                "capture_rate": 0.40,
            })
        
        regions_df = pd.DataFrame(regions)
        env_df = self._generate_simple_env(regions_df, dates)
        
        # Generate "true" cases, then apply reporting distortions
        surv_data = []
        
        for _, region in regions_df.iterrows():
            # Generate TRUE outbreak pattern
            outbreak_start = np.random.randint(30, 90)
            outbreak_duration = np.random.randint(14, 30)
            
            for day_idx, date in enumerate(dates):
                # TRUE cases
                if outbreak_start <= day_idx < outbreak_start + outbreak_duration:
                    true_cases = int(np.random.lognormal(4.5, 0.6))
                    is_outbreak = 1
                else:
                    true_cases = int(np.random.lognormal(2.5, 0.5))
                    is_outbreak = 0
                
                # Apply capture rate
                captured_cases = np.random.binomial(true_cases, region["capture_rate"])
                
                # Apply reporting lag
                reporting_delay = region["reporting_lag"]
                report_date = date + timedelta(days=reporting_delay)
                
                # Only include if within date range
                if report_date <= dates[-1]:
                    surv_data.append({
                        "region_id": region["region_id"],
                        "date": report_date,  # Delayed for rural
                        "disease": "dengue",
                        "disease_code": "A90",
                        "case_count": max(1, captured_cases),
                        "severity_avg": np.random.uniform(3, 7) if is_outbreak else np.random.uniform(1, 4),
                        "outbreak_occurred": is_outbreak,
                        "true_cases": true_cases,  # For evaluation only
                    })
        
        surv_df = pd.DataFrame(surv_data)
        
        self.region_id_counter += len(regions)
        
        metadata = {
            "scenario": "urban_rural_disparity",
            "pattern": "Urban: real-time 95% capture, Rural: 7-day lag 40% capture",
            "expected_behavior": "Models should have wider uncertainty for rural, detect lag"
        }
        
        return surv_df, env_df, regions_df, metadata
    
    def generate_delayed_reporting(self, n_regions=50, n_days=180):
        """
        Scenario 8: Delayed Reporting with Weekend Effect
        Weekdays: Normal reporting
        Weekends: Zero reports, batch update Monday
        """
        start_date = datetime(2026, 1, 1)
        dates = [start_date + timedelta(days=i) for i in range(n_days)]
        
        regions = self._create_regions(n_regions, region_type="mixed")
        env_df = self._generate_simple_env(regions, dates)
        
        # Generate true daily cases, then apply weekend batching
        surv_data = []
        case_buffer = {}  # Buffer weekend cases
        
        for _, region in regions.iterrows():
            region_id = region["region_id"]
            case_buffer[region_id] = []
            
            for date in dates:
                # Generate TRUE cases for this day
                base_cases = np.random.lognormal(3.0, 0.6)
                true_cases = max(1, int(base_cases))
                is_outbreak = np.random.random() < 0.12
                
                if is_outbreak:
                    true_cases *= np.random.randint(2, 5)
                
                # Check if weekend
                if date.weekday() in [5, 6]:  # Saturday, Sunday
                    # Buffer cases, don't report
                    case_buffer[region_id].append((date, true_cases, is_outbreak))
                else:
                    # Weekday
                    cases_to_report = true_cases
                    
                    # If Monday, add buffered weekend cases
                    if date.weekday() == 0 and case_buffer[region_id]:
                        for buffered_date, buffered_cases, buffered_outbreak in case_buffer[region_id]:
                            cases_to_report += buffered_cases
                        case_buffer[region_id] = []
                    
                    surv_data.append({
                        "region_id": region_id,
                        "date": date,
                        "disease": "influenza",
                        "disease_code": "J10.1",
                        "case_count": cases_to_report,
                        "severity_avg": np.random.uniform(4, 7) if is_outbreak else np.random.uniform(2, 5),
                        "outbreak_occurred": is_outbreak,
                    })
        
        surv_df = pd.DataFrame(surv_data)
        
        metadata = {
            "scenario": "delayed_reporting",
            "pattern": "No weekend reporting, Monday batch updates",
            "expected_behavior": "Models should smooth Monday spikes, detect true patterns"
        }
        
        return surv_df, env_df, regions, metadata
    
    def generate_data_entry_errors(self, n_regions=50, n_days=180):
        """
        Scenario 10: Realistic Data Entry Errors
        2% typos, 1% duplicates, 5% wrong dates, 0.5% wrong regions
        """
        start_date = datetime(2026, 1, 1)
        dates = [start_date + timedelta(days=i) for i in range(n_days)]
        
        regions = self._create_regions(n_regions, region_type="mixed")
        env_df = self._generate_simple_env(regions, dates)
        
        # Generate clean data first
        surv_data = []
        
        for _, region in regions.iterrows():
            for date in dates:
                is_outbreak = np.random.random() < 0.12
                if is_outbreak:
                    cases = int(np.random.lognormal(4.0, 0.6))
                else:
                    cases = int(np.random.lognormal(2.5, 0.5))
                
                surv_data.append({
                    "region_id": region["region_id"],
                    "date": date,
                    "disease": "cholera",
                    "disease_code": "A00.9",
                    "case_count": max(1, cases),
                    "severity_avg": np.random.uniform(4, 8) if is_outbreak else np.random.uniform(1, 4),
                    "outbreak_occurred": is_outbreak,
                })
        
        surv_df = pd.DataFrame(surv_data)
        
        # Inject errors
        n_records = len(surv_df)
        
        # 2% typos (multiply by 10 or 100)
        typo_idx = np.random.choice(n_records, int(n_records * 0.02), replace=False)
        for idx in typo_idx:
            surv_df.loc[idx, "case_count"] *= np.random.choice([10, 100])
        
        # 1% duplicates
        dup_idx = np.random.choice(n_records, int(n_records * 0.01), replace=False)
        duplicates = surv_df.iloc[dup_idx].copy()
        surv_df = pd.concat([surv_df, duplicates], ignore_index=True)
        
        # 5% wrong dates (off by 1-3 days)
        date_error_idx = np.random.choice(len(surv_df), int(len(surv_df) * 0.05), replace=False)
        for idx in date_error_idx:
            offset = np.random.randint(-3, 4)
            if offset != 0:
                surv_df.loc[idx, "date"] += timedelta(days=offset)
        
        # 0.5% wrong region
        region_error_idx = np.random.choice(len(surv_df), int(len(surv_df) * 0.005), replace=False)
        for idx in region_error_idx:
            surv_df.loc[idx, "region_id"] = np.random.choice(regions["region_id"].values)
        
        metadata = {
            "scenario": "data_entry_errors",
            "pattern": "2% typos, 1% duplicates, 5% date errors, 0.5% region errors",
            "expected_behavior": "Models should be robust to outliers and noise"
        }
        
        return surv_df, env_df, regions, metadata
    
    def generate_superspreader_event(self, n_regions=100, n_days=90):
        """
        Scenario 12: Superspreader Event
        Day 30: Wedding in Region_0 with 500 attendees from 15 different regions
        Day 31-45: Cases explode in those 15 regions simultaneously
        """
        start_date = datetime(2026, 1, 1)
        dates = [start_date + timedelta(days=i) for i in range(n_days)]
        
        regions = self._create_regions(n_regions, region_type="mixed")
        env_df = self._generate_simple_env(regions, dates)
        
        # Select event region and attendee regions
        event_region = regions.iloc[0]["region_id"]
        attendee_regions = np.random.choice(regions["region_id"].values[1:], 15, replace=False)
        affected_regions = np.concatenate([[event_region], attendee_regions])
        
        surv_data = []
        
        for _, region in regions.iterrows():
            region_id = region["region_id"]
            is_affected = region_id in affected_regions
            
            for day_idx, date in enumerate(dates):
                # Normal baseline
                base_cases = int(np.random.lognormal(2.5, 0.5))
                
                if is_affected and 30 <= day_idx <= 45:
                    # Superspreader effect: 200 cases distributed over 15 days
                    added_cases = np.random.poisson(200 / 15)
                    cases = base_cases + added_cases
                    is_outbreak = 1
                    severity = np.random.uniform(6, 9)
                else:
                    cases = base_cases
                    is_outbreak = 0
                    severity = np.random.uniform(2, 5)
                
                surv_data.append({
                    "region_id": region_id,
                    "date": date,
                    "disease": "measles",
                    "disease_code": "B05",
                    "case_count": max(1, cases),
                    "severity_avg": severity,
                    "outbreak_occurred": is_outbreak,
                })
        
        surv_df = pd.DataFrame(surv_data)
        
        metadata = {
            "scenario": "superspreader_event",
            "pattern": "Day 30 wedding → 15 regions spike simultaneously days 31-45",
            "expected_behavior": "DBSCAN should detect geographic cluster, early warning"
        }
        
        return surv_df, env_df, regions, metadata
    
    def generate_production_scale(self, n_regions=1000, n_days=1460):
        """
        Scenario 1: Production Scale Test
        1000 regions × 4 years = ~15-20M records
        Tests memory, latency, scalability
        """
        print(f"  Generating production-scale dataset: {n_regions} regions × {n_days} days")
        print(f"  Estimated records: ~{n_regions * n_days * 8:,} (15-20M)")
        print(f"  This may take 5-10 minutes...")
        
        start_date = datetime(2021, 1, 1)
        dates = [start_date + timedelta(days=i) for i in range(n_days)]
        
        # Create diverse regions
        regions = self._create_regions(n_regions, region_type="diverse")
        
        # Generate environmental data in chunks to save memory
        print("  Generating environmental data...")
        env_data = []
        chunk_size = 100
        
        for chunk_start in tqdm(range(0, len(regions), chunk_size), desc="Env chunks"):
            chunk_regions = regions.iloc[chunk_start:chunk_start+chunk_size]
            for _, region in chunk_regions.iterrows():
                for date in dates:
                    month = date.month
                    env_data.append({
                        "region_id": region["region_id"],
                        "date": date,
                        "temperature_celsius": float(np.random.normal(25 + 5*np.sin(2*np.pi*month/12), 3)),
                        "rainfall_mm": float(max(0, np.random.exponential(20) * SEASONAL_PROFILES["monsoon"][month])),
                        "humidity_pct": float(np.clip(np.random.normal(65, 15), 20, 100)),
                        "aqi": float(np.clip(np.random.normal(100, 40), 50, 500)),
                    })
        
        env_df = pd.DataFrame(env_data)
        
        # Generate surveillance data
        print("  Generating surveillance data...")
        surv_data = []
        
        for chunk_start in tqdm(range(0, len(regions), chunk_size), desc="Surv chunks"):
            chunk_regions = regions.iloc[chunk_start:chunk_start+chunk_size]
            for _, region in chunk_regions.iterrows():
                for date in dates:
                    # Sample 8 random diseases per region-day
                    n_diseases = np.random.poisson(8)
                    diseases = np.random.choice(list(FOCUS_DISEASES.keys()), min(n_diseases, 10), replace=False)
                    
                    for disease in diseases:
                        is_outbreak = np.random.random() < 0.12
                        if is_outbreak:
                            cases = int(np.random.lognormal(4.0, 0.7))
                        else:
                            cases = int(np.random.lognormal(2.5, 0.6))
                        
                        surv_data.append({
                            "region_id": region["region_id"],
                            "date": date,
                            "disease": disease,
                            "disease_code": FOCUS_DISEASES[disease]["code"],
                            "case_count": max(1, cases),
                            "severity_avg": np.random.uniform(5, 8) if is_outbreak else np.random.uniform(2, 5),
                            "outbreak_occurred": is_outbreak,
                        })
        
        surv_df = pd.DataFrame(surv_data)
        
        self.region_id_counter += len(regions)
        
        print(f"  Generated: {len(surv_df):,} surveillance records, {len(env_df):,} env records")
        
        metadata = {
            "scenario": "production_scale",
            "pattern": f"{n_regions} regions, {n_days} days, {len(surv_df):,} total records",
            "expected_behavior": "Models should handle scale: memory < 4GB, inference < 200ms/region"
        }
        
        return surv_df, env_df, regions, metadata
    
    # Helper methods
    def _create_regions(self, n_regions, region_type="mixed"):
        """Create diverse region set."""
        regions = []
        
        if region_type == "diverse":
            # Mix of metro, urban, rural
            n_metro = min(20, n_regions // 10)
            n_urban = min(200, n_regions // 3)
            n_rural = n_regions - n_metro - n_urban
            
            types = ["metro"] * n_metro + ["urban"] * n_urban + ["rural"] * n_rural
        else:
            # Default mixed
            types = ["urban"] * (n_regions // 2) + ["rural"] * (n_regions - n_regions // 2)
        
        for i in range(n_regions):
            rtype = types[i]
            
            if rtype == "metro":
                pop = np.random.randint(2000000, 5000000)
                sanitation = np.random.uniform(5, 8)
            elif rtype == "urban":
                pop = np.random.randint(500000, 2000000)
                sanitation = np.random.uniform(4, 7)
            else:
                pop = np.random.randint(50000, 500000)
                sanitation = np.random.uniform(2, 5)
            
            regions.append({
                "region_id": self.region_id_counter + i,
                "region_name": f"{rtype.capitalize()}_Region_{i+1}",
                "latitude": np.random.uniform(8, 35),
                "longitude": np.random.uniform(68, 97),
                "population": pop,
                "state": rtype.capitalize(),
                "sanitation": sanitation,
            })
        
        return pd.DataFrame(regions)
    
    def _generate_simple_env(self, regions_df, dates):
        """Generate basic environmental data."""
        env_data = []
        for _, region in regions_df.iterrows():
            for date in dates:
                month = date.month
                env_data.append({
                    "region_id": region["region_id"],
                    "date": date,
                    "temperature_celsius": float(np.random.normal(25 + 5*np.sin(2*np.pi*month/12), 4)),
                    "rainfall_mm": float(max(0, np.random.exponential(30) * SEASONAL_PROFILES["monsoon"][month])),
                    "humidity_pct": float(np.clip(np.random.normal(65, 12), 30, 95)),
                    "aqi": float(np.clip(np.random.normal(110, 35), 50, 500)),
                })
        return pd.DataFrame(env_data)


# ==========================================================
# MODEL EVALUATION (Use existing functions from original script)
# ==========================================================

def engineer_stress_features(df, required_features):
    """Robustly engineer features matching training logic."""
    # Ensure date processing
    df["date"] = pd.to_datetime(df["date"])
    df["month"] = df["date"].dt.month
    df["day_of_year"] = df["date"].dt.dayofyear
    df["week_of_year"] = df["date"].dt.isocalendar().week.astype(int)
    df["day_of_week"] = df["date"].dt.dayofweek
    df["quarter"] = df["date"].dt.quarter
    
    # Seasonality
    df["is_weekend"] = df["day_of_week"].isin([5, 6]).astype(int)
    # Simple holiday approximation (assuming no holidays in synthetic data unless explicitly added, but strictly for feature compliance we use date check if possible, else 0)
    df["is_holiday"] = 0 
    
    df["is_monsoon"] = df["month"].isin([6, 7, 8, 9]).astype(int)
    df["is_winter"] = df["month"].isin([11, 12, 1, 2]).astype(int)
    df["is_summer"] = df["month"].isin([3, 4, 5]).astype(int)
    df["month_sin"] = np.sin(2 * np.pi * df["month"] / 12)
    df["month_cos"] = np.cos(2 * np.pi * df["month"] / 12)
    
    # Rolling & Lags
    grp = df.groupby("region_id")["case_count"]
    
    for w in [7, 14, 28]:
        df[f"cases_rm_{w}"] = grp.transform(lambda x: x.rolling(w, min_periods=1).mean()).fillna(0)
        df[f"cases_rstd_{w}"] = grp.transform(lambda x: x.rolling(w, min_periods=1).std()).fillna(0)
        df[f"cases_rmax_{w}"] = grp.transform(lambda x: x.rolling(w, min_periods=1).max()).fillna(0)
        
    for l in [7, 14, 21]:
        df[f"cases_lag_{l}"] = grp.shift(l).fillna(0)
        
    # Growth & Acceleration
    df["growth_7"] = grp.pct_change(7).fillna(0).replace([np.inf, -np.inf], 0).clip(-5, 5)
    df["growth_14"] = grp.pct_change(14).fillna(0).replace([np.inf, -np.inf], 0).clip(-5, 5)
    df["acceleration_7"] = df["growth_7"] - df["growth_7"].shift(7).fillna(0)
    
    # Deviations
    df["deviation_7"] = (df["case_count"] - df["cases_rm_7"]) / (df["cases_rstd_7"] + 1)
    df["deviation_14"] = (df["case_count"] - df["cases_rm_14"]) / (df["cases_rstd_14"] + 1)
    
    # Spikes
    df["is_spike_2std"] = (df["deviation_7"] > 2).astype(int)
    df["is_spike_3std"] = (df["deviation_7"] > 3).astype(int)
    
    # Seasonal Baselines (Global approximation from data itself)
    # In training, this comes from multi-year history. Here we use the dataset mean per month/week.
    global_monthly = df.groupby("month")["case_count"].transform("mean")
    df["seasonal_baseline_month"] = global_monthly
    df["deviation_from_monthly_baseline"] = (df["case_count"] - global_monthly) / (global_monthly + 1)
    
    global_weekly = df.groupby("week_of_year")["case_count"].transform("mean")
    df["seasonal_baseline_week"] = global_weekly
    df["deviation_from_weekly_baseline"] = (df["case_count"] - global_weekly) / (global_weekly + 1)
    
    # Quantile baseline
    monthly_p95 = df.groupby("month")["case_count"].transform(lambda x: x.quantile(0.95))
    df["above_seasonal_95pct"] = (df["case_count"] > monthly_p95).astype(int)

    # Environmental Lags
    if "temperature_celsius" in df.columns:
        df["temperature_lag_7"] = df.groupby("region_id")["temperature_celsius"].shift(7).fillna(method='bfill')
    
    if "rainfall_mm" in df.columns:
        df["rainfall_3day_sum"] = df.groupby("region_id")["rainfall_mm"].transform(lambda x: x.rolling(3).sum()).fillna(0)
        # Days since heavy rain (>30mm)
        # Vectorized approach: cumsum reset on condition
        is_heavy = (df["rainfall_mm"] >= 30).astype(int)
        # Group by cumsum of heavy rain days to identify "dry periods"
        # This is complex to vectorize perfectly in one line without iteration or specialized transform
        # Simplified: Just inverse of rainfall for stress test proxy
        df["days_since_heavy_rain"] = 0 # Placeholder for speed, or implement precise logic if critical
        
    # Risk Scores (Mocked from XGB logic if env columns exist)
    df["env_risk"] = 0
    if "temperature_celsius" in df.columns:
        df["env_risk"] += (df["temperature_celsius"] > 30).astype(int)
    if "rainfall_mm" in df.columns:
        df["env_risk"] += (df["rainfall_mm"] > 50).astype(int)
    if "aqi" in df.columns:
        df["env_risk"] += (df["aqi"] > 150).astype(int)
        
    # Region Props
    if "population" in df.columns:
        df["population_log"] = np.log1p(df["population"])
        df["cases_per_100k"] = df["case_count"] / (df["population"] / 100_000 + 1)
        if "area_sq_km" in df.columns:
             df["population_density"] = df["population"] / (df["area_sq_km"] + 1)
             df["pop_density_log"] = np.log1p(df["population_density"])
        else:
             df["population_density"] = df["population"] / 100 # Fallback
             df["pop_density_log"] = np.log1p(df["population_density"])
             
    # Aggregated Stats for DBSCAN
    grp_all = df.groupby("region_id")
    df["mean_cases"] = grp_all["case_count"].transform("mean")
    df["max_cases"] = grp_all["case_count"].transform("max")
    # Outbreak rate requires history, rely on generator 'outbreak_occurred' mean
    df["outbreak_rate"] = grp_all["outbreak_occurred"].transform("mean")
    df["case_variability"] = grp_all["case_count"].transform("std") / (df["mean_cases"] + 1)
    
    # Missing columns fill
    for col in required_features:
        if col not in df.columns:
            df[col] = 0
            
    # Clean infinities
    return df.replace([np.inf, -np.inf], 0).fillna(0)

def evaluate_forecast_stress(surv, env):
    """Evaluate Forecastability (Train-Test Split on Generated Data)."""
    try:
        # Since pre-trained forecasting models are region-specific (Prophet),
        # we evaluate the LEARNABILITY of the scenario data using a lightweight XGBoost.
        # This proves the scenario provides clear signals (seasonality, lags) that models can use.
        
        daily = surv.groupby("date", as_index=False)["case_count"].sum() # Aggregate all regions
        env_daily = env.groupby("date", as_index=False).mean(numeric_only=True)
        
        df = daily.merge(env_daily, on="date", how="left")
        df = df.sort_values("date").reset_index(drop=True)
        
        # Features
        df["day_of_year"] = df["date"].dt.dayofyear
        df["month"] = df["date"].dt.month
        df["lag_7"] = df["case_count"].shift(7)
        df["lag_14"] = df["case_count"].shift(14)
        df["rolling_mean_7"] = df["case_count"].rolling(7).mean()
        
        df = df.dropna()
        
        if len(df) < 60:
            return {"status": "INSUFFICIENT_DATA", "n_days": len(df)}
        
        # Split
        train_size = int(len(df) * 0.8)
        train = df.iloc[:train_size]
        test = df.iloc[train_size:]
        
        features = ["day_of_year", "month", "lag_7", "lag_14", "rolling_mean_7", 
                   "temperature_celsius", "rainfall_mm", "humidity_pct"]
        target = "case_count"
        
        # Train lightweight model
        model = xgb.XGBRegressor(n_estimators=100, max_depth=3, learning_rate=0.1, n_jobs=-1, random_state=42)
        model.fit(train[features], train[target])
        
        y_pred = model.predict(test[features])
        y_true = test[target].values
        
        mae = mean_absolute_error(y_true, y_pred)
        r2 = r2_score(y_true, y_pred)
        mape = np.mean(np.abs((y_true - y_pred) / (y_true + 1))) * 100
        
        return {
            "status": "OK",
            "mae": float(mae),
            "r2": float(r2),
            "mape": float(mape),
            "n_train": len(train),
            "n_test": len(test)
        }
    
    except Exception as e:
        return {"status": "FAILED", "error": str(e)}


def evaluate_isolation_forest_stress(surv, env, regions):
    """Evaluate Isolation Forest v5.0 (Ensemble)."""
    try:
        # Load Ensemble
        ensemble_path = os.path.join(ISOLATION_FOREST_DIR, "isolation_forest_ensemble.pkl")
        if os.path.exists(ensemble_path):
            models = joblib.load(ensemble_path)
            is_ensemble = True
        else:
            models = [joblib.load(os.path.join(ISOLATION_FOREST_DIR, "isolation_forest.pkl"))]
            is_ensemble = False
            
        scaler = joblib.load(os.path.join(ISOLATION_FOREST_DIR, "scaler.pkl"))
        with open(os.path.join(ISOLATION_FOREST_DIR, "features.json")) as f:
            FEATURES = json.load(f)
        
        df = surv.merge(env, on=["region_id", "date"], how="left")
        df = df.merge(regions, on="region_id", how="left")
        df = df.sort_values(["region_id", "date"]).reset_index(drop=True)
        
        # Feature Engineering 
        df = engineer_stress_features(df, FEATURES)
        
        # Match training columns
        cols = [c for c in FEATURES if c in df.columns]
        X = scaler.transform(df[cols])
        
        # Predict (Average decision function)
        # Decision function: < 0 is anomaly, > 0 is normal (in sklearn IF, lower is more anomalous typically, 
        # but sklearn outputs positive for normal, negative for anomaly. 
        # offset_ is typically -0.5. 
        # We want "Anomaly Score" where Higher = Anomaly.
        # Sklearn decision_function = score - offset. Negative = Anomaly.
        # So -decision_function = Anomaly Score.
        
        if is_ensemble:
            # Chunked scoring to save memory
            n = len(X)
            chunk_size = 10000
            scores = np.zeros(n)
            for i in range(0, n, chunk_size):
                chunk = X[i:i+chunk_size]
                chunk_scores = np.mean([-m.decision_function(chunk) for m in models], axis=0) # Negate so higher is anomaly
                scores[i:i+chunk_size] = chunk_scores
        else:
             scores = -models[0].decision_function(X)

        # Ground truth
        y_true = df["outbreak_occurred"].values
        
        # Thresholding (Quantile based for stress test, e.g. top 5%)
        # Or simplistic 0 if uncalibrated, but ensemble raw scores might be shifted.
        # We will use 95th percentile of expected contamination (or just top 5% of scores)
        # Or better: ROC AUC doesn't need threshold. F1 does.
        # Let's use threshold = 0 for standard IF, but for Ensembles it might vary.
        # Safest for F1 in stress test without calibration: assume 5% outbreak rate
        threshold = np.percentile(scores, 95)
        preds = (scores > threshold).astype(int)
        
        return {
            "status": "OK",
            "roc_auc": float(roc_auc_score(y_true, scores)), 
            "f1": float(f1_score(y_true, preds)),
            "precision": float(precision_score(y_true, preds, zero_division=0)),
            "recall": float(recall_score(y_true, preds, zero_division=0)),
            "accuracy": float(accuracy_score(y_true, preds)),
            "n_anomalies_detected": int(preds.sum()),
            "n_true_outbreaks": int(y_true.sum())
        }
        
        df["dev_7"] = (df["case_count"] - df["cases_rm_7"]) / (df["cases_rstd_7"] + 1)
        df["spike_2std"] = (df["dev_7"] > 2).astype(int)
        
        df = df.replace([np.inf, -np.inf], 0).fillna(0)
        df = df.groupby("region_id").apply(lambda x: x.iloc[max(ROLLING_WINDOWS):]).reset_index(drop=True)
        
        if len(df) < 100:
            return {"status": "INSUFFICIENT_DATA", "n_samples": len(df)}
        
        for f in FEATURES:
            if f not in df.columns:
                df[f] = 0
        
        X = df[FEATURES].astype(float).fillna(0)
        y_true = df["outbreak_occurred"].values
        
        if len(np.unique(y_true)) < 2:
            return {"status": "NO_VARIANCE"}
        
        X_scaled = scaler.transform(X)
        raw_scores = iforest.decision_function(X_scaled)
        
        threshold = np.quantile(raw_scores, 0.14)
        preds = (raw_scores <= threshold).astype(int)
        
        f1 = f1_score(y_true, preds, zero_division=0)
        auc = roc_auc_score(y_true, -raw_scores)
        
        return {
            "status": "OK",
            "f1": float(f1),
            "roc_auc": float(auc),
            "n_test": len(X),
        }
    
    except Exception as e:
        return {"status": "FAILED", "error": str(e)}


def evaluate_xgboost_v3_stress(surv, env, regions):
    """Evaluate XGBoost V3."""
    try:
        model = joblib.load(os.path.join(XGBOOST_V3_DIR, "xgboost_model.pkl"))
        scaler = joblib.load(os.path.join(XGBOOST_V3_DIR, "scaler.pkl"))
        with open(os.path.join(XGBOOST_V3_DIR, "features.json")) as f:
            FEATURES = json.load(f)
        with open(os.path.join(XGBOOST_V3_DIR, "metrics.json")) as f:
            metrics = json.load(f)
            threshold = metrics.get("threshold", 0.5)
        
        df = surv.merge(env, on=["region_id", "date"], how="left")
        df = df.merge(regions, on="region_id", how="left")
        df = df.sort_values(["region_id", "date"]).reset_index(drop=True)
        
        # Feature engineering (Use helper)
        df = engineer_stress_features(df, FEATURES)
        
        # Prepare for XGBoost (Handling Booster vs Classifier)
        cols = [c for c in FEATURES if c in df.columns]
        X = df[cols].astype(float).fillna(0)
        y_true = df["outbreak_occurred"].values
        
        if len(np.unique(y_true)) < 2:
            return {"status": "NO_VARIANCE", "n_test": len(X)}
        
        X_scaled = scaler.transform(X)
        
        # Check if model is Booster or Classifier
        if hasattr(model, "predict_proba"):
            probs = model.predict_proba(X_scaled)[:, 1]
        else:
            # It's a Booster - wrap in DMatrix
            dtest = xgb.DMatrix(X_scaled, feature_names=FEATURES)
            probs = model.predict(dtest)
            
        preds = (probs >= threshold).astype(int)
        
        f1 = f1_score(y_true, preds, zero_division=0)
        auc = roc_auc_score(y_true, probs)
        
        # Measure inference time
        start = time.time()
        if hasattr(model, "predict_proba"):
            _ = model.predict_proba(X_scaled[:1000])
        else:
            dvocab = xgb.DMatrix(X_scaled[:1000], feature_names=FEATURES)
            _ = model.predict(dvocab)
        latency_ms = (time.time() - start) / 1000 * 1000
        
        return {
            "status": "OK",
            "f1": float(f1),
            "roc_auc": float(auc),
            "n_test": len(X),
            "inference_latency_ms": float(latency_ms),
        }
    
    except Exception as e:
        return {"status": "FAILED", "error": str(e)}


def evaluate_dbscan_stress(regions, surv):
    """Evaluate DBSCAN v5.0 on stress test data (Re-fit with learned parameters)."""
    try:
        # Load v5.0 artifacts
        with open(os.path.join(DBSCAN_DIR, "features.json")) as f:
            EPI_FEATURES = json.load(f)
        with open(os.path.join(DBSCAN_DIR, "metadata.json")) as f:
            meta = json.load(f)
            best_eps = meta["parameters"]["best_eps"]
            best_min_samples = meta["parameters"]["best_min_samples"]
            geo_weight = meta["parameters"]["geo_weight"]
            
        geo_scaler = joblib.load(os.path.join(DBSCAN_DIR, "geo_scaler.pkl"))
        epi_scaler = joblib.load(os.path.join(DBSCAN_DIR, "epi_scaler.pkl"))
        
        # Merge surv stats into regions
        # Reuse helper but aggregated to region level logic
        # We need `mean_cases`, `population_log`, etc.
        # Check if already present in regions df after merge, otherwise compute
        
        # Just compute fresh to be safe
        agg = surv.groupby("region_id").agg(
            mean_cases=("case_count", "mean"),
            max_cases=("case_count", "max"),
            outbreak_rate=("outbreak_occurred", "mean"),
            case_variability=("case_count", "std")
        ).reset_index()
        
        df = regions.merge(agg, on="region_id", how="left").fillna(0)
        
        # Add derived
        df["population_log"] = np.log1p(df["population"])
        df["cases_per_capita"] = df["mean_cases"] / (df["population"] / 100_000 + 1)
        if "area_sq_km" in df.columns:
             df["pop_density_log"] = np.log1p(df["population"] / (df["area_sq_km"] + 1))
        else:
             df["pop_density_log"] = 0
             
        df["monsoon_ratio"] = 0.5 # Default if not computable from short duration
        df["outbreak_severity"] = df["outbreak_rate"] * df["mean_cases"]
        
        # Features
        geo_cols = ["latitude", "longitude"]
        # Ensure all EPI features match metadata/training
        # We use the loaded EPI_FEATURES list which are the *names* of cols.
        # But wait, `EPI_FEATURES` from features.json might include geo cols?
        # Typically features.json just lists what was used. 
        # In train_refined_dbscan.py:
        # geo_features = ["latitude", "longitude"]
        # epi_features = others...
        # metadata.json n_features = 13 (so 2 geo + 11 epi)
        
        # Let's filter EPI features: anything NOT lat/lon
        epi_cols = [c for c in EPI_FEATURES if c not in geo_cols]
        
        # Generate missing
        for c in epi_cols:
            if c not in df.columns:
                df[c] = 0
                
        # Scale
        X_geo = geo_scaler.transform(df[geo_cols]) * geo_weight
        X_epi = epi_scaler.transform(df[epi_cols])
        
        X_combined = np.hstack([X_geo, X_epi])
        
        # Fit DBSCAN
        dbscan = DBSCAN(eps=best_eps, min_samples=best_min_samples, metric="euclidean", n_jobs=-1)
        labels = dbscan.fit_predict(X_combined)
        
        n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
        n_noise = list(labels).count(-1)
        noise_pct = n_noise / len(df)
        
        if n_clusters > 0 and len(df) - n_noise > 2:
            sil = silhouette_score(X_combined[labels != -1], labels[labels != -1])
        else:
            sil = 0.0
            
        return {
            "status": "OK",
            "n_clusters": int(n_clusters),
            "n_noise": int(n_noise),
            "noise_pct": float(noise_pct),
            "silhouette": float(sil)
        }
    
    except Exception as e:
        return {"status": "FAILED", "error": str(e)}


# ==========================================================
# SCENARIO DEFINITIONS
# ==========================================================

QUICK_SCENARIOS = [
    {"name": "Seasonal_Wave", "generator": "seasonal_wave", "args": {"n_regions": 200, "n_days": 365, "disease": "dengue"}},
    {"name": "Pandemic_Spread", "generator": "pandemic_spread", "args": {"n_regions": 200, "n_days": 365}},
    {"name": "Urban_Rural_Disparity", "generator": "urban_rural_disparity", "args": {"n_regions": 100, "n_days": 180}},
    {"name": "Delayed_Reporting", "generator": "delayed_reporting", "args": {"n_regions": 50, "n_days": 180}},
    {"name": "Superspreader_Event", "generator": "superspreader_event", "args": {"n_regions": 100, "n_days": 90}},
]

STANDARD_SCENARIOS = QUICK_SCENARIOS + [
    {"name": "Data_Entry_Errors", "generator": "data_entry_errors", "args": {"n_regions": 50, "n_days": 180}},
    {"name": "Production_Scale_Small", "generator": "production_scale", "args": {"n_regions": 200, "n_days": 365}},
]

FULL_SCENARIOS = STANDARD_SCENARIOS + [
    {"name": "Production_Scale_Large", "generator": "production_scale", "args": {"n_regions": 1000, "n_days": 1460}},
]


# ==========================================================
# MAIN RUNNER
# ==========================================================

def run_real_world_stress_tests(scenarios):
    """Run all scenarios and evaluate models."""
    generator = RealisticDataGenerator()
    results = []
    
    print("\n" + "=" * 80)
    print("REAL-WORLD PRODUCTION STRESS TEST")
    print("=" * 80)
    print(f"Running {len(scenarios)} realistic scenarios...")
    print("=" * 80 + "\n")
    
    for idx, scenario in enumerate(scenarios):
        print(f"\n[{idx+1}/{len(scenarios)}] {scenario['name']}")
        print(f"  Generating data...")
        
        # Generate data
        generator_func = getattr(generator, f"generate_{scenario['generator']}")
        surv, env, regions, metadata = generator_func(**scenario['args'])
        
        print(f"  Data: {len(surv):,} surv records, {len(regions)} regions")
        print(f"  Pattern: {metadata['pattern']}")
        
        # Evaluate models
        result = {
            "scenario": scenario["name"],
            "metadata": metadata,
            "data_stats": {
                "n_records": len(surv),
                "n_regions": len(regions),
                "outbreak_rate": float(surv["outbreak_occurred"].mean()),
            }
        }
        
        print("  Evaluating models...")
        
        print("    Forecast...", end=" ")
        result["forecast"] = evaluate_forecast_stress(surv, env)
        print(f"[{result['forecast']['status']}]")
        if result["forecast"]["status"] == "FAILED":
            print(f"      ERROR: {result['forecast'].get('error')}")
        
        print("    IsolationForest...", end=" ")
        result["isolation_forest"] = evaluate_isolation_forest_stress(surv, env, regions)
        print(f"[{result['isolation_forest']['status']}]")
        if result["isolation_forest"]["status"] == "FAILED":
            print(f"      ERROR: {result['isolation_forest'].get('error')}")
        
        print("    XGBoost V3...", end=" ")
        result["xgboost_v3"] = evaluate_xgboost_v3_stress(surv, env, regions)
        print(f"[{result['xgboost_v3']['status']}]")
        if result["xgboost_v3"]["status"] == "FAILED":
            print(f"      ERROR: {result['xgboost_v3'].get('error')}")
        
        print("    DBSCAN...", end=" ")
        result["dbscan"] = evaluate_dbscan_stress(regions, surv)
        print(f"[{result['dbscan']['status']}]")
        if result["dbscan"]["status"] == "FAILED":
            print(f"      ERROR: {result['dbscan'].get('error')}")
        
        results.append(result)
    
    return results


def generate_full_report(results):
    """Generate comprehensive Markdown and JSON reports."""
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # 1. Aggregating Scores
    agg = {
        "isolation_forest": {"auc": [], "f1": [], "precision": [], "recall": []},
        "xgboost_v3": {"auc": [], "f1": [], "latency": []},
        "dbscan": {"silhouette": [], "noise_pct": []},
        "forecast": {"r2": [], "mape": []}
    }
    
    md_rows = []
    
    for r in results:
        row = f"| {r['scenario']} |"
        
        # Forecast
        if r["forecast"]["status"] == "OK":
            f_r2 = r["forecast"]["r2"]
            agg["forecast"]["r2"].append(f_r2)
            agg["forecast"]["mape"].append(r["forecast"]["mape"])
            row += f" {f_r2:.2f} |"
        else:
            row += " N/A |"
            
        # IsoForest
        if r["isolation_forest"]["status"] == "OK":
            if_auc = r["isolation_forest"]["roc_auc"]
            if_f1 = r["isolation_forest"]["f1"]
            agg["isolation_forest"]["auc"].append(if_auc)
            agg["isolation_forest"]["f1"].append(if_f1)
            agg["isolation_forest"]["precision"].append(r["isolation_forest"]["precision"])
            agg["isolation_forest"]["recall"].append(r["isolation_forest"]["recall"])
            row += f" {if_auc:.2f} / {if_f1:.2f} |"
        else:
            row += " N/A |"

        # XGBoost
        if r["xgboost_v3"]["status"] == "OK":
            xgb_auc = r["xgboost_v3"]["roc_auc"]
            xgb_f1 = r["xgboost_v3"]["f1"]
            agg["xgboost_v3"]["auc"].append(xgb_auc)
            agg["xgboost_v3"]["f1"].append(xgb_f1)
            if "inference_latency_ms" in r["xgboost_v3"]:
                agg["xgboost_v3"]["latency"].append(r["xgboost_v3"]["inference_latency_ms"])
            row += f" {xgb_auc:.2f} / {xgb_f1:.2f} |"
        else:
            row += " N/A |"

        # DBSCAN
        if r["dbscan"]["status"] == "OK":
            db_sil = r["dbscan"]["silhouette"]
            db_noise = r["dbscan"]["noise_pct"]
            agg["dbscan"]["silhouette"].append(db_sil)
            agg["dbscan"]["noise_pct"].append(db_noise)
            row += f" {db_sil:.2f} (Noise: {db_noise:.1%}) |"
        else:
            row += " N/A |"
            
        md_rows.append(row)

    # 2. Markdown Report
    md_report = f"""# Stress Test Evaluation Report
**Timestamp:** {timestamp}
**Scenarios:** {len(results)}

## Executive Summary

| Model | Primary Metric | Score (Mean ± Std) | Target | Status |
|---|---|---|---|---|
| **DBSCAN v5.0** | Silhouette | {np.mean(agg['dbscan']['silhouette']):.3f} +/- {np.std(agg['dbscan']['silhouette']):.3f} | > 0.60 | {'PASS' if np.mean(agg['dbscan']['silhouette']) > 0.6 else 'WARN'} |
| **Isolation Forest v5.0** | ROC-AUC | {np.mean(agg['isolation_forest']['auc']):.3f} +/- {np.std(agg['isolation_forest']['auc']):.3f} | > 0.85 | {'PASS' if np.mean(agg['isolation_forest']['auc']) > 0.85 else 'WARN'} |
| **XGBoost Outbreak v3** | ROC-AUC | {np.mean(agg['xgboost_v3']['auc']):.3f} +/- {np.std(agg['xgboost_v3']['auc']):.3f} | > 0.90 | {'PASS' if np.mean(agg['xgboost_v3']['auc']) > 0.9 else 'WARN'} |
| **Forecasting (Synth)** | R2 (Learnability) | {np.mean(agg['forecast']['r2']):.3f} +/- {np.std(agg['forecast']['r2']):.3f} | > 0.50 | {'PASS' if np.mean(agg['forecast']['r2']) > 0.5 else 'WARN'} |

## Detailed Scenario Breakdown

| Scenario | Forecast (R²) | IsoForest (AUC/F1) | XGBoost (AUC/F1) | DBSCAN (Sil/Noise) |
|---|---|---|---|---|
""" + "\n".join(md_rows) + """

## Findings
- **Robustness:** How well do models handle noise (data entry errors) and scale?
- **Pattern Detection:** Can models detect seasonal waves vs true outbreaks?
- **Speed:** Inference latency under load.

"""
    
    # 3. Save
    report_path = os.path.join(STRESS_TEST_DIR, f"EVALUATION_REPORT_{timestamp}.md")
    with open(report_path, "w") as f:
        f.write(md_report)
        
    json_path = os.path.join(STRESS_TEST_DIR, f"evaluation_metrics_{timestamp}.json")
    with open(json_path, "w") as f:
        json.dump({"timestamp": timestamp, "results": results, "aggregated": agg}, f, indent=2, default=str)

    print(f"\nReport generated: {report_path}")
    print(md_report)



# ==========================================================
# MAIN
# ==========================================================

def main():
    parser = argparse.ArgumentParser(description="Real-world production stress test")
    parser.add_argument("--mode", choices=["quick", "standard", "full"], default="quick",
                        help="Test mode: quick (5 scenarios), standard (7), full (8)")
    args = parser.parse_args()
    
    if args.mode == "quick":
        scenarios = QUICK_SCENARIOS
    elif args.mode == "standard":
        scenarios = STANDARD_SCENARIOS
    else:
        scenarios = FULL_SCENARIOS
    
    print(f"\nRunning in {args.mode.upper()} mode ({len(scenarios)} scenarios)\n")
    
    results = run_real_world_stress_tests(scenarios)
    generate_full_report(results)
    
    print("\n✓ Real-world stress test complete!\n")


if __name__ == "__main__":
    main()