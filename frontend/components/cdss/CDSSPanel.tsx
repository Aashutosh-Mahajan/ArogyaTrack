'use client';

import React from 'react';
import { AlertTriangle, Beaker, Brain, FlaskConical, Pill, ShieldAlert, X } from 'lucide-react';
import { StatusPill } from '@/components/ui/page';
import type { CDSSResult } from '@/types';
import { t as tr } from '@/lib/i18n';

interface CDSSPanelProps {
  result: CDSSResult;
  onClose: () => void;
  /** Called when the doctor adopts a suggested diagnosis. */
  onUseDiagnosis?: (text: string) => void;
}

const RISK = {
  LOW: { tone: 'success' as const, get label() { return tr("Low risk"); } },
  MEDIUM: { tone: 'warning' as const, get label() { return tr("Medium risk"); } },
  HIGH: { tone: 'danger' as const, get label() { return tr("High risk"); } },
  CRITICAL: { tone: 'danger' as const, get label() { return tr("Critical"); } },
};

function Section({ icon: Icon, title, children }: { icon: typeof Brain; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {title}
      </h3>
      {children}
    </section>
  );
}

export function CDSSPanel({ result, onClose, onUseDiagnosis }: CDSSPanelProps) {
  const risk = RISK[result.risk_level?.level] ?? RISK.LOW;

  return (
    <div className="space-y-5 rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <h2 className="text-[15px] font-semibold">{tr("Decision support")}</h2>
            <StatusPill tone={risk.tone}>{risk.label}</StatusPill>
          </div>
          {result.risk_level?.explanation && <p className="mt-1.5 text-[13px] text-muted-foreground">{result.risk_level.explanation}</p>}
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label={tr("Close decision support")}><X className="h-4 w-4" /></button>
      </div>

      {result.early_warnings?.length > 0 && (
        <Section icon={ShieldAlert} title={tr("Early warnings")}>
          <ul className="space-y-2">
            {result.early_warnings.map((w, i) => (
              <li key={i} className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-[13px]">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" /> {w.flag}
                  <StatusPill tone={w.priority === 'Medium' ? 'warning' : 'danger'} className="ml-auto">{w.priority}</StatusPill>
                </div>
                <p className="mt-1 text-muted-foreground">{w.reason}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {result.possible_diagnoses?.length > 0 && (
        <Section icon={Brain} title={tr("Possible diagnoses")}>
          <ul className="space-y-2">
            {result.possible_diagnoses.map((d, i) => (
              <li key={i} className="rounded-xl border p-3 text-[13px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{tr(d.disease_name)}</span>
                  <span className="font-mono text-xs text-muted-foreground">{d.icd_10_code}</span>
                  <StatusPill tone={d.confidence === 'High' ? 'success' : d.confidence === 'Medium' ? 'warning' : 'neutral'} className="ml-auto">{d.confidence}</StatusPill>
                </div>
                <p className="mt-1 text-muted-foreground">{d.reasoning}</p>
                {onUseDiagnosis && (
                  <button type="button" onClick={() => onUseDiagnosis(`${tr(d.disease_name)} (${d.icd_10_code})`)} className="mt-2 text-[12.5px] font-medium text-primary hover:underline">{tr("Use as diagnosis")}</button>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {result.drug_interaction_alerts?.length > 0 && (
        <Section icon={Pill} title={tr("Medication alerts")}>
          <ul className="space-y-2">
            {result.drug_interaction_alerts.map((a, i) => (
              <li key={i} className="rounded-xl border p-3 text-[13px]">
                <div className="flex items-center gap-2 font-medium">{a.drug_a} + {a.drug_b}<StatusPill tone="warning" className="ml-auto">{a.severity}</StatusPill></div>
                <p className="mt-1 text-muted-foreground">{a.description}</p>
                {a.recommendation && <p className="mt-1 text-foreground/80">{a.recommendation}</p>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {result.recommended_tests?.length > 0 && (
        <Section icon={Beaker} title={tr("Suggested tests")}>
          <ul className="divide-y rounded-xl border text-[13px]">
            {result.recommended_tests.map((t, i) => (
              <li key={i} className="flex items-start gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{t.test_name}</div>
                  <div className="text-muted-foreground">{t.reason}</div>
                </div>
                <StatusPill tone={t.urgency === 'Urgent' ? 'danger' : t.urgency === 'Routine' ? 'info' : 'neutral'}>{t.urgency}</StatusPill>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {result.lab_insights?.length > 0 && (
        <Section icon={FlaskConical} title={tr("Lab insights")}>
          <ul className="space-y-1.5 text-[13px]">
            {result.lab_insights.map((l, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-medium">{l.parameter}:</span>
                <span className="text-muted-foreground">{l.value} — {l.interpretation}</span>
                {l.action_needed && <StatusPill tone="warning" className="ml-auto">{tr("Action")}</StatusPill>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <p className="border-t pt-3 text-[11.5px] text-muted-foreground">{tr("Suggestions are generated from anonymised patient data and are not a diagnosis. Clinical judgement applies.")}</p>
    </div>
  );
}
