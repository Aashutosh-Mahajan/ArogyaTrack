'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, User } from 'lucide-react';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import { EmptyState, SkeletonRows } from '@/components/ui/page';
import { extractError } from '@/components/auth/SignInForm';
import { DispenseList } from '@/components/pharmacy/DispenseList';
import { initialsOf } from '@/components/layout/useShell';
import { cn } from '@/lib/utils';
import type { Prescription } from '@/types';
import { t as tr } from '@/lib/i18n';

interface PatientScan {
  patient: { id: string; unique_patient_id: string; name: string; age: number; gender: string; blood_group: string; profile_photo_url: string | null };
  doctors: { doctor_id: string; doctor_name: string; prescriptions: Prescription[] }[];
}

function PatientDispensePage() {
  const [query, setQuery] = useState<{ token?: string; patient_id?: string } | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('pharmacy_scan_query');
    setQuery(raw ? JSON.parse(raw) : {});
  }, []);

  // After a token scan, later refreshes use the patient ID so a used token is not replayed.
  const q = useQuery<PatientScan>({
    queryKey: ['pharmacy-patient', query],
    queryFn: async () => {
      const r = (await api.pharmacy.scanPatient(query!)) as PatientScan;
      sessionStorage.setItem('pharmacy_scan_query', JSON.stringify({ patient_id: r.patient.unique_patient_id }));
      return r;
    },
    enabled: !!query && !!(query.token || query.patient_id),
  });

  const all = useMemo(() => (q.data?.doctors ?? []).flatMap((d) => d.prescriptions).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)), [q.data]);
  const open = all.filter((p) => p.status !== 'fully_dispensed');
  const list = showAll ? all : open;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/pharmacy/scan" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />{' '}{tr("Scan another")}</Link>

      {query && !query.token && !query.patient_id ? (
        <EmptyState icon={User} title={tr("No patient selected")} description={tr("Scan a health card or enter a patient ID first.")} action={<Link href="/pharmacy/scan" className="text-[13.5px] font-semibold text-primary">{tr("Go to scan")}</Link>} />
      ) : q.isLoading || !query ? (
        <div className="rounded-2xl border bg-card p-5"><SkeletonRows rows={4} /></div>
      ) : q.isError ? (
        <EmptyState icon={User} title={tr("Patient not found")} description={extractError(q.error, tr("That card or ID did not match a patient."))} action={<Link href="/pharmacy/scan" className="text-[13.5px] font-semibold text-primary">{tr("Try again")}</Link>} />
      ) : q.data ? (
        <div className="space-y-5">
          <section className="flex items-center gap-4 rounded-2xl border bg-card p-5 shadow-sm">
            {q.data.patient.profile_photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={q.data.patient.profile_photo_url} alt="" className="h-14 w-14 rounded-2xl object-cover" />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-lg font-semibold text-accent-foreground">{initialsOf(q.data.patient.name)}</span>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[20px] font-semibold tracking-tight">{q.data.patient.name}</h1>
              <div className="text-[13px] text-muted-foreground"><span className="font-mono">{q.data.patient.unique_patient_id}</span>{' '}{tr("· {age} y · {gender} · {blood_group}", { age: q.data.patient.age, gender: q.data.patient.gender, blood_group: q.data.patient.blood_group })}</div>
            </div>
            <div className="inline-flex rounded-lg border p-0.5 text-[12.5px]">
              {[{ k: false, l: tr('Open ({count})', { count: open.length }) }, { k: true, l: tr('All ({count})', { count: all.length }) }].map((t) => (
                <button key={String(t.k)} onClick={() => setShowAll(t.k)} className={cn('rounded-md px-2.5 py-1 font-medium', showAll === t.k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>{t.l}</button>
              ))}
            </div>
          </section>
          {list.length ? (
            <DispenseList prescriptions={list} onChanged={() => q.refetch()} />
          ) : (
            <EmptyState icon={User} title={tr("No open prescriptions")} description={tr("Everything prescribed to this patient has been handled.")} />
          )}
        </div>
      ) : null}
    </div>
  );
}

export default withAuth(PatientDispensePage, ['pharmacist']);
