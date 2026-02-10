import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import toast from 'react-hot-toast';
import type {
  HeatMapData,
  PaginatedResponse,
  DiseaseStats,
  Region,
  SurveillanceData,
  Cluster,
  Forecast,
  Anomaly,
  RiskScore,
  Alert,
  Profile,
  MedicalRecord,
  Allergy,
  ChronicCondition,
  Prescription,
  AdherenceTracker,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        const tokens = this.getTokens();
        if (tokens?.access) {
          config.headers.Authorization = `Bearer ${tokens.access}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // Handle token refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const tokens = this.getTokens();
            if (tokens?.refresh) {
              const response = await axios.post(`${API_URL}/auth/token/refresh/`, {
                refresh: tokens.refresh,
              });

              const newTokens = {
                access: response.data.access,
                refresh: tokens.refresh,
              };

              this.setTokens(newTokens);
              originalRequest.headers.Authorization = `Bearer ${newTokens.access}`;

              return this.client(originalRequest);
            }
          } catch (refreshError) {
            this.clearAuth();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        // Handle other errors
        const errorMessage = error.response?.data?.detail || 
                           error.response?.data?.message || 
                           error.message || 
                           'An error occurred';
        
        toast.error(errorMessage);
        return Promise.reject(error);
      }
    );
  }

  private getTokens() {
    if (typeof window === 'undefined') return null;
    const tokens = localStorage.getItem('auth_tokens');
    return tokens ? JSON.parse(tokens) : null;
  }

  private setTokens(tokens: { access: string; refresh: string }) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_tokens', JSON.stringify(tokens));
    }
  }

  private clearAuth() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_tokens');
      localStorage.removeItem('user');
    }
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.get(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.post(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.put(url, data, config);
    return response.data;
  }

  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.patch(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.delete(url, config);
    return response.data;
  }
}

// Create singleton instance
const apiClient = new ApiClient();

// API endpoints
export const api = {
  // Authentication
  auth: {
    sendOtp: (email: string) => apiClient.post('/auth/send-otp/', { email }),
    verifyOtp: (email: string, otp: string) => 
      apiClient.post('/auth/verify-otp/', { email, otp }),
    register: (data: {
      email: string;
      first_name: string;
      last_name: string;
      phone_number: string;
      date_of_birth: string;
      address: string;
    }) => apiClient.post('/auth/register/', data),
    verifyRegistration: (email: string, otp: string) =>
      apiClient.post('/auth/verify-registration/', { email, otp }),
    registerDoctor: (data: {
      email: string;
      password: string;
      first_name: string;
      last_name: string;
      medical_license: string;
      specialization: string;
      phone: string;
    }) => apiClient.post('/auth/register/doctor/', data),
    registerPatient: (data: {
      email: string;
      password: string;
      first_name: string;
      last_name: string;
      date_of_birth: string;
      gender: string;
      blood_group: string;
      phone: string;
      address: string;
    }) => apiClient.post('/auth/register/patient/', data),
    verifyEmail: (email: string, otp: string) =>
      apiClient.post('/auth/verify-email/', { email, otp }),
    login: (email: string, password: string) =>
      apiClient.post('/auth/login/', { email, password }),
    requestPasswordReset: (email: string) =>
      apiClient.post('/auth/password-reset/request/', { email }),
    confirmPasswordReset: (email: string, otp: string, new_password: string) =>
      apiClient.post('/auth/password-reset/confirm/', { email, otp, new_password }),
    switchProfile: (profileType: string) => 
      apiClient.post('/auth/switch-profile/', { profile_type: profileType }),
    logout: () => apiClient.post('/auth/logout/'),
    refreshToken: (refresh: string) => 
      apiClient.post('/auth/token/refresh/', { refresh }),
  },

  // Patient
  patients: {
    getProfile: (): Promise<Profile> => apiClient.get('/patients/profile/'),
    updateProfile: (data: any) => apiClient.patch('/patients/profile/', data),
    getHealthCard: () => apiClient.get('/patients/health-card/'),
    generateHealthCard: () => apiClient.post('/patients/health-card/'),
    getEmergencyContacts: () => apiClient.get('/patients/emergency-contacts/'),
    addEmergencyContact: (data: any) => apiClient.post('/patients/emergency-contacts/', data),
  },

  // Medical Records
  medical: {
    getRecords: (params?: any): Promise<PaginatedResponse<MedicalRecord>> => 
      apiClient.get('/medical/records/', { params }),
    getRecord: (id: number): Promise<MedicalRecord> => 
      apiClient.get(`/medical/records/${id}/`),
    getAllergies: (): Promise<Allergy[]> => 
      apiClient.get('/medical/allergies/'),
    getChronicConditions: (): Promise<ChronicCondition[]> => 
      apiClient.get('/medical/chronic-conditions/'),
    scanQR: (token: string) => apiClient.post('/medical/scan-qr/', { token }),
    createRecord: (data: any) => apiClient.post('/medical/records/', data),
    addDiagnosis: (recordId: number, data: any) => 
      apiClient.post(`/medical/records/${recordId}/diagnoses/`, data),
  },

  // Prescriptions
  prescriptions: {
    getAll: (params?: any): Promise<PaginatedResponse<Prescription>> => 
      apiClient.get('/prescriptions/', { params }),
    getById: (id: number): Promise<Prescription> => 
      apiClient.get(`/prescriptions/${id}/`),
    create: (data: any) => apiClient.post('/prescriptions/', data),
    validateHash: (prescriptionNumber: string, hash: string) => 
      apiClient.post('/prescriptions/validate-hash/', { prescription_number: prescriptionNumber, hash }),
  },

  // Adherence
  adherence: {
    getTrackers: (): Promise<PaginatedResponse<AdherenceTracker>> => 
      apiClient.get('/adherence/trackers/'),
    getSchedules: (trackerId: number) => 
      apiClient.get(`/adherence/trackers/${trackerId}/schedules/`),
    markDoseTaken: (scheduleId: number, data?: any) => 
      apiClient.post(`/adherence/schedules/${scheduleId}/mark-taken/`, data),
  },

  // Surveillance
  surveillance: {
    getDashboard: (): Promise<{
      total_cases: number;
      monitored_regions: number;
      active_outbreaks?: number;
      total_alerts?: number;
    }> => apiClient.get('/surveillance/dashboard-overview/'),
    
    getHeatMap: (params?: any): Promise<HeatMapData[]> => 
      apiClient.get('/surveillance/heat-map-data/', { params }),
    
    getDiseaseStats: (params?: any): Promise<PaginatedResponse<DiseaseStats>> => 
      apiClient.get('/surveillance/disease-statistics/', { params }),
    
    getRegionalComparison: (params?: any) => 
      apiClient.get('/surveillance/regional-comparison/', { params }),
    
    getRegions: (params?: any): Promise<PaginatedResponse<Region>> => 
      apiClient.get('/surveillance/regions/', { params }),
    
    getSurveillanceData: (params?: any): Promise<PaginatedResponse<SurveillanceData>> => 
      apiClient.get('/surveillance/surveillance-data/', { params }),
    
    getClusters: (params?: any): Promise<PaginatedResponse<Cluster>> => 
      apiClient.get('/surveillance/clusters/', { params }),
    
    getForecasts: (params?: any): Promise<PaginatedResponse<Forecast>> => 
      apiClient.get('/surveillance/forecasts/', { params }),
    
    getAnomalies: (params?: any): Promise<PaginatedResponse<Anomaly>> => 
      apiClient.get('/surveillance/anomalies/', { params }),
    
    getRiskScores: (params?: any): Promise<PaginatedResponse<RiskScore>> => 
      apiClient.get('/surveillance/risk-scores/', { params }),
    
    getAlerts: (params?: any): Promise<PaginatedResponse<Alert>> => 
      apiClient.get('/surveillance/alerts/', { params }),
    
    acknowledgeAlert: (id: number) => 
      apiClient.post(`/surveillance/alerts/${id}/acknowledge/`),
    
    resolveAlert: (id: number, data?: any) => 
      apiClient.post(`/surveillance/alerts/${id}/resolve/`, data),
  },

  // Pharmacy
  pharmacy: {
    scanPrescription: (qrData: string) => 
      apiClient.post('/pharmacy/scan-prescription/', { qr_data: qrData }),
    dispense: (data: any) => apiClient.post('/pharmacy/dispense/', data),
    getDispensingRecords: (params?: any) => 
      apiClient.get('/pharmacy/dispensing-records/', { params }),
  },
};

export default apiClient;
