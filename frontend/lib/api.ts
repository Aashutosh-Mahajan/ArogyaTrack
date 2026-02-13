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
  EnvironmentalData,
  AdminDashboardData,
  MLModelInfo,
  MLPipelineStatus,
  Profile,
  PatientProfile,
  MedicalRecord,
  Allergy,
  ChronicCondition,
  Prescription,
  AdherenceTracker,
  PatientRegistrationData,
  DoctorRegistrationData,
  RegistrationResponse,
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
        
        // Don't show toast for registration/login/auth endpoints - they handle their own errors
        const requestUrl = error.config?.url || '';
        const isAuthRequest = requestUrl.includes('/auth/register/') || 
                             requestUrl.includes('/auth/login/') ||
                             requestUrl.includes('/auth/verify-email/');
        if (!isAuthRequest) {
          toast.error(errorMessage);
        }
        return Promise.reject(error);
      }
    );
  }

  private getTokens() {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem('auth-storage');
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return parsed?.state?.tokens || null;
    } catch {
      return null;
    }
  }

  private setTokens(tokens: { access: string; refresh: string }) {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem('auth-storage');
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (parsed?.state) {
        parsed.state.tokens = tokens;
        localStorage.setItem('auth-storage', JSON.stringify(parsed));
      }
    } catch {
      // ignore
    }
  }

  private clearAuth() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth-storage');
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
    
    // Production-grade registration with file uploads
    registerPatientWithDocuments: async (data: PatientRegistrationData): Promise<RegistrationResponse> => {
      const formData = new FormData();
      
      // Add all fields to FormData
      Object.entries(data).forEach(([key, value]) => {
        if (value instanceof File) {
          formData.append(key, value);
        } else if (typeof value === 'boolean') {
          formData.append(key, value ? 'true' : 'false');
        } else if (value !== undefined && value !== null) {
          formData.append(key, String(value));
        }
      });
      
      const response = await apiClient.post<RegistrationResponse>('/auth/register/patient/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response;
    },
    
    registerDoctorWithDocuments: async (data: DoctorRegistrationData): Promise<RegistrationResponse> => {
      const formData = new FormData();
      
      // Add all fields to FormData
      Object.entries(data).forEach(([key, value]) => {
        if (value instanceof File) {
          formData.append(key, value);
        } else if (typeof value === 'boolean') {
          formData.append(key, value ? 'true' : 'false');
        } else if (value !== undefined && value !== null) {
          formData.append(key, String(value));
        }
      });
      
      const response = await apiClient.post<RegistrationResponse>('/auth/register/doctor/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response;
    },
    
    verifyEmail: (email: string, otp: string) =>
      apiClient.post('/auth/verify-email/', { email, otp }),
    login: (email: string, password: string) =>
      apiClient.post('/auth/login/', { email, password }),
    requestPasswordReset: (email: string) =>
      apiClient.post('/auth/password-reset/request/', { email }),
    confirmPasswordReset: (email: string, otp: string, new_password: string) =>
      apiClient.post('/auth/password-reset/confirm/', { email, otp, new_password }),
    getCurrentUser: () => apiClient.get('/auth/me/'),
    logout: () => apiClient.post('/auth/logout/'),
    refreshToken: (refresh: string) => 
      apiClient.post('/auth/token/refresh/', { refresh }),
  },

  // Patient
  patients: {
    getProfile: (): Promise<Profile> => apiClient.get('/patients/profile/'),
    updateProfile: (data: Partial<Profile>) => apiClient.patch('/patients/profile/', data),
    getPatientProfile: (): Promise<PatientProfile> => apiClient.get('/patients/patient-profile/'),
    updatePatientProfile: (data: Partial<PatientProfile>) => apiClient.patch('/patients/patient-profile/', data),
    createProfile: (data: Partial<Profile>) => apiClient.post('/patients/create-profile/', data),
    getMyProfiles: () => apiClient.get('/patients/my-profiles/'),
    switchProfile: (profileId: string) => apiClient.put('/patients/switch-profile/', { profile_id: profileId }),
    getHealthCard: () => apiClient.get('/patients/health-card/'),
    generateHealthCard: () => apiClient.post('/patients/health-card/'),
    getEmergencyContacts: (profileId: string) => apiClient.get(`/patients/${profileId}/emergency-contacts/`),
    addEmergencyContact: (profileId: string, data: any) => apiClient.post(`/patients/${profileId}/emergency-contacts/`, data),
    // Secure Digital Patient Card
    getPatientCard: () => apiClient.get('/patients/my-card/'),
    downloadPatientCardPDF: () =>
      apiClient.get('/patients/my-card/pdf/', { responseType: 'blob' as any }),
    getQRImage: () =>
      apiClient.get('/patients/my-card/qr-image/', { responseType: 'blob' as any }),
  },

  // Medical Records (backend mounts medical app at /api/doctors/)
  medical: {
    getRecords: (params?: any): Promise<PaginatedResponse<MedicalRecord>> => 
      apiClient.get('/doctors/my-records/', { params }),
    getRecord: (id: number): Promise<MedicalRecord> => 
      apiClient.get(`/doctors/medical-records/${id}/`),
    getAllergies: (): Promise<Allergy[]> => 
      apiClient.get('/doctors/my-allergies/'),
    getChronicConditions: (): Promise<ChronicCondition[]> => 
      apiClient.get('/doctors/my-conditions/'),
    scanQR: (token: string) => apiClient.post('/doctors/scan-health-card/', { token }),
    scanPatientQR: (signedToken: string) => apiClient.get(`/patients/qr/${signedToken}/`),
    createRecord: (data: any) => apiClient.post('/doctors/medical-records/', data),
    addDiagnosis: (recordId: number, data: any) => 
      apiClient.post(`/doctors/patients/${recordId}/conditions/`, data),
  },

  // Prescriptions
  prescriptions: {
    getAll: (params?: any): Promise<PaginatedResponse<Prescription>> => 
      apiClient.get('/prescriptions/my-prescriptions/', { params }),
    getById: (id: string): Promise<Prescription> => 
      apiClient.get(`/prescriptions/${id}/`),
    create: (data: any) => apiClient.post('/prescriptions/create/', data),
    validateHash: (prescriptionNumber: string, hash: string) => 
      apiClient.post('/prescriptions/validate-hash/', { prescription_number: prescriptionNumber, hash }),
  },

  // Adherence
  adherence: {
    getTrackers: (params?: any): Promise<PaginatedResponse<AdherenceTracker>> => 
      apiClient.get('/adherence/my-trackers/', { params }),
    getTracker: (trackerId: string) => 
      apiClient.get(`/adherence/tracker/${trackerId}/`),
    getUpcomingDoses: () => apiClient.get('/adherence/upcoming-doses/'),
    getMissedDoses: () => apiClient.get('/adherence/missed-doses/'),
    markDoseTaken: (data: any) => 
      apiClient.post('/adherence/record-dose/', data),
  },

  // Surveillance
  surveillance: {
    getDashboard: (): Promise<AdminDashboardData> => 
      apiClient.get('/surveillance/dashboard-overview/'),
    
    getHeatMap: (params?: any): Promise<HeatMapData[]> => 
      apiClient.get<any>('/surveillance/heat-map-data/', { params }).then(res => res?.data || res || []),
    
    getDiseaseStats: (params?: any): Promise<DiseaseStats[]> => 
      apiClient.get<any>('/surveillance/disease-statistics/', { params }).then(res => res?.statistics || res || []),
    
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

    getEnvironmentalData: (params?: any): Promise<PaginatedResponse<EnvironmentalData>> =>
      apiClient.get('/surveillance/environmental-data/', { params }),
    
    acknowledgeAlert: (id: string, data?: any) => 
      apiClient.post(`/surveillance/alerts/${id}/action/`, { action: 'acknowledge', ...data }),
    
    resolveAlert: (id: string, data?: any) => 
      apiClient.post(`/surveillance/alerts/${id}/action/`, { action: 'resolve', ...data }),

    escalateAlert: (id: string, data?: any) =>
      apiClient.post(`/surveillance/alerts/${id}/action/`, { action: 'escalate', ...data }),

    // ML Model endpoints
    getMLModels: (): Promise<MLModelInfo[]> =>
      apiClient.get<any>('/surveillance/ml-models/').then(res => {
        // Transform object format to array format
        if (res && !Array.isArray(res)) {
          return Object.entries(res).map(([key, val]: [string, any]) => ({
            name: val.name || key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
            type: val.description || key,
            version: val.version || '1.0',
            path: val.artifacts?.model || '',
            loaded: val.model_available ?? false,
            features: val.features || [],
            metrics: val.metrics || {},
            metadata: val,
          }));
        }
        return res || [];
      }),

    getMLPipelineStatus: (): Promise<MLPipelineStatus> =>
      apiClient.get<any>('/surveillance/ml-pipeline-status/').then(res => {
        // Transform backend format {models: {name: bool}} to frontend format {models: {name: {loaded, path}}}
        if (res?.models && typeof Object.values(res.models)[0] === 'boolean') {
          const transformed: Record<string, { loaded: boolean; path: string; error?: string }> = {};
          for (const [name, loaded] of Object.entries(res.models)) {
            transformed[name] = { loaded: loaded as boolean, path: '', error: (loaded as boolean) ? undefined : 'Not loaded' };
          }
          return { ...res, overall_status: res.active_alerts > 0 ? 'warning' : 'healthy', models: transformed };
        }
        return res;
      }),

    runMLPipeline: (diseaseCode: string): Promise<{ message: string; task_id: string; disease_code: string }> =>
      apiClient.post('/surveillance/run-ml-pipeline/', { disease_code: diseaseCode }),
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
