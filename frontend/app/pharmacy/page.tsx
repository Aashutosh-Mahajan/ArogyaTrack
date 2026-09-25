'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, ArrowRight, ClipboardList, History, IndianRupee, Package, Pill, ScanLine, TrendingUp } from 'lucide-react';
import { money } from '@/lib/billing';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { EmptyState, Panel, Skeleton, SkeletonRows, Stat, StatusPill } from '@/components/ui/page';
import { C, ChartTooltip, axisProps, gridProps } from '@/components/charts/chartTheme';
import { PharmacySetup, useMyPharmacy } from '@/components/pharmacy/PharmacySetup';
import { t, intlLocale, tn } from '@/lib/i18n';

interface Stats {
  total_dispensed: number;
  today_dispensed: number;
  low_stock_count: number;
  pending_prescriptions: number;
  billed_today: string;
  invoices_today: number;
  unbilled_amount: string;
  trend: { name: string; date: string; dispensed: number }[];
}

function PharmacyDashboard() {
  const user = useAuthStore((s) => s.user);
  const pharmacy = useMyPharmacy();
  const stats = useQuery<Stats>({ queryKey: ['pharmacy-stats'], queryFn: () => api.pharmacy.getDashboardStats() as Promise<Stats>, enabled: !!pharmacy.data });
  const history = useQuery<any[]>({ queryKey: ['pharmacy-history'], queryFn: () => api.pharmacy.getDispensingRecords() as Promise<any[]>, enabled: !!pharmacy.data });
  const lowStock = useQuery<any[]>({ queryKey: ['pharmacy-inventory', true], queryFn: () => api.pharmacy.getInventory({ low_stock: true }) as Promise<any[]>, enabled: !!pharmacy.data });

  const s = stats.data;

  if (pharmacy.isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;

  if (!pharmacy.data) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-[28px] font-semibold tracking-[-0.035em]">{user?.first_name ? t("Welcome, {name}", { name: user.first_name }) : t("Welcome")}</h1>
        <Panel><PharmacySetup /></Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[13px] text-muted-foreground">{pharmacy.data.name}{pharmacy.data.district ? ` · ${pharmacy.data.district}` : ''}</div>
          <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.035em] md:text-[32px]">{t("Dispensing counter")}</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/pharmacy/inventory" className="inline-flex h-10 items-center gap-2 rounded-[10px] border bg-card px-3.5 text-[13.5px] font-medium shadow-sm hover:bg-muted"><Package className="h-4 w-4 text-muted-foreground" />{' '}{t("Inventory")}</Link>
          <Link href="/pharmacy/scan" className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-primary px-3.5 text-[13.5px] font-medium text-primary-foreground shadow-button"><ScanLine className="h-4 w-4" />{' '}{t("Scan prescription")}</Link>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("Dispensed today")} value={s?.today_dispensed ?? 0} icon={Pill} loading={stats.isLoading} />
        <Stat label={t("Billed today")} value={money(s?.billed_today ?? 0)} hint={Number(s?.unbilled_amount) > 0 ? t("{money} dispensed, not billed", { money: money(s?.unbilled_amount) }) : tn(s?.invoices_today ?? 0, '1 invoice', '{count} invoices')} icon={IndianRupee} tone="info" loading={stats.isLoading} href="/pharmacy/invoices" />
        <Stat label={t("Prescriptions awaiting items")} value={s?.pending_prescriptions ?? 0} icon={ClipboardList} tone="warning" loading={stats.isLoading} />
        <Stat label={t("Low-stock lines")} value={s?.low_stock_count ?? 0} icon={AlertTriangle} tone={s?.low_stock_count ? 'danger' : 'success'} loading={stats.isLoading} href="/pharmacy/inventory" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel title={t("Items dispensed")} description={t("Last 7 days")} icon={TrendingUp}>
          {stats.isLoading ? (
            <Skeleton className="h-[220px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={s?.trend ?? []} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="name" {...axisProps} />
                <YAxis {...axisProps} allowDecimals={false} width={32} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
                <Bar dataKey="dispensed" name={t("Dispensed")} fill={C.primary} radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title={t("Low stock")} icon={AlertTriangle} actions={<Link href="/pharmacy/inventory" className="text-[13px] font-medium text-primary">{t("Restock")}</Link>}>
          {lowStock.isLoading ? (
            <SkeletonRows rows={3} />
          ) : lowStock.data?.length ? (
            <ul className="divide-y text-[13.5px]">
              {lowStock.data.slice(0, 6).map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="truncate font-medium">{i.medicine_name}</span>
                  <StatusPill tone={i.quantity_in_stock === 0 ? 'danger' : 'warning'}>{t("{quantity_in_stock} left", { quantity_in_stock: i.quantity_in_stock })}</StatusPill>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13.5px] text-muted-foreground">{t("Every line is above its reorder threshold.")}</p>
          )}
        </Panel>
      </section>

      <Panel title={t("Recent dispensing")} icon={History} actions={<Link href="/pharmacy/history" className="inline-flex items-center gap-1 text-[13px] font-medium text-primary">{t("Full history")}{' '}<ArrowRight className="h-3.5 w-3.5" /></Link>}>
        {history.isLoading ? (
          <SkeletonRows rows={4} />
        ) : history.data?.length ? (
          <ul className="divide-y text-[13.5px]">
            {history.data.slice(0, 8).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 first:pt-0 last:pb-0">
                <span className="font-medium">{r.medicine_name}</span>
                <span className="text-muted-foreground">{r.patient_name} · {r.prescription_number}</span>
                <StatusPill tone={r.status === 'dispensed' ? 'success' : r.status === 'unavailable' ? 'danger' : 'info'} className="ml-auto">{r.status === 'patient_has' ? t("Had it") : r.status}</StatusPill>
                <span className="w-32 text-right text-xs text-muted-foreground">{new Date(r.dispensed_at).toLocaleString(intlLocale(), { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState compact icon={Pill} title={t("Nothing dispensed yet")} description={t("Scan a prescription or a patient's health card to start.")} />
        )}
      </Panel>
    </div>
  );
}

export default withAuth(PharmacyDashboard, ['pharmacist']);
