'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Clock, QrCode, Search, Users } from 'lucide-react';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import { EmptyState, ErrorState, PageHeader, SkeletonRows, StatusPill } from '@/components/ui/page';
import { fieldClass } from '@/components/auth/FormKit';
import { initialsOf } from '@/components/layout/useShell';
import type { MyPatient } from '@/types';
import { t, intlLocale } from '@/lib/i18n';

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

function accessLabel(p: MyPatient) {
  const hours = (new Date(p.access_expires_at).getTime() - Date.now()) / 3_600_000;
  if (p.access_method === 'added_to_list' || hours > 24 * 30) return { label: t("On your list"), tone: 'primary' as const };
  if (hours < 1) return { label: t('{count} min left', { count: Math.max(1, Math.round(hours * 60)) }), tone: 'warning' as const };
  return { label: t('{count} h left', { count: Math.round(hours) }), tone: hours < 6 ? ('warning' as const) : ('neutral' as const) };
}

function MyPatientsPage() {
  const [search, setSearch] = useState('');
  const q = useQuery({ queryKey: ['myPatients'], queryFn: () => api.medical.getMyPatients() as Promise<{ count: number; results: MyPatient[] }> });

  const list = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (q.data?.results ?? []).filter(
      (p) => !s || p.name.toLowerCase().includes(s) || p.unique_patient_id.toLowerCase().includes(s) || (p.district || '').toLowerCase().includes(s)
    );
  }, [q.data, search]);

  return (
    <div>
      <PageHeader
        title={t("My patients")}
        description={t("Patients whose health card you have scanned. Scan access lasts 24 hours; add a patient to your list to keep access for ongoing care.")}
        actions={
          <Link href="/doctor/scan-qr" className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-primary px-4 text-[13.5px] font-medium text-primary-foreground shadow-button">
            <QrCode className="h-4 w-4" />{' '}{t("Scan health card")}</Link>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-80">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("Search name, patient ID or district")} className={`${fieldClass()} h-10 pl-10`} aria-label={t("Search patients")} />
        </div>
        <div className="text-[13px] text-muted-foreground">{q.data ? t("{length} of {count} patients", { length: list.length, count: q.data.count }) : ''}</div>
      </div>

      {q.isLoading ? (
        <div className="rounded-2xl border bg-card p-5"><SkeletonRows rows={5} /></div>
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Users}
          title={q.data?.count ? t("No patients match") : t("No patients yet")}
          description={q.data?.count ? t("Try another search term.") : t("Scan a patient’s QR health card during their visit to open their records.")}
          action={!q.data?.count && <Link href="/doctor/scan-qr" className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-primary px-3.5 text-[13px] font-medium text-primary-foreground shadow-button"><QrCode className="h-4 w-4" />{' '}{t("Scan a card")}</Link>}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
          <table className="w-full min-w-[760px] text-[13.5px]">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">{t("Patient")}</th>
                <th className="px-5 py-3 font-medium">{t("Age / sex")}</th>
                <th className="px-5 py-3 font-medium">{t("Blood")}</th>
                <th className="px-5 py-3 font-medium">{t("District")}</th>
                <th className="px-5 py-3 font-medium">{t("Visits")}</th>
                <th className="px-5 py-3 font-medium">{t("Last visit")}</th>
                <th className="px-5 py-3 font-medium">{t("Access")}</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map((p) => {
                const a = accessLabel(p);
                return (
                  <tr key={p.patient_id} className="group cursor-pointer hover:bg-muted/40">
                    <td className="px-5 py-3">
                      <Link href={`/doctor/patients/${p.patient_id}`} className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-semibold text-accent-foreground">{initialsOf(p.name)}</span>
                        <span>
                          <span className="block font-semibold">{p.name}</span>
                          <span className="block font-mono text-xs text-muted-foreground">{p.unique_patient_id}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-5 py-3">{p.age} · {p.gender?.[0]?.toUpperCase()}</td>
                    <td className="px-5 py-3">{p.blood_group}</td>
                    <td className="px-5 py-3">{p.district || '—'}</td>
                    <td className="tabular px-5 py-3">{p.visit_count}</td>
                    <td className="px-5 py-3 text-muted-foreground">{fmt(p.last_visit_date)}</td>
                    <td className="px-5 py-3"><StatusPill tone={a.tone}><Clock className="h-3 w-3" />{a.label}</StatusPill></td>
                    <td className="pr-4">
                      <Link href={`/doctor/patients/${p.patient_id}`} aria-label={t("Open {name}", { name: p.name })}><ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default withAuth(MyPatientsPage, ['doctor']);
