// User & Authentication Types
export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: UserRole;
  active_profile?: number;
  created_at: string;
}

export type UserRole = 'patient' | 'doctor' | 'pharmacist' | 'authority' | 'admin';

export interface LoginCredentials {
  email: string;
  otp?: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
}

// Patient Types
export interface Profile {
  id: number;
  user: number;
  date_of_birth: string;
  gender: 'M' | 'F' | 'O';
  blood_group: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  region?: Region;
  created_at: string;
}

export interface HealthCard {
  id: number;
  profile: number;
  card_number: string;
  qr_code: string;
  jwt_token: string;
  issued_at: string;
  expires_at: string;
  is_active: boolean;
}

// Secure Digital Patient Card
export interface PatientCard {
  unique_patient_id: string;
  name: string;
  date_of_birth: string | null;
  age: number;
  blood_group: string;
  district: string;
  gender: string;
  qr_code_url: string | null;
}

export interface PatientHistoryFromQR {
  patient: {
    unique_patient_id: string;
    name: string;
    date_of_birth: string | null;
    blood_group: string;
    district: string;
    gender: string;
    age: number;
  };
  medical_records: Array<{
    id: string;
    symptoms: string;
    notes: string;
    diagnoses: Array<{
      icd_10_code: string;
      disease_name: string;
      severity: number;
    }>;
    created_at: string;
  }>;
  allergies: Array<{
    allergen: string;
    reaction_type: string;
    severity: number;
  }>;
  chronic_conditions: Array<{
    icd_10_code: string;
    disease_name: string;
    is_active: boolean;
  }>;
  prescriptions: Array<{
    id: string;
    prescription_number: string;
    issued_at: string;
    items: Array<{ medicine_name: string }>;
  }>;
}

export interface EmergencyContact {
  id: number;
  profile: number;
  name: string;
  relationship: string;
  phone: string;
  email?: string;
}

// Medical Records Types
export interface MedicalRecord {
  id: number;
  profile: number;
  doctor: number;
  doctor_name?: string;
  diagnosis: string;
  symptoms: string;
  notes?: string;
  visit_date: string;
  created_at: string;
  diagnoses?: Diagnosis[];
  allergies?: Allergy[];
}

export interface Diagnosis {
  id: number;
  medical_record: number;
  disease_code: string;
  disease_name: string;
  severity: 'mild' | 'moderate' | 'severe';
  diagnosed_at: string;
}

export interface Allergy {
  id: number;
  profile: number;
  allergen: string;
  reaction: string;
  severity: 'mild' | 'moderate' | 'severe';
  diagnosed_date?: string;
}

export interface ChronicCondition {
  id: number;
  profile: number;
  condition_name: string;
  diagnosed_date: string;
  status: 'active' | 'controlled' | 'resolved';
  notes?: string;
}

// Prescription Types
export interface Prescription {
  id: number;
  profile: number;
  doctor: number;
  doctor_name?: string;
  medical_record?: number;
  prescription_number: string;
  diagnosis: string;
  notes?: string;
  language: string;
  qr_code?: string;
  qr_hash?: string;
  issued_at: string;
  expires_at: string;
  is_dispensed: boolean;
  medicines: PrescriptionMedicine[];
}

export interface Medicine {
  id: number;
  name: string;
  generic_name: string;
  strength: string;
  form: string;
  manufacturer?: string;
  description?: string;
}

export interface PrescriptionMedicine {
  id: number;
  prescription: number;
  medicine: Medicine;
  dosage: string;
  frequency: string;
  duration_days: number;
  instructions: string;
  morning: boolean;
  afternoon: boolean;
  evening: boolean;
  night: boolean;
}

// Adherence Types
export interface AdherenceTracker {
  id: number;
  profile: number;
  medicine_name: string;
  prescription?: number;
  start_date: string;
  end_date: string;
  total_doses: number;
  taken_doses: number;
  adherence_percentage: number;
  status: 'active' | 'completed' | 'discontinued';
}

export interface DoseSchedule {
  id: number;
  tracker: number;
  scheduled_time: string;
  is_taken: boolean;
  taken_time?: string;
  notes?: string;
}

// Surveillance Types
export interface Region {
  id: string; // UUID
  name: string;
  district: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  population: number;
  hospital_count: number;
  sanitation_index: number;
  created_at: string;
}

export interface SurveillanceData {
  id: string;
  date: string;
  region: string; // UUID FK
  region_name: string;
  region_details: Region;
  disease_code: string;
  disease_name: string;
  case_count: number;
  average_severity: number;
  cases_per_100k: number;
  created_at: string;
}

export interface ClusterRegion {
  region: string; // UUID FK
  region_details: Region;
  case_count: number;
}

export interface Cluster {
  id: string;
  disease_code: string;
  disease_name: string;
  detection_date: string;
  centroid_lat: number;
  centroid_lon: number;
  radius_km: number;
  total_cases: number;
  total_population: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  growth_rate: number | null;
  is_active: boolean;
  regions_data: ClusterRegion[];
  affected_region_names: string[];
  created_at: string;
}

export interface Forecast {
  id: string;
  region: string;
  region_details: Region;
  disease_code: string;
  disease_name: string;
  forecast_date: string;
  prediction_date: string;
  horizon_days: number;
  predicted_cases: number;
  lower_bound: number;
  upper_bound: number;
  confidence: number;
  created_at: string;
}

export interface Anomaly {
  id: string;
  region: string;
  region_details: Region;
  disease_code: string;
  disease_name: string;
  detection_date: string;
  anomaly_score: number;
  actual_cases: number;
  expected_cases: number;
  deviation_percentage: number;
  description: string;
  is_resolved: boolean;
  created_at: string;
}

export interface RiskScore {
  id: string;
  region: string;
  region_details: Region;
  disease_code: string;
  disease_name: string;
  calculation_date: string;
  risk_level: number; // 0=Low, 1=Medium, 2=High, 3=Critical
  risk_level_display: string;
  risk_probability: number;
  contributing_factors: Record<string, any>;
  created_at: string;
}

export interface EnvironmentalData {
  id: string;
  region: string;
  region_details: Region;
  date: string;
  temperature: number | null;
  humidity: number | null;
  rainfall: number | null;
  aqi: number | null;
  pm25: number | null;
  pm10: number | null;
  water_quality_index: number | null;
  created_at: string;
}

export interface Alert {
  id: string;
  alert_type: string;
  disease_code: string;
  disease_name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  severity_display: string;
  status: 'active' | 'acknowledged' | 'resolved' | 'false_positive';
  status_display: string;
  confidence: number;
  affected_regions_data: Region[];
  title: string;
  description: string;
  predicted_impact: string;
  contributing_factors: Record<string, any>;
  recommended_actions: string;
  generated_at: string;
  acknowledged_at: string | null;
  acknowledged_by: number | null;
  acknowledged_by_email: string | null;
  resolved_at: string | null;
  resolved_by: number | null;
  resolved_by_email: string | null;
  escalation_level: number;
  escalated_at: string | null;
}

export interface Notification {
  id: string;
  alert: string;
  alert_details: Alert;
  recipient: number;
  recipient_email: string;
  channel: 'email' | 'sms' | 'push' | 'dashboard';
  channel_display: string;
  status: 'pending' | 'sent' | 'failed' | 'delivered';
  status_display: string;
  sent_at: string | null;
  delivered_at: string | null;
  error_message: string;
  created_at: string;
}

// Dashboard Types
export interface AdminDashboardData {
  date: string;
  total_cases_today: number;
  active_alerts: number;
  critical_alerts: number;
  high_risk_regions: number;
  active_clusters: number;
  monitored_regions: number;
  top_diseases: TrendingDisease[];
}

export interface TrendingDisease {
  disease_code: string;
  disease_name: string;
  total_cases: number;
  growth_rate: number;
}

export interface DashboardStats {
  total_patients: number;
  total_prescriptions: number;
  total_alerts: number;
  active_outbreaks: number;
}

export interface DiseaseStats {
  disease_code: string;
  disease_name: string;
  total_cases: number;
  affected_regions: number;
  growth_rate?: number;
  average_severity: number;
}

export interface HeatMapData {
  region_id: string;
  region_name: string;
  latitude: number;
  longitude: number;
  case_count: number;
  cases_per_100k: number;
  average_severity: number;
  risk_level: string;
}

// ML Model Types
export interface MLModelInfo {
  name: string;
  type: string;
  version: string;
  path: string;
  loaded: boolean;
  features?: string[];
  metrics?: Record<string, number>;
  metadata?: Record<string, any>;
}

export interface MLPipelineStatus {
  overall_status: string;
  models: Record<string, {
    loaded: boolean;
    path: string;
    error?: string;
  }>;
  last_run?: string;
}

// Chart Data Types
export interface ChartData {
  name: string;
  value: number;
  [key: string]: any;
}

export interface TimeSeriesData {
  date: string;
  value: number;
  forecast?: number;
  lowerBound?: number;
  upperBound?: number;
}

// API Response Types
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ApiError {
  detail?: string;
  message?: string;
  [key: string]: any;
}
