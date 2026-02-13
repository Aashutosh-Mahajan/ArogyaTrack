// User & Authentication Types
export interface User {
  id: number;
  email: string;
  role: UserRole;
  active_profile?: string | null; // UUID
  verification_status: 'pending' | 'verified';
  is_active: boolean;
  is_staff: boolean;
  date_joined: string;
  updated_at: string;
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
  id: string; // UUID
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  blood_group: string;
  relationship: 'self' | 'spouse' | 'child' | 'parent' | 'other';
  region?: string;
  
  // Extended fields
  date_of_birth?: string | null;
  phone?: string;
  emergency_contact_number?: string;
  
  // Geographic Information
  district?: string;
  state?: string;
  country: string;
  address?: string;
  pincode?: string;
  full_address?: string;
  calculated_age?: number;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface PatientProfile {
  aadhar_id_proof?: string | null;
  
  // Consent & Terms
  terms_accepted: boolean;
  terms_accepted_at?: string | null;
  consent_store_data: boolean;
  consent_store_data_at?: string | null;
  consent_doctor_access: boolean;
  consent_doctor_access_at?: string | null;
  
  // Privacy Settings
  data_sharing_enabled: boolean;
  
  // Timestamps
  last_consent_update?: string | null;
  created_at: string;
  updated_at: string;
}

export interface HealthCard {
  token: string;
  qr_code_path: string;
  expires_at: string;
  revoked_at?: string | null;
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
  id: string; // UUID
  name: string;
  relationship: string;
  phone: string;
  created_at: string;
}

// Doctor Types
export interface DoctorProfile {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  
  // Personal Information
  date_of_birth?: string | null;
  phone: string;
  
  // Professional Credentials
  medical_license: string;
  degree: 'MBBS' | 'MD' | 'MS' | 'DNB' | 'BDS' | 'BAMS' | 'BHMS' | 'BUMS' | 'Other';
  degree_other?: string;
  specialization: string;
  experience_years: number;
  
  // Clinic Information
  clinic_name?: string;
  clinic_address?: string;
  consultation_fee?: number | null;
  
  // Documents
  license_certificate?: string;
  degree_certificate?: string;
  government_id?: string;
  
  // Verification
  approval_status: 'pending' | 'approved' | 'rejected';
  approved_by?: number | null;
  approved_at?: string | null;
  rejection_reason?: string;
  is_verified: boolean;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

// Medical Records Types
export interface MedicalRecord {
  id: string; // UUID
  patient: string; // UUID FK to Profile
  doctor: number; // FK to User
  doctor_name?: string;
  symptoms: string;
  notes?: string;
  created_at: string;
  diagnoses?: Diagnosis[];
}

export interface Diagnosis {
  id: string; // UUID
  icd_10_code: string;
  disease_name: string;
  severity: number;
  created_at: string;
}

export interface Allergy {
  id: string; // UUID
  profile: string; // UUID FK
  allergen: string;
  reaction_type: string;
  severity: number;
  created_at: string;
}

export interface ChronicCondition {
  id: string; // UUID
  profile: string; // UUID FK
  icd_10_code: string;
  disease_name: string;
  is_active: boolean;
  created_at: string;
}

export interface DoctorPatientAccess {
  id: string; // UUID
  doctor: number;
  patient: string; // UUID FK
  granted_at: string;
  expires_at: string;
  access_method: string;
  is_valid: boolean;
}

// Prescription Types
export interface Medicine {
  id: string; // UUID
  name: string;
  generic_name: string;
  drug_class: string;
  therapeutic_category: string;
  standard_dosages: Record<string, string>;
  allergens: string[];
  is_active: boolean;
  created_at: string;
}

export interface Prescription {
  id: string; // UUID
  patient: string; // UUID FK to Profile
  patient_name?: string;
  doctor: number; // FK to User
  doctor_name?: string;
  medical_record?: string | null; // UUID FK
  qr_code_path: string;
  security_hash: string;
  status: 'pending' | 'partially_dispensed' | 'fully_dispensed';
  medicines: PrescriptionMedicine[];
  created_at: string;
  updated_at: string;
}

export interface PrescriptionMedicine {
  id: string; // UUID
  prescription: string; // UUID FK
  medicine: string | Medicine; // UUID FK or populated Medicine
  medicine_name?: string;
  medicine_generic?: string;
  dosage: string;
  frequency: string;
  duration_days: number;
  quantity: number;
  special_instructions?: string;
  dispense_status: 'pending' | 'dispensed' | 'unavailable' | 'patient_has';
  dispensed_at?: string | null;
  created_at: string;
}

export interface DrugInteraction {
  id: string; // UUID
  medicine_a: string; // UUID FK
  medicine_b: string; // UUID FK
  severity: 'minor' | 'moderate' | 'major' | 'contraindicated';
  description: string;
  created_at: string;
}

// Adherence Types
export interface AdherenceTracker {
  id: string; // UUID
  prescription: string; // UUID FK
  patient: string; // UUID FK to Profile
  start_date: string;
  end_date: string;
  expected_doses: number;
  actual_doses: number;
  adherence_percentage: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DoseSchedule {
  id: string; // UUID
  tracker: string; // UUID FK
  medicine: string; // UUID FK
  prescription_medicine: string; // UUID FK
  scheduled_time: string;
  is_taken: boolean;
  taken_at?: string | null;
  reminder_sent: boolean;
  created_at: string;
}

export interface AdherenceReminder {
  id: string; // UUID
  tracker: string; // UUID FK
  dose_schedule: string; // UUID FK
  channel: 'email' | 'sms' | 'push';
  status: 'pending' | 'sent' | 'failed' | 'acknowledged';
  sent_at?: string | null;
  acknowledged_at?: string | null;
  error_message?: string;
  created_at: string;
}

// Pharmacy Types
export interface Pharmacy {
  id: string; // UUID
  name: string;
  license_number: string;
  address: string;
  phone: string;
  email: string;
  owner: number; // FK to User
  is_active: boolean;
  created_at: string;
}

export interface DispensingRecord {
  id: string; // UUID
  prescription: string; // UUID FK
  prescription_medicine: string; // UUID FK
  pharmacy: string; // UUID FK
  pharmacist: number; // FK to User
  status: string;
  quantity_dispensed: number;
  notes?: string;
  dispensed_at: string;
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

// Production-Grade Registration Types
export interface PatientRegistrationData {
  // Account credentials
  email: string;
  password: string;
  
  // Personal information
  first_name: string;
  last_name: string;
  date_of_birth: string; // YYYY-MM-DD format
  gender: 'male' | 'female' | 'other';
  phone: string;
  blood_group: string;
  
  // Address details
  address: string;
  district: string;
  state: string;
  country?: string;
  pincode: string;
  
  // Emergency contact
  emergency_contact_number: string;
  
  // ID proof upload
  aadhar_id_proof: File;
  
  // Consent agreements (all required)
  terms_accepted: boolean;
  consent_store_data: boolean;
  consent_doctor_access: boolean;
}

export interface DoctorRegistrationData {
  // Account credentials
  email: string;
  password: string;
  
  // Personal information
  first_name: string;
  last_name: string;
  date_of_birth: string; // YYYY-MM-DD format
  phone: string;
  
  // Professional information
  medical_license: string;
  degree: 'MBBS' | 'MD' | 'MS' | 'DNB' | 'BDS' | 'BAMS' | 'BHMS' | 'BUMS' | 'Other';
  degree_other?: string; // Required if degree === 'Other'
  specialization: string;
  experience_years: number;
  
  // Clinic details
  clinic_name?: string;
  clinic_address?: string;
  consultation_fee?: number;
  
  // Document uploads (all required)
  license_certificate: File;
  degree_certificate: File;
  government_id: File;
  
  // Terms acceptance
  terms_accepted: boolean;
}

export interface RegistrationResponse {
  detail: string;
  user_id?: number;
  email?: string;
  status?: string;
  approval_message?: string;
}
