"""Surveillance services for data aggregation and ML integration"""
import os
import pickle
from datetime import datetime, timedelta
from typing import Dict, List, Tuple
from pathlib import Path

import numpy as np
import pandas as pd
from django.conf import settings
from django.db import transaction
from django.db.models import Count, Avg, Sum, Q
from django.utils import timezone

from .models import (
    Region, SurveillanceData, Cluster, ClusterRegion, Forecast,
    Anomaly, RiskScore, EnvironmentalData, Alert, Consent
)
from medical.models import Diagnosis, MedicalRecord
from patients.models import Profile


class AggregationService:
    """K-anonymity enforced aggregation service"""
    
    K_ANONYMITY_THRESHOLD = 5  # Minimum cases to report
    
    @classmethod
    def aggregate_daily_data(cls, target_date=None):
        """
        Aggregate disease data with K-anonymity enforcement
        Only includes patients who consented to surveillance
        """
        if target_date is None:
            target_date = timezone.now().date() - timedelta(days=1)
        
        # Get profiles with surveillance consent
        consented_profiles = Consent.objects.filter(
            consent_type='surveillance',
            is_granted=True
        ).values_list('profile_id', flat=True)
        
        # Get diagnoses from consented patients for target date
        diagnoses = Diagnosis.objects.filter(
            record__patient_id__in=consented_profiles,
            created_at__date=target_date
        ).select_related('record', 'record__patient')
        
        # Group by region and disease
        aggregation = {}
        
        for diagnosis in diagnoses:
            patient = diagnosis.record.patient
            region_name = patient.region
            
            if not region_name:
                continue  # Skip if no region assigned
            
            key = (region_name, diagnosis.icd_10_code)
            
            if key not in aggregation:
                aggregation[key] = {
                    'region_name': region_name,
                    'disease_code': diagnosis.icd_10_code,
                    'disease_name': diagnosis.disease_name,
                    'case_count': 0,
                    'severities': []
                }
            
            aggregation[key]['case_count'] += 1
            aggregation[key]['severities'].append(diagnosis.severity)
        
        # Apply K-anonymity and save
        with transaction.atomic():
            for key, data in aggregation.items():
                # K-anonymity check
                if data['case_count'] < cls.K_ANONYMITY_THRESHOLD:
                    continue  # Suppress data
                
                # Get region object
                try:
                    region = Region.objects.get(name=data['region_name'])
                except Region.DoesNotExist:
                    continue  # Skip if region not found
                
                # Calculate metrics
                avg_severity = sum(data['severities']) / len(data['severities'])
                cases_per_100k = (data['case_count'] / region.population) * 100000
                
                # Create or update surveillance data
                SurveillanceData.objects.update_or_create(
                    date=target_date,
                    region=region,
                    disease_code=data['disease_code'],
                    defaults={
                        'disease_name': data['disease_name'],
                        'case_count': data['case_count'],
                        'average_severity': avg_severity,
                        'cases_per_100k': cases_per_100k,
                    }
                )
        
        return aggregation


class ClusteringService:
    """DBSCAN clustering service"""
    
    MODEL_PATH = Path(settings.BASE_DIR).parent / 'ml_models' / 'saved_models' / 'dbscan_model.pkl'
    
    @classmethod
    def load_model(cls):
        """Load trained DBSCAN model"""
        if cls.MODEL_PATH.exists():
            with open(cls.MODEL_PATH, 'rb') as f:
                return pickle.load(f)
        return None
    
    @classmethod
    def detect_clusters(cls, disease_code, start_date=None, end_date=None):
        """
        Detect disease clusters using DBSCAN
        """
        if start_date is None:
            end_date = timezone.now().date()
            start_date = end_date - timedelta(days=7)
        
        if end_date is None:
            end_date = timezone.now().date()
        
        # Get surveillance data for the disease
        data = SurveillanceData.objects.filter(
            disease_code=disease_code,
            date__gte=start_date,
            date__lte=end_date
        ).select_related('region')
        
        if not data.exists():
            return []
        
        # Prepare data for clustering
        points = []
        region_map = {}
        
        for idx, record in enumerate(data):
            points.append([
                record.region.latitude,
                record.region.longitude,
                record.case_count
            ])
            region_map[idx] = {
                'region': record.region,
                'case_count': record.case_count,
                'date': record.date
            }
        
        points = np.array(points)
        
        # Load and apply DBSCAN
        model = cls.load_model()
        if model is None:
            # Fallback: create new DBSCAN model
            from sklearn.cluster import DBSCAN
            model = DBSCAN(eps=0.5, min_samples=3)
        
        # Cluster (only use lat, lon)
        labels = model.fit_predict(points[:, :2])
        
        # Process clusters
        clusters = []
        unique_labels = set(labels)
        unique_labels.discard(-1)  # Remove noise
        
        for label in unique_labels:
            mask = labels == label
            cluster_points = points[mask]
            cluster_indices = np.where(mask)[0]
            
            # Calculate cluster properties
            centroid_lat = np.mean(cluster_points[:, 0])
            centroid_lon = np.mean(cluster_points[:, 1])
            total_cases = int(np.sum(cluster_points[:, 2]))
            
            # Get regions in cluster
            cluster_regions = [region_map[int(idx)] for idx in cluster_indices]
            total_population = sum(r['region'].population for r in cluster_regions)
            
            # Calculate severity
            severity_score = (total_cases / total_population) * 100000
            
            if severity_score < 5:
                severity = 'low'
            elif severity_score < 20:
                severity = 'medium'
            elif severity_score < 50:
                severity = 'high'
            else:
                severity = 'critical'
            
            # Calculate radius (max distance from centroid)
            from math import radians, sin, cos, sqrt, atan2
            
            def haversine(lat1, lon1, lat2, lon2):
                R = 6371  # Earth radius in km
                dlat = radians(lat2 - lat1)
                dlon = radians(lon2 - lon1)
                a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2
                c = 2 * atan2(sqrt(a), sqrt(1-a))
                return R * c
            
            radius_km = max(
                haversine(centroid_lat, centroid_lon, point[0], point[1])
                for point in cluster_points
            )
            
            # Get disease name
            disease_name = data.first().disease_name
            
            # Create cluster
            cluster = Cluster.objects.create(
                disease_code=disease_code,
                disease_name=disease_name,
                detection_date=end_date,
                centroid_lat=centroid_lat,
                centroid_lon=centroid_lon,
                radius_km=radius_km,
                total_cases=total_cases,
                total_population=total_population,
                severity=severity,
            )
            
            # Add regions to cluster
            for region_data in cluster_regions:
                ClusterRegion.objects.create(
                    cluster=cluster,
                    region=region_data['region'],
                    case_count=region_data['case_count']
                )
            
            clusters.append(cluster)
        
        return clusters


class ForecastingService:
    """Prophet forecasting service"""
    
    MODEL_BASE_PATH = Path(settings.BASE_DIR).parent / 'ml_models' / 'saved_models'
    
    @classmethod
    def load_model(cls, region, disease_code):
        """Load prophet model for region-disease combination"""
        # Try to load specific model
        model_file = cls.MODEL_BASE_PATH / f"prophet_region{region.id}_{disease_code}.pkl"
        
        if not model_file.exists():
            # Try generic disease model
            model_file = cls.MODEL_BASE_PATH / f"prophet_region1_dengue.pkl"
        
        if model_file.exists():
            try:
                from prophet.serialize import model_from_json
                import json
                with open(model_file, 'rb') as f:
                    return pickle.load(f)
            except:
                return None
        return None
    
    @classmethod
    def generate_forecast(cls, region, disease_code, horizon_days=7):
        """
        Generate forecast for region-disease combination
        """
        # Get historical data
        min_date = timezone.now().date() - timedelta(days=90)
        historical_data = SurveillanceData.objects.filter(
            region=region,
            disease_code=disease_code,
            date__gte=min_date
        ).order_by('date').values('date', 'case_count')
        
        if not historical_data:
            return []
        
        # Prepare data for Prophet
        df = pd.DataFrame(list(historical_data))
        df.rename(columns={'date': 'ds', 'case_count': 'y'}, inplace=True)
        
        # Try to load prophet
        try:
            from prophet import Prophet
            
            # Train or load model
            model = cls.load_model(region, disease_code)
            if model is None:
                model = Prophet(
                    daily_seasonality=False,
                    weekly_seasonality=True,
                    yearly_seasonality=True,
                )
                model.fit(df)
            
            # Make predictions
            future = model.make_future_dataframe(periods=horizon_days)
            forecast = model.predict(future)
            
            # Save forecasts
            forecasts = []
            today = timezone.now().date()
            disease_name = SurveillanceData.objects.filter(disease_code=disease_code).first().disease_name
            
            for idx, row in forecast.tail(horizon_days).iterrows():
                prediction_date = row['ds'].date()
                
                forecast_obj = Forecast.objects.create(
                    region=region,
                    disease_code=disease_code,
                    disease_name=disease_name,
                    forecast_date=today,
                    prediction_date=prediction_date,
                    horizon_days=horizon_days,
                    predicted_cases=max(0, row['yhat']),
                    lower_bound=max(0, row['yhat_lower']),
                    upper_bound=max(0, row['yhat_upper']),
                    confidence=0.95
                )
                forecasts.append(forecast_obj)
            
            return forecasts
        
        except ImportError:
            return []


class AnomalyDetectionService:
    """Isolation Forest anomaly detection"""
    
    MODEL_PATH = Path(settings.BASE_DIR).parent / 'ml_models' / 'saved_models' / 'isolation_forest.pkl'
    
    @classmethod
    def load_model(cls):
        """Load trained Isolation Forest model"""
        if cls.MODEL_PATH.exists():
            with open(cls.MODEL_PATH, 'rb') as f:
                return pickle.load(f)
        return None
    
    @classmethod
    def detect_anomalies(cls, region, disease_code, date=None):
        """
        Detect anomalies in disease cases
        """
        if date is None:
            date = timezone.now().date()
        
        # Get historical data (30 days)
        start_date = date - timedelta(days=30)
        historical_data = list(SurveillanceData.objects.filter(
            region=region,
            disease_code=disease_code,
            date__gte=start_date,
            date__lte=date
        ).order_by('date').values('date', 'case_count', 'average_severity'))
        
        if len(historical_data) < 7:
            return None  # Not enough data
        
        # Calculate features
        df = pd.DataFrame(historical_data)
        df['rolling_mean'] = df['case_count'].rolling(window=7, min_periods=1).mean()
        df['rolling_std'] = df['case_count'].rolling(window=7, min_periods=1).std().fillna(0)
        df['growth_rate'] = df['case_count'].pct_change().fillna(0)
        
        # Get latest data
        latest = df.iloc[-1]
        
        # Calculate anomaly score
        features = np.array([[
            latest['case_count'],
            latest['rolling_mean'],
            latest['rolling_std'],
            latest['growth_rate'],
            latest['average_severity']
        ]])
        
        # Load model
        model = cls.load_model()
        if model is None:
            from sklearn.ensemble import IsolationForest
            model = IsolationForest(contamination=0.1, random_state=42)
            # Train on historical features
            hist_features = df[['case_count', 'rolling_mean', 'rolling_std', 'growth_rate', 'average_severity']].values
            model.fit(hist_features)
        
        # Predict
        anomaly_score = model.score_samples(features)[0]
        is_anomaly = model.predict(features)[0] == -1
        
        if is_anomaly:
            expected_cases = latest['rolling_mean']
            deviation = ((latest['case_count'] - expected_cases) / expected_cases * 100) if expected_cases > 0 else 0
            
            disease_name = SurveillanceData.objects.filter(disease_code=disease_code).first().disease_name
            
            anomaly = Anomaly.objects.create(
                region=region,
                disease_code=disease_code,
                disease_name=disease_name,
                detection_date=date,
                anomaly_score=abs(anomaly_score),
                actual_cases=int(latest['case_count']),
                expected_cases=expected_cases,
                deviation_percentage=deviation,
                description=f"Cases {latest['case_count']:.0f} vs expected {expected_cases:.0f} ({deviation:.1f}% deviation)"
            )
            
            return anomaly
        
        return None


class RiskScoringService:
    """XGBoost risk scoring service"""
    
    MODEL_PATH = Path(settings.BASE_DIR).parent / 'ml_models' / 'saved_models' / 'outbreak_risk_xgboost.pkl'
    
    @classmethod
    def load_model(cls):
        """Load trained XGBoost model"""
        if cls.MODEL_PATH.exists():
            with open(cls.MODEL_PATH, 'rb') as f:
                return pickle.load(f)
        return None
    
    @classmethod
    def calculate_risk_score(cls, region, disease_code, date=None):
        """
        Calculate regional risk score using XGBoost
        """
        if date is None:
            date = timezone.now().date()
        
        # Get features
        # Medical features
        recent_data = SurveillanceData.objects.filter(
            region=region,
            disease_code=disease_code,
            date__gte=date - timedelta(days=14),
            date__lte=date
        ).aggregate(
            avg_cases=Avg('case_count'),
            avg_severity=Avg('average_severity')
        )
        
        # Environmental features
        env_data = EnvironmentalData.objects.filter(
            region=region,
            date__gte=date - timedelta(days=7),
            date__lte=date
        ).aggregate(
            avg_temp=Avg('temperature'),
            avg_humidity=Avg('humidity'),
            avg_rainfall=Avg('rainfall'),
            avg_aqi=Avg('aqi'),
            avg_water_quality=Avg('water_quality_index'),
            avg_sanitation=Avg('sanitation_index')
        )
        
        # Feature vector
        features = {
            'case_count': recent_data['avg_cases'] or 0,
            'severity': recent_data['avg_severity'] or 0,
            'temperature': env_data['avg_temp'] or 25,
            'humidity': env_data['avg_humidity'] or 60,
            'rainfall': env_data['avg_rainfall'] or 0,
            'aqi': env_data['avg_aqi'] or 100,
            'water_quality': env_data['avg_water_quality'] or 70,
            'sanitation': env_data['avg_sanitation'] or 70,
            'population_density': region.population / 1000  # Simplified
        }
        
        # Load model
        model = cls.load_model()
        if model is None:
            # Fallback: simple rule-based scoring
            risk_level = 0
            risk_probability = 0.3
            
            if features['case_count'] > 20:
                risk_level = 2
                risk_probability = 0.7
            elif features['case_count'] > 10:
                risk_level = 1
                risk_probability = 0.5
            
            contributing_factors = {"case_count": 0.6, "severity": 0.3, "environmental": 0.1}
        else:
            # XGBoost prediction
            try:
                import xgboost as xgb
                feature_vector = np.array([[
                    features['case_count'], features['severity'], features['temperature'],
                    features['humidity'], features['rainfall'], features['aqi'],
                    features['water_quality'], features['sanitation'], features['population_density']
                ]])
                
                risk_level = int(model.predict(feature_vector)[0])
                risk_probabilities = model.predict_proba(feature_vector)[0]
                risk_probability = float(risk_probabilities[risk_level])
                
                # SHAP values for explainability (simplified)
                contributing_factors = {
                    "case_count": float(features['case_count'] / 100),
                    "severity": float(features['severity'] / 4),
                    "environmental": 0.2
                }
            except:
                risk_level = 0
                risk_probability = 0.3
                contributing_factors = {}
        
        # Save risk score
        disease_name = SurveillanceData.objects.filter(disease_code=disease_code).first().disease_name
        
        risk_score = RiskScore.objects.create(
            region=region,
            disease_code=disease_code,
            disease_name=disease_name,
            calculation_date=date,
            risk_level=risk_level,
            risk_probability=risk_probability,
            contributing_factors=contributing_factors
        )
        
        return risk_score


class AlertService:
    """Multi-model alert fusion and generation"""
    
    @classmethod
    def evaluate_alerts(cls, disease_code, date=None):
        """
        Evaluate all models and generate alerts based on fusion rules
        """
        if date is None:
            date = timezone.now().date()
        
        alerts = []
        
        # Get all  regions with recent data
        regions = Region.objects.filter(
            surveillance_data__disease_code=disease_code,
            surveillance_data__date__gte=date - timedelta(days=7)
        ).distinct()
        
        for region in regions:
            # Check forecasts
            forecasts = Forecast.objects.filter(
                region=region,
                disease_code=disease_code,
                forecast_date=date,
                prediction_date__gte=date,
                prediction_date__lte=date + timedelta(days=7)
            )
            
            forecast_spike = any(f.predicted_cases > 1.5 * f.lower_bound for f in forecasts)
            
            # Check clusters
            clusters = Cluster.objects.filter(
                regions__region=region,
                disease_code=disease_code,
                detection_date__gte=date - timedelta(days=3),
                is_active=True
            )
            
            in_cluster = clusters.exists()
            cluster_severity = clusters.first().severity if in_cluster else 'low'
            
            # Check anomalies
            anomalies = Anomaly.objects.filter(
                region=region,
                disease_code=disease_code,
                detection_date=date,
                is_resolved=False
            )
            
            has_anomaly = anomalies.exists()
            
            # Check risk scores
            risk_scores = RiskScore.objects.filter(
                region=region,
                disease_code=disease_code,
                calculation_date=date
            )
            
            high_risk = risk_scores.exists() and risk_scores.first().risk_level >= 2
            
            # Apply fusion rules
            alert = None
            
            # CRITICAL: Forecast spike + Cluster + Anomaly
            if forecast_spike and in_cluster and has_anomaly:
                alert = cls._create_alert(
                    'critical',
                    disease_code,
                    [region],
                    "Multi-model Critical Alert",
                    "Forecasted spike, active cluster, and anomaly detected",
                    0.95,
                    forecasts, clusters, anomalies, risk_scores
                )
            
            # HIGH: Forecast spike + Cluster
            elif forecast_spike and in_cluster:
                alert = cls._create_alert(
                    'high',
                    disease_code,
                    [region],
                    "High Priority Alert",
                    "Forecasted spike and active cluster detected",
                    0.80,
                    forecasts, clusters, [], risk_scores
                )
            
            # MEDIUM: Anomaly only
            elif has_anomaly:
                alert = cls._create_alert(
                    'medium',
                    disease_code,
                    [region],
                    "Anomaly Detected",
                    "Unusual disease pattern requires review",
                    0.60,
                    forecasts, [], anomalies, risk_scores
                )
            
            # LOW: High risk but no other signals
            elif high_risk:
                alert = cls._create_alert(
                    'low',
                    disease_code,
                    [region],
                    "Preventive Warning",
                    "Environmental and demographic factors indicate elevated risk",
                    0.50,
                    forecasts, [], [], risk_scores
                )
            
            if alert:
                alerts.append(alert)
        
        return alerts
    
    @classmethod
    def _create_alert(cls, severity, disease_code, regions, title, description, confidence,
                      forecasts, clusters, anomalies, risk_scores):
        """Create alert with details"""
        
        disease_name = SurveillanceData.objects.filter(disease_code=disease_code).first().disease_name
        
        # Build contributing factors
        factors = {}
        if forecasts.exists():
            factors['forecast'] = f"Predicted {forecasts.first().predicted_cases:.0f} cases in next 7 days"
        if clusters.exists():
            factors['cluster'] = f"{clusters.first().severity} severity cluster detected"
        if anomalies.exists():
            factors['anomaly'] = f"{anomalies.first().deviation_percentage:.1f}% deviation from expected"
        if risk_scores.exists():
            factors['risk'] = f"{risk_scores.first().get_risk_level_display()} risk score"
        
        # Recommended actions
        actions = []
        if severity in ['critical', 'high']:
            actions.append("Deploy rapid response team")
            actions.append("Increase surveillance in affected areas")
            actions.append("Stock emergency medical supplies")
        actions.append("Monitor disease progression closely")
        actions.append("Educate public about prevention measures")
        
        alert = Alert.objects.create(
            alert_type='outbreak',
            disease_code=disease_code,
            disease_name=disease_name,
            severity=severity,
            confidence=confidence,
            title=title,
            description=description,
            contributing_factors=factors,
            recommended_actions="\n".join(actions),
            escalation_level=1 if severity in ['low', 'medium'] else 2
        )
        
        alert.affected_regions.set(regions)
        
        return alert
