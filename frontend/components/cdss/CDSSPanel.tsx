'use client';

import React, { useState } from 'react';
import type { CDSSResult } from '@/types';
import { FiAlertTriangle, FiActivity, FiShield, FiCheckCircle, FiEdit2, FiX } from 'react-icons/fi';

interface CDSSPanelProps {
  result: CDSSResult;
  onClose: () => void;
}

export function CDSSPanel({ result, onClose }: CDSSPanelProps) {
  const [editedDiagnoses, setEditedDiagnoses] = useState<Record<number, string>>({});
  const [checkedTests, setCheckedTests] = useState<Record<number, boolean>>({});

  const riskColors: Record<string, { bg: string; border: string; text: string; pulse: boolean }> = {
    LOW: { bg: 'bg-green-50', border: 'border-green-400', text: 'text-green-700', pulse: false },
    MEDIUM: { bg: 'bg-yellow-50', border: 'border-yellow-400', text: 'text-yellow-700', pulse: false },
    HIGH: { bg: 'bg-orange-50', border: 'border-orange-400', text: 'text-orange-700', pulse: false },
    CRITICAL: { bg: 'bg-red-50', border: 'border-red-500', text: 'text-red-700', pulse: true },
  };

  const risk = riskColors[result.risk_level.level] || riskColors.LOW;

  const priorityBadge = (priority: string) => {
    const map: Record<string, string> = {
      Critical: 'bg-red-100 text-red-700',
      High: 'bg-orange-100 text-orange-700',
      Medium: 'bg-yellow-100 text-yellow-700',
    };
    return map[priority] || 'bg-muted text-foreground/80';
  };

  const severityBadge = (severity: string) => {
    const s = severity.toLowerCase();
    if (s === 'contraindicated') return 'bg-red-100 text-red-700';
    if (s === 'major') return 'bg-orange-100 text-orange-700';
    if (s === 'moderate') return 'bg-yellow-100 text-yellow-700';
    return 'bg-muted text-muted-foreground';
  };

  const confidenceBadge = (confidence: string) => {
    if (confidence === 'High') return 'bg-green-100 text-green-700';
    if (confidence === 'Medium') return 'bg-yellow-100 text-yellow-700';
    return 'bg-muted text-muted-foreground';
  };

  const urgencyBadge = (urgency: string) => {
    if (urgency === 'Urgent') return 'bg-red-100 text-red-700';
    if (urgency === 'Routine') return 'bg-blue-100 text-blue-700';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="space-y-6">
      {/* 1. Risk Level Banner */}
      <div className={`rounded-2xl border-2 ${risk.border} ${risk.bg} p-6 shadow-lg bg-card/80 backdrop-blur-md overflow-hidden ${risk.pulse ? 'animate-pulse' : ''}`}>
        <div className="h-1 bg-gradient-to-r from-indigo-500 to-blue-500 -mt-6 -mx-6 mb-4" />
        <div className="flex items-center gap-3">
          <FiShield className={`h-8 w-8 ${risk.text}`} />
          <div>
            <span className={`text-2xl font-bold ${risk.text}`}>{result.risk_level.level} RISK</span>
            <p className="text-sm text-muted-foreground mt-1">{result.risk_level.explanation}</p>
          </div>
        </div>
      </div>

      {/* 2. Early Warnings */}
      {result.early_warnings && result.early_warnings.length > 0 && (
        <div className="rounded-2xl shadow-lg bg-card/80 backdrop-blur-md overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-indigo-500 to-blue-500" />
          <div className="p-6">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
              <FiAlertTriangle className="h-5 w-5 text-amber-500" />
              Early Warnings
            </h3>
            <div className="space-y-3">
              {result.early_warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-background">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityBadge(w.priority)}`}>{w.priority}</span>
                  <div>
                    <p className="font-medium text-foreground">{w.flag}</p>
                    <p className="text-sm text-muted-foreground">{w.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. Drug Interaction Alerts */}
      {result.drug_interaction_alerts && result.drug_interaction_alerts.length > 0 && (
        <div className="rounded-2xl shadow-lg bg-card/80 backdrop-blur-md overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-indigo-500 to-blue-500" />
          <div className="p-6">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
              <FiActivity className="h-5 w-5 text-red-500" />
              Drug Interaction Alerts
            </h3>
            <div className="space-y-3">
              {result.drug_interaction_alerts.map((a, i) => (
                <div key={i} className="p-3 rounded-xl bg-background space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">{a.drug_a}</span>
                    <span className="text-muted-foreground">+</span>
                    <span className="font-medium text-foreground">{a.drug_b}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${severityBadge(a.severity)}`}>{a.severity}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{a.description}</p>
                  <p className="text-sm text-muted-foreground italic">{a.recommendation}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. Possible Diagnoses */}
      <div className="rounded-2xl shadow-lg bg-card/80 backdrop-blur-md overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-indigo-500 to-blue-500" />
        <div className="p-6">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
            <FiCheckCircle className="h-5 w-5 text-indigo-500" />
            Possible Diagnoses
          </h3>
          <div className="space-y-3">
            {(result.possible_diagnoses || []).map((dx, i) => {
              const isEdited = editedDiagnoses[i] !== undefined;
              const displayName = isEdited ? editedDiagnoses[i] : dx.disease_name;
              return (
                <div key={i} className="p-3 rounded-xl bg-background space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{dx.icd_10_code}</span>
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setEditedDiagnoses((prev) => ({ ...prev, [i]: e.target.value }))}
                        className={`flex-1 text-sm font-medium border rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-400 ${isEdited ? 'bg-yellow-50 border-yellow-300' : 'bg-card border-border'}`}
                      />
                      <FiEdit2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${confidenceBadge(dx.confidence)}`}>{dx.confidence}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{dx.reasoning}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 5. Recommended Tests */}
      <div className="rounded-2xl shadow-lg bg-card/80 backdrop-blur-md overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-indigo-500 to-blue-500" />
        <div className="p-6">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
            <FiActivity className="h-5 w-5 text-primary" />
            Recommended Tests
          </h3>
          <div className="space-y-3">
            {(result.recommended_tests || []).map((t, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-background">
                <input
                  type="checkbox"
                  checked={!!checkedTests[i]}
                  onChange={() => setCheckedTests((prev) => ({ ...prev, [i]: !prev[i] }))}
                  className="mt-1 h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">{t.test_name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${urgencyBadge(t.urgency)}`}>{t.urgency}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{t.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 6. Lab Insights */}
      {result.lab_insights && result.lab_insights.length > 0 && (
        <div className="rounded-2xl shadow-lg bg-card/80 backdrop-blur-md overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-indigo-500 to-blue-500" />
          <div className="p-6">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
              <FiActivity className="h-5 w-5 text-purple-500" />
              Lab Insights
            </h3>
            <div className="space-y-3">
              {result.lab_insights.map((l, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-background">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {l.action_needed && <span className="h-2 w-2 rounded-full bg-red-500 flex-shrink-0" />}
                      <span className="font-medium text-foreground">{l.parameter}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground/80">{l.value}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{l.interpretation}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Dismiss Button */}
      <div className="flex justify-center pt-2 pb-4">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-muted text-muted-foreground hover:bg-muted font-medium transition-colors"
        >
          <FiX className="h-4 w-4" />
          Dismiss AI Suggestions
        </button>
      </div>
    </div>
  );
}
