"""Regression and real-artifact integration tests using an isolated database."""
import json
from datetime import timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

import numpy as np
import pandas as pd
from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient
from django.utils import timezone

from .ml.features import prepare_daily, build_features
from .ml.runtime import load_bundle, ModelUnavailable
from .models import (Region,SurveillanceData,EnvironmentalData,Forecast,Anomaly,RiskScore,
                     Consent,PendingInferenceQueue,Alert)
from .services import (AggregationService,RiskScoringService,ForecastingService,AnomalyDetectionService,
                       ClusteringService,MLModelInfoService,AlertService,_today,_bundle)


class CausalFeatureTests(SimpleTestCase):
    def frame(self):
        rows=[]
        for code,offset in [('A90',0),('J10.1',1000)]:
            for i,date in enumerate(pd.date_range('2024-01-01',periods=420)):
                rows.append(dict(region_id=1,disease_code=code,date=date,case_count=i+offset,
                                 severity_avg=1,outbreak_occurred=int(i%11==0)))
        return pd.DataFrame(rows),pd.DataFrame([dict(region_id=1,population=100000,sanitation_index=70,
                    hospital_count=4,area_sq_km=40,latitude=19,longitude=73)]),pd.DataFrame()

    def test_future_and_labels_do_not_change_earlier_features(self):
        cases,regions,env=self.frame()
        _,original=build_features(prepare_daily(cases,regions,env),['A90','J10.1'])
        cases.loc[cases.date>pd.Timestamp('2024-12-01'),'case_count']=99999
        cases['outbreak_occurred']=1-cases.outbreak_occurred
        daily,changed=build_features(prepare_daily(cases,regions,env),['A90','J10.1'])
        m=daily.date<=pd.Timestamp('2024-12-01')
        np.testing.assert_array_equal(original.loc[m].to_numpy(),changed.loc[m].to_numpy())

    def test_lags_are_calendar_days_and_disease_specific(self):
        cases,regions,env=self.frame()
        cases=cases[~((cases.disease_code=='A90') & (cases.date==pd.Timestamp('2024-01-08')))]
        daily,X=build_features(prepare_daily(cases,regions,env),['A90','J10.1'])
        row=X.loc[(daily.disease_code=='A90') & (daily.date==pd.Timestamp('2024-01-15'))].iloc[0]
        self.assertEqual(row.cases_lag_7,-1)
        row=X.loc[(daily.disease_code=='J10.1') & (daily.date==pd.Timestamp('2024-01-15'))].iloc[0]
        self.assertEqual(row.cases_lag_7,1007)

    def test_missing_weather_is_not_a_zero_reading(self):
        cases,regions,env=self.frame()
        _,X=build_features(prepare_daily(cases,regions,env),['A90','J10.1'])
        self.assertTrue((X.temperature_celsius_missing==1).all())
        self.assertTrue((X.temperature_celsius==-1).all())

    def test_corrupt_bundle_is_rejected(self):
        _,manifest=_bundle()
        from .services import ML_MODELS_ROOT
        with TemporaryDirectory() as folder:
            root=Path(folder)
            (root/'manifest.json').write_text(json.dumps(manifest))
            for name in manifest['files']:
                (root/name).write_bytes((ML_MODELS_ROOT/manifest['version']/name).read_bytes())
            with (root/'bundle.joblib').open('ab') as out:
                out.write(b'corruption')
            with self.assertRaises(ModelUnavailable):
                load_bundle(root)


class PipelineTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.today=_today()
        cls.user=get_user_model().objects.create_user(email='ml-admin@example.com',role='admin')
        cls.regions=[]
        for i in range(2):
            r=Region.objects.create(name=f'ML region {i}',district='Test',state='Test',latitude=19+i*.01,
                longitude=73,population=100000,area_sq_km=40,sanitation_index=70,hospital_count=4)
            cls.regions.append(r)
            SurveillanceData.objects.bulk_create([SurveillanceData(region=r,date=cls.today-timedelta(days=d),
                disease_code='A90',disease_name='Dengue',case_count=10,average_severity=2,cases_per_100k=10,
                provenance='synthetic') for d in range(0,420)])
            EnvironmentalData.objects.bulk_create([EnvironmentalData(region=r,date=cls.today-timedelta(days=d),
                temperature=28,humidity=70,rainfall=5,aqi=100,water_quality_index=70) for d in range(0,420)])

    def test_complete_pipeline_and_api_contracts(self):
        from .tasks import run_complete_ml_pipeline
        result=run_complete_ml_pipeline('A90')
        self.assertEqual(result['status'],'complete',result['errors'])
        self.assertEqual(Forecast.objects.count(),402)
        self.assertEqual(RiskScore.objects.filter(inference_status='ok').count(),2)
        self.assertEqual(RiskScore.objects.first().disease_name,'Dengue')
        self.assertEqual(Forecast.objects.first().disease_name,'Dengue')
        self.assertTrue(all(f.prediction_date>self.today for f in Forecast.objects.all()))
        self.assertTrue(all(f.lower_bound<=f.predicted_cases<=f.upper_bound for f in Forecast.objects.all()))
        run_complete_ml_pipeline('A90')
        self.assertEqual(Forecast.objects.count(),402)
        self.assertEqual(RiskScore.objects.count(),2)
        client=APIClient();client.force_authenticate(self.user)
        for url in ['ml-models/','ml-pipeline-status/','forecasts/?horizon=90','risk-scores/',
                    'anomalies/','clusters/','forecast-chart-data/?horizon=90','heat-map-data/']:
            response=client.get('/api/surveillance/'+url)
            self.assertEqual(response.status_code,200,(url,response.data))
        metadata=client.get('/api/surveillance/ml-models/').data
        self.assertTrue(all(m['model_available'] for m in metadata.values()))
        self.assertEqual(client.get('/api/surveillance/forecast-chart-data/?horizon=90').data['data'].__len__(),90)

    def test_model_failure_and_unknown_disease_are_unavailable(self):
        with patch('surveillance.services._bundle',side_effect=ModelUnavailable('broken bundle')):
            result=RiskScoringService.calculate_risk_score(self.regions[0],'A90')
        self.assertEqual(result.risk_level,-1)
        self.assertIsNone(result.risk_probability)
        result=RiskScoringService.calculate_risk_score(self.regions[0],'NEW')
        self.assertEqual(result.inference_status,'unavailable')

    def test_stale_data_is_unavailable(self):
        SurveillanceData.objects.filter(date__gte=self.today-timedelta(days=3)).delete()
        result=RiskScoringService.calculate_risk_score(self.regions[0],'A90')
        self.assertEqual(result.inference_status,'unavailable')

    def test_missing_weather_and_area_are_explicit_missing_inputs(self):
        region=self.regions[0]
        region.area_sq_km=None
        region.save(update_fields=['area_sq_km'])
        EnvironmentalData.objects.filter(region=region).delete()
        result=RiskScoringService.calculate_risk_score(region,'A90')
        self.assertEqual(result.inference_status,'ok',result.contributing_factors)

    def test_legacy_outputs_are_preserved_and_masked(self):
        from .serializers import RiskScoreSerializer,AlertSerializer
        legacy=RiskScore.objects.create(region=self.regions[0],disease_code='A90',disease_name='Dengue',
            calculation_date=self.today,risk_level=3,risk_probability=.99)
        serialized=RiskScoreSerializer(legacy).data
        self.assertEqual(serialized['risk_level_display'],'Unavailable')
        self.assertIsNone(serialized['risk_probability'])
        legacy.refresh_from_db()
        self.assertEqual(legacy.risk_probability,.99)
        alert=Alert.objects.create(alert_type='outbreak',disease_code='A90',disease_name='Dengue',
            severity='high',confidence=.95,title='Legacy',description='Legacy')
        self.assertIsNone(AlertSerializer(alert).data['confidence'])
        self.assertEqual(Alert.objects.get(pk=alert.pk).confidence,.95)
        for _ in range(2):
            Forecast.objects.create(region=self.regions[0],disease_code='A90',disease_name='Dengue',
                forecast_date=self.today,prediction_date=self.today+timedelta(days=1),horizon_days=7,
                predicted_cases=999,lower_bound=0,upper_bound=1000,confidence=.95)
        ForecastingService.generate_forecast(self.regions[0],'A90',7)
        ForecastingService.generate_forecast(self.regions[0],'A90',7)
        self.assertEqual(Forecast.objects.filter(inference_key__isnull=True).count(),2)
        self.assertEqual(Forecast.objects.count(),9)

    def test_spatial_population_is_not_counted_per_day(self):
        clusters=ClusteringService.detect_clusters('A90')
        self.assertEqual(len(clusters),1)
        self.assertEqual(clusters[0].total_population,200000)
        self.assertEqual(clusters[0].regions.count(),2)
        self.assertEqual(clusters[0].total_cases,140)

    def test_anomaly_and_alert_writes_are_idempotent(self):
        SurveillanceData.objects.filter(region=self.regions[0],date=self.today).update(case_count=500)
        first=AnomalyDetectionService.detect_anomalies(self.regions[0],'A90')
        second=AnomalyDetectionService.detect_anomalies(self.regions[0],'A90')
        self.assertIsNotNone(first)
        self.assertEqual(first.pk,second.pk)
        self.assertIsNone(AlertService.evaluate_alert_for_region(self.regions[0],'A90'))
        with self.settings(ML_ALLOW_SYNTHETIC_ALERTS=True):
            self.assertIsNotNone(AlertService.evaluate_alert_for_region(self.regions[0],'A90'))
            self.assertIsNone(AlertService.evaluate_alert_for_region(self.regions[0],'A90'))
        self.assertEqual(Alert.objects.count(),1)
        self.assertIsNone(Alert.objects.first().confidence)


class ClinicalAggregationTests(TestCase):
    def setUp(self):
        self.user=get_user_model().objects.create_user(email='clinician@example.com',role='doctor')
        self.region=Region.objects.create(name='Clinical region',district='Test',state='Test',latitude=19,
            longitude=73,population=100000)

    def diagnosis(self,n,consent=True):
        from patients.models import Profile
        from medical.models import MedicalRecord,Diagnosis
        patient=Profile.objects.create(user=self.user,name=f'Test Patient {n}',age=30,gender='male',blood_group='O+',region=self.region.name)
        Consent.objects.create(profile=patient,consent_type='surveillance',is_granted=consent)
        record=MedicalRecord.objects.create(patient=patient,doctor=self.user)
        return Diagnosis.objects.create(record=record,icd_10_code='A90',disease_name='Dengue',severity=2)

    def test_diagnosis_identity_and_daily_totals(self):
        from .signals import queue_diagnosis
        from .tasks import process_inference_queue,run_realtime_decision_fusion
        diagnoses=[self.diagnosis(i) for i in range(5)]
        queue_diagnosis(diagnoses[0]);queue_diagnosis(diagnoses[0])
        self.assertEqual(PendingInferenceQueue.objects.count(),5)
        ids=list(PendingInferenceQueue.objects.values_list('pk',flat=True))
        with patch('surveillance.tasks.chord') as dispatch:
            process_inference_queue()
            dispatch.assert_called_once()
        self.assertEqual(SurveillanceData.objects.get().case_count,5)
        run_realtime_decision_fusion([{'status':'success'}],str(self.region.pk),'A90',[str(i) for i in ids])
        self.diagnosis(6)
        with patch('surveillance.tasks.chord'):
            process_inference_queue()
        self.assertEqual(SurveillanceData.objects.get().case_count,6)

    def test_duplicate_diagnosis_and_suppression(self):
        from medical.models import Diagnosis
        first=self.diagnosis(0)
        Diagnosis.objects.create(record=first.record,icd_10_code='A90',disease_name='Dengue',severity=3)
        from medical.models import MedicalRecord
        repeat=MedicalRecord.objects.create(patient=first.record.patient,doctor=self.user)
        Diagnosis.objects.create(record=repeat,icd_10_code='A90',disease_name='Dengue',severity=3)
        self.diagnosis(1,consent=False)
        AggregationService.aggregate_daily_data(_today(),self.region,'A90')
        result=SurveillanceData.objects.get()
        self.assertEqual(result.observation_status,'suppressed')
        self.assertEqual(result.case_count,0)
        self.assertEqual(PendingInferenceQueue.objects.count(),3)

    def test_dispatch_failure_keeps_retryable_snapshot(self):
        from .tasks import process_inference_queue
        self.diagnosis(0)
        with patch('surveillance.tasks.chord',side_effect=RuntimeError('broker down')):
            result=process_inference_queue()
        self.assertEqual(result['status'],'partial')
        self.assertEqual(PendingInferenceQueue.objects.filter(claimed_at__isnull=True).count(),1)

    def test_failed_chord_does_not_consume_entries(self):
        from .tasks import run_realtime_decision_fusion
        self.diagnosis(0)
        ids=[str(i) for i in PendingInferenceQueue.objects.values_list('pk',flat=True)]
        result=run_realtime_decision_fusion([{'status':'error'}],str(self.region.pk),'A90',ids)
        self.assertEqual(result['status'],'error')
        self.assertEqual(PendingInferenceQueue.objects.count(),1)

    def test_revocation_recomputes_and_suppresses_previous_counts(self):
        records=[self.diagnosis(i) for i in range(5)]
        AggregationService.aggregate_daily_data(_today(),self.region,'A90')
        self.assertEqual(SurveillanceData.objects.get().case_count,5)
        Consent.objects.get(profile=records[0].record.patient).revoke()
        with patch('surveillance.tasks.chord'):
            from .tasks import process_inference_queue
            process_inference_queue()
        self.assertEqual(SurveillanceData.objects.get().observation_status,'suppressed')

    def test_backfill_uses_occurrence_day(self):
        records=[self.diagnosis(i) for i in range(5)]
        from medical.models import Diagnosis
        yesterday=_today()-timedelta(days=1)
        Diagnosis.objects.filter(pk__in=[d.pk for d in records]).update(created_at=timezone.now()-timedelta(days=1))
        PendingInferenceQueue.objects.update(occurrence_date=yesterday)
        with patch('surveillance.tasks.chord'):
            from .tasks import process_inference_queue
            process_inference_queue()
        row=SurveillanceData.objects.get()
        self.assertEqual(row.date,yesterday)
        self.assertEqual(row.case_count,5)

    def test_environmental_provider_is_honest_when_unconfigured(self):
        from .tasks import environmental_data_sync
        with self.settings(ENVIRONMENTAL_DATA_URL=''):
            self.assertEqual(environmental_data_sync()['status'],'not_configured')
        self.assertEqual(EnvironmentalData.objects.count(),0)
