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
  id: number;
  name: string;
  region_type: 'city' | 'district' | 'state' | 'country';
  parent_region?: number;
  population?: number;
  latitude: number;
  longitude: number;
}

export interface SurveillanceData {
  id: number;
  region: Region;
  disease_code: string;
  disease_name: string;
  date: string;
  case_count: number;
  cases_per_100k: number;
  created_at: string;
}

export interface Cluster {
  id: number;
  disease_code: string;
  disease_name: string;
  cluster_label: number;
  center_latitude: number;
  center_longitude: number;
  radius_km: number;
  total_cases: number;
  severity_score: number;
  detected_at: string;
  is_active: boolean;
  regions: ClusterRegion[];
}

export interface ClusterRegion {
  id: number;
  cluster: number;
  region: Region;
  case_count: number;
}

export interface Forecast {
  id: number;
  region: Region;
  disease_code: string;
  disease_name: string;
  forecast_date: string;
  predicted_cases: number;
  lower_bound: number;
  upper_bound: number;
  confidence_level: number;
  model_name: string;
  generated_at: string;
}

export interface Anomaly {
  id: number;
  region: Region;
  disease_code: string;
  disease_name: string;
  date: string;
  actual_cases: number;
  expected_cases: number;
  deviation_percentage: number;
  anomaly_score: number;
  is_outbreak: boolean;
  is_resolved: boolean;
  detected_at: string;
}

export interface RiskScore {
  id: number;
  region: Region;
  disease_code: string;
  disease_name: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_score: number;
  contributing_factors: Record<string, any>;
  calculated_at: string;
}

export interface Alert {
  id: number;
  region: Region;
  disease_code: string;
  disease_name: string;
  alert_type: 'outbreak' | 'cluster' | 'forecast' | 'anomaly' | 'environmental';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence_score: number;
  title: string;
  description: string;
  recommendations: string;
  is_active: boolean;
  is_acknowledged: boolean;
  acknowledged_by?: number;
  acknowledged_at?: string;
  created_at: string;
  escalation_level: number;
}

// Dashboard Types
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
  trend: 'up' | 'down' | 'stable';
  trend_percentage: number;
}

export interface HeatMapData {
  region_id: number;
  region_name: string;
  latitude: number;
  longitude: number;
  case_count: number;
  cases_per_100k: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
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
