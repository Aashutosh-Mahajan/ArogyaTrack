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
  Medicine,
  AdherenceTracker,
  DoseSchedule,
  PatientRegistrationData,
  DoctorRegistrationData,
  RegistrationResponse,
  DashboardSummary,
  DashboardKPIs,
  RecentRecord,
  LabTest,
  HealthTrendsResponse,
  DashboardAlert,
  SecurityInfo,
  DownloadItem,
  DayWiseComparisonResponse,
  CDSSResult,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

class ApiClient {
  public client: AxiosInstance; // Made public for direct access when needed

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

    registerPharmacist: async (data: any): Promise<RegistrationResponse> => {
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

      const response = await apiClient.post<RegistrationResponse>('/auth/register/pharmacist/', formData, {
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
    // Secure Digital Patient Card
    getPatientCard: () => apiClient.get('/patients/my-card/'),
    uploadCardPhoto: (photo: File) => {
      const formData = new FormData();
      formData.append('photo', photo);
      return apiClient.post('/patients/my-card/upload-photo/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    downloadPatientCardPDF: () =>
      apiClient.get('/patients/my-card/pdf/', { responseType: 'blob' as any }),
    getQRImage: () =>
      apiClient.get('/patients/my-card/qr-image/', { responseType: 'blob' as any }),
    // Scan Patient QR Code or Enter Patient ID (for doctors/admins)
    scanPatientQR: (data: { token?: string; patient_id?: string }) =>
      apiClient.post('/patients/scan-qr/', data),
  },

  // Medical Records (backend mounts medical app at /api/doctors/)
  medical: {
    getRecords: (params?: any): Promise<PaginatedResponse<MedicalRecord>> =>
      apiClient.get('/doctors/visit-records/', { params }),
    getRecord: (id: number): Promise<MedicalRecord> =>
      apiClient.get(`/doctors/visit-records/${id}/`),
    getAllergies: (): Promise<Allergy[]> =>
      apiClient.get('/doctors/my-allergies/'),
    getChronicConditions: (): Promise<ChronicCondition[]> =>
      apiClient.get('/doctors/my-conditions/'),
    addAllergy: (profileId: string, data: { allergen: string; reaction_type: string; severity: number }) =>
      apiClient.post(`/doctors/patients/${profileId}/allergies/`, data),
    addCondition: (profileId: string, data: { icd_10_code: string; disease_name: string }) =>
      apiClient.post(`/doctors/patients/${profileId}/conditions/`, data),
    getPatientHistory: (profileId: string) =>
      apiClient.get(`/doctors/patient-history/${profileId}/`),
    scanQR: (token: string) => apiClient.post('/doctors/scan-health-card/', { token }),
    scanPatientQR: (signedToken: string) => apiClient.get(`/patients/qr/${signedToken}/`),
    createRecord: (data: any) => apiClient.post('/doctors/medical-records/', data),
    addDiagnosis: (recordId: number, data: any) =>
      apiClient.post(`/doctors/patients/${recordId}/conditions/`, data),
    // Download report with authentication
    downloadReport: async (attachmentId: number, disposition: string = 'attachment'): Promise<Blob> => {
      const response = await apiClient.client.get(
        `/doctors/reports/${attachmentId}/download/`,
        {
          params: { disposition },
          responseType: 'blob',
        }
      );
      return response.data;
    },
    // My Patients Management
    getMyPatients: () => apiClient.get('/doctors/my-patients/'),
    addPatientToMyList: (patientId: string) =>
      apiClient.post('/doctors/my-patients/add/', { patient_id: patientId }),
    createVisitRecord: (patientId: string, data: any, files?: File[]) => {
      if (files && files.length > 0) {
        const formData = new FormData();
        Object.entries(data).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            formData.append(key, String(value));
          }
        });
        files.forEach((file) => {
          formData.append('reports', file);
        });
        return apiClient.post(`/doctors/patients/${patientId}/visit-records/create/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      return apiClient.post(`/doctors/patients/${patientId}/visit-records/create/`, data);
    },
    // High-Risk Patients
    getHighRiskPatients: () => apiClient.get('/doctors/high-risk-patients/'),
    // Dashboard Summary & Activity
    getDashboardSummary: () => apiClient.get('/doctors/dashboard-summary/'),
    getRecentActivity: () => apiClient.get('/doctors/recent-activity/'),
  },

  // Prescriptions
  prescriptions: {
    getAll: (params?: any): Promise<PaginatedResponse<Prescription>> =>
      apiClient.get('/prescriptions/my-prescriptions/', { params }),
    getById: (id: string): Promise<Prescription> =>
      apiClient.get(`/prescriptions/${id}/`),
    getMedicines: (params?: any): Promise<Medicine[]> =>
      apiClient.get('/prescriptions/medicines/', { params }),
    create: (data: any) => apiClient.post('/prescriptions/create/', data),
    validate: (data: any) => apiClient.post('/prescriptions/validate/', data),
    validateHash: (prescriptionNumber: string, hash: string) =>
      apiClient.post('/prescriptions/validate-hash/', { prescription_number: prescriptionNumber, hash }),
  },

  // Adherence
  adherence: {
    getTrackers: (params?: any): Promise<PaginatedResponse<AdherenceTracker>> =>
      apiClient.get('/adherence/my-trackers/', { params }),
    getTracker: (trackerId: string): Promise<AdherenceTracker> =>
      apiClient.get(`/adherence/tracker/${trackerId}/`),
    getUpcomingDoses: (): Promise<DoseSchedule[]> => apiClient.get('/adherence/upcoming-doses/'),
    getMissedDoses: (): Promise<DoseSchedule[]> => apiClient.get('/adherence/missed-doses/'),
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

    getForecastChartData: (params?: { horizon?: number; disease_code?: string }): Promise<any> =>
      apiClient.get('/surveillance/forecast-chart-data/', { params }),

    getAnomalies: (params?: any): Promise<PaginatedResponse<Anomaly>> =>
      apiClient.get('/surveillance/anomalies/', { params }),

    getRiskScores: (params?: any): Promise<PaginatedResponse<RiskScore>> =>
      apiClient.get('/surveillance/risk-scores/', { params }),

    getAlerts: (params?: any): Promise<PaginatedResponse<Alert>> =>
      apiClient.get('/surveillance/alerts/', { params }),

    getEnvironmentalData: (params?: any): Promise<PaginatedResponse<EnvironmentalData>> =>
      apiClient.get('/surveillance/environmental-data/', { params }),

    getDayWiseComparison: (params?: { disease_code?: string; state?: string; district?: string; region_id?: string }): Promise<DayWiseComparisonResponse> =>
      apiClient.get('/surveillance/daywise-comparison/', { params }),

    acknowledgeAlert: (id: string, data?: any) =>
      apiClient.post(`/surveillance/alerts/${id}/acknowledge/`, data || {}),

    resolveAlert: (id: string, data?: any) =>
      apiClient.post(`/surveillance/alerts/${id}/resolve/`, data || {}),

    escalateAlert: (id: string, data?: any) =>
      apiClient.post(`/surveillance/alerts/${id}/escalate/`, data || {}),

    // ML Model endpoints (v5.0 aligned)
    getMLModels: (): Promise<MLModelInfo[]> =>
      apiClient.get<any>('/surveillance/ml-models/').then(res => {
        // Transform object format {key: ModelInfoObj} to array of MLModelInfo
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
            // v5.0 enriched fields
            n_features: val.n_features,
            description: val.description,
            model_available: val.model_available,
            corrector_available: val.corrector_available,
            xgb_available: val.xgb_available,
            scoring_method: val.scoring_method,
            risk_tiers: val.risk_tiers,
            risk_tier_distribution: val.risk_tier_distribution,
            config: val.config,
            horizon_metrics: val.horizon_metrics,
            artifacts: val.artifacts,
            cluster_profiles: val.cluster_profiles,
            parameters: val.parameters,
            latest_forecasts: val.latest_forecasts,
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
    scanPatient: (data: { token?: string; patient_id?: string }) =>
      apiClient.post('/pharmacy/scan-patient/', data),
    dispense: (data: any) => apiClient.post('/pharmacy/dispense-medicine/', data),
    getDispensingRecords: (params?: any) =>
      apiClient.get('/pharmacy/dispensing-history/', { params }),
    getDashboardStats: () => apiClient.get('/pharmacy/dashboard-stats/'),
    // Inventory
    getInventory: (params?: any) => apiClient.get('/pharmacy/inventory/', { params }),
    addInventory: (data: any) => apiClient.post('/pharmacy/inventory/', data),
    list: (params?: any) => apiClient.get('/pharmacy/list/', { params }),
  },

  // Public Client (for custom requests)
  client: apiClient,

  // Patient Dashboard
  dashboard: {
    getSummary: (): Promise<DashboardSummary> =>
      apiClient.get('/dashboard/summary/'),
    getKPIs: (): Promise<DashboardKPIs> =>
      apiClient.get('/dashboard/kpis/'),
    getRecentRecords: (params?: { limit?: number }): Promise<RecentRecord[]> =>
      apiClient.get('/dashboard/recent-records/', { params }),
    getLabMonitoring: (): Promise<LabTest[]> =>
      apiClient.get('/dashboard/lab-monitoring/'),
    getHealthTrends: (params?: { months?: number }): Promise<HealthTrendsResponse> =>
      apiClient.get('/dashboard/health-trends/', { params }),
    getAlerts: (): Promise<DashboardAlert[]> =>
      apiClient.get('/dashboard/alerts/'),
    markAlertRead: (alertId: string): Promise<DashboardAlert> =>
      apiClient.patch(`/dashboard/alerts/${alertId}/`, { is_read: true }),
    dismissAlert: (alertId: string): Promise<DashboardAlert> =>
      apiClient.patch(`/dashboard/alerts/${alertId}/`, { is_dismissed: true }),
    // Security
    getSecurity: (): Promise<SecurityInfo> =>
      apiClient.get('/dashboard/security/'),
    changePassword: (data: { old_password: string; new_password: string; confirm_password: string }): Promise<{ detail: string }> =>
      apiClient.post('/dashboard/change-password/', data),
    toggle2FA: (): Promise<{ detail: string; is_2fa_enabled: boolean }> =>
      apiClient.post('/dashboard/toggle-2fa/'),
    // Downloads
    getDownloads: (): Promise<DownloadItem[]> =>
      apiClient.get('/dashboard/downloads/'),
    downloadFile: (fileId: number, type: string): Promise<Blob> =>
      apiClient.get(`/dashboard/download/${fileId}/`, { params: { type }, responseType: 'blob' }),
    downloadAll: (): Promise<Blob> =>
      apiClient.get('/dashboard/download-all/', { responseType: 'blob' }),
    logDownload: (data: { file_type: string; file_id?: number; file_name: string }): Promise<{ detail: string }> =>
      apiClient.post('/dashboard/log-download/', data),
  },

  // CDSS (Clinical Decision Support)
  cdss: {
    analyze: (patientId: string, currentSymptoms: string): Promise<CDSSResult> =>
      apiClient.post('/cdss/analyze/', { patient_id: patientId, current_symptoms: currentSymptoms }),
  },
};

export default apiClient;
