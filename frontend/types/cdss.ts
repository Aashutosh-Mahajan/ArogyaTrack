// CDSS (Clinical Decision Support System) Types

export interface CDSSDiagnosis {
  icd_10_code: string;
  disease_name: string;
  confidence: 'High' | 'Medium' | 'Low';
  reasoning: string;
}

export interface CDSSDrugAlert {
  drug_a: string;
  drug_b: string;
  severity: string;
  description: string;
  recommendation: string;
}

export interface CDSSTest {
  test_name: string;
  reason: string;
  urgency: 'Urgent' | 'Routine' | 'Follow-up';
}

export interface CDSSLabInsight {
  parameter: string;
  value: string;
  interpretation: string;
  action_needed: boolean;
}

export interface CDSSWarning {
  flag: string;
  reason: string;
  priority: 'Critical' | 'High' | 'Medium';
}

export interface CDSSRiskLevel {
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  explanation: string;
}

export interface CDSSResult {
  risk_level: CDSSRiskLevel;
  possible_diagnoses: CDSSDiagnosis[];
  drug_interaction_alerts: CDSSDrugAlert[];
  recommended_tests: CDSSTest[];
  lab_insights: CDSSLabInsight[];
  early_warnings: CDSSWarning[];
}
