'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, FilePlus2, QrCode, Search } from 'lucide-react';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import { EmptyState, ErrorState, PageHeader, SkeletonRows } from '@/components/ui/page';
import { fieldClass } from '@/components/auth/FormKit';
import { initialsOf } from '@/components/layout/useShell';
import type { MyPatient } from '@/types';
import { t } from '@/lib/i18n';

/** Choose a patient, then record the consultation on the shared consultation page. */
function AddRecordPage() {
  const [search, setSearch] = useState('');
  const q = useQuery({ queryKey: ['myPatients'], queryFn: () => api.medical.getMyPatients() as Promise<{ count: number; results: MyPatient[] }> });
  const list = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (q.data?.results ?? []).filter((p) => !s || p.name.toLowerCase().includes(s) || p.unique_patient_id.toLowerCase().includes(s));
  }, [q.data, search]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("Add a record")} description={t("Pick one of your patients to record a consultation, vitals, reports and a prescription.")} />
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("Search by name or patient ID")} className={`${fieldClass()} pl-10`} aria-label={t("Search patients")} autoFocus />
      </div>
      {q.isLoading ? (
        <div className="rounded-2xl border bg-card p-5"><SkeletonRows rows={4} /></div>
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={QrCode}
          title={q.data?.count ? t("No patients match") : t("No patients with active access")}
          description={t("Scan the patient's health card to get access, then record the consultation.")}
          action={<Link href="/doctor/scan-qr" className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-primary px-3.5 text-[13px] font-medium text-primary-foreground shadow-button"><QrCode className="h-4 w-4" />{' '}{t("Scan health card")}</Link>}
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
          {list.map((p) => (
            <li key={p.patient_id}>
              <Link href={`/doctor/patients/${p.patient_id}/create-consultation`} className="group flex items-center gap-4 px-5 py-3.5 hover:bg-muted/40">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-[13px] font-semibold text-accent-foreground">{initialsOf(p.name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold">{p.name}</span>
                  <span className="block text-xs text-muted-foreground"><span className="font-mono">{p.unique_patient_id}</span>{' '}{t("· {age} y · {visit_count} visits", { age: p.age, visit_count: p.visit_count })}</span>
                </span>
                <span className="hidden items-center gap-1.5 text-[13px] font-medium text-primary sm:inline-flex"><FilePlus2 className="h-4 w-4" />{' '}{t("Record visit")}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default withAuth(AddRecordPage, ['doctor']);
