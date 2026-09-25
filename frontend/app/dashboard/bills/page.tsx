'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, IndianRupee, ReceiptText, Store } from 'lucide-react';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import { EmptyState, ErrorState, PageHeader, SkeletonRows, Stat } from '@/components/ui/page';
import { PdfActions } from '@/components/ui/pdf-actions';
import { docPaths } from '@/lib/documents';
import { money, type Invoice } from '@/lib/billing';
import { cn } from '@/lib/utils';
import { t, intlLocale } from '@/lib/i18n';

const when = (iso: string) => new Date(iso).toLocaleString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

function BillsPage() {
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery<Invoice[]>({ queryKey: ['patient-invoices'], queryFn: () => api.dashboard.getInvoices() as Promise<Invoice[]> });
  const list = useMemo(() => q.data ?? [], [q.data]);

  const stats = useMemo(() => {
    const year = new Date().getFullYear();
    const thisYear = list.filter((i) => new Date(i.created_at).getFullYear() === year);
    return {
      spent: thisYear.reduce((n, i) => n + Number(i.total), 0),
      gst: thisYear.reduce((n, i) => n + Number(i.cgst) + Number(i.sgst), 0),
      pharmacies: new Set(list.map((i) => i.pharmacy.id)).size,
    };
  }, [list]);

  return (
    <div>
      <PageHeader title={t("Pharmacy bills")} description={t("Invoices from pharmacies that dispensed your prescriptions. Download any of them as a PDF.")} />

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label={t("Spent in {getFullYear}", { getFullYear: new Date().getFullYear() })} value={money(stats.spent)} icon={IndianRupee} loading={q.isLoading} />
        <Stat label={t("GST included")} value={money(stats.gst)} icon={ReceiptText} tone="info" loading={q.isLoading} />
        <Stat label={t("Pharmacies")} value={stats.pharmacies} icon={Store} tone="neutral" loading={q.isLoading} className="col-span-2 lg:col-span-1" />
      </section>

      {q.isLoading ? (
        <div className="rounded-2xl border bg-card p-5"><SkeletonRows rows={4} /></div>
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : !list.length ? (
        <EmptyState icon={ReceiptText} title={t("No bills yet")} description={t("When a pharmacy dispenses your prescription and issues an invoice, it appears here.")} />
      ) : (
        <ul className="space-y-3">
          {list.map((inv) => {
            const isOpen = open === inv.id;
            const gst = Number(inv.cgst) + Number(inv.sgst);
            return (
              <li key={inv.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-info/12 text-info"><ReceiptText className="h-[18px] w-[18px]" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14.5px] font-semibold">{inv.pharmacy.name}</div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-mono">{inv.invoice_number}</span> · {when(inv.created_at)} · {inv.prescription_number}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="tabular text-[16px] font-semibold">{money(inv.total)}</div>
                    <div className="text-[11.5px] text-muted-foreground">{t("Paid · {payment_method_display}", { payment_method_display: inv.payment_method_display })}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <PdfActions path={docPaths.invoice(inv.id)} fileName={`${inv.invoice_number}.pdf`} />
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : inv.id)}
                      aria-expanded={isOpen}
                      aria-label={isOpen ? t("Hide items") : t("Show items")}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-muted"
                    >
                      <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
                    </button>
                  </div>
                </div>
                {isOpen && (
                  <div className="border-t bg-muted/20 px-5 py-4">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[520px] text-[13px]">
                        <thead className="text-left text-xs text-muted-foreground">
                          <tr>
                            <th className="pb-2 font-medium">{t("Medicine")}</th>
                            <th className="pb-2 text-right font-medium">{t("Qty")}</th>
                            <th className="pb-2 text-right font-medium">{t("Rate")}</th>
                            <th className="pb-2 text-right font-medium">{t("GST")}</th>
                            <th className="pb-2 text-right font-medium">{t("Amount")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {inv.items.map((it) => (
                            <tr key={it.id}>
                              <td className="py-2"><div className="font-medium">{it.medicine_name}</div><div className="text-xs text-muted-foreground">{it.dosage}</div></td>
                              <td className="tabular py-2 text-right">{it.quantity_dispensed}</td>
                              <td className="tabular py-2 text-right text-muted-foreground">{money(it.unit_price)}</td>
                              <td className="tabular py-2 text-right text-muted-foreground">{it.gst_rate ? `${Number(it.gst_rate)}%` : '—'}</td>
                              <td className="tabular py-2 text-right font-medium">{money(it.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <dl className="tabular ml-auto mt-3 grid max-w-xs grid-cols-2 gap-y-1 text-[13px]">
                      <dt className="text-muted-foreground">{t("Items total")}</dt><dd className="text-right">{money(inv.subtotal)}</dd>
                      {Number(inv.discount) > 0 && (<><dt className="text-muted-foreground">{t("Discount")}</dt><dd className="text-right">− {money(inv.discount)}</dd></>)}
                      <dt className="text-muted-foreground">{t("Taxable value")}</dt><dd className="text-right">{money(inv.taxable_value)}</dd>
                      <dt className="text-muted-foreground">{t("CGST + SGST")}</dt><dd className="text-right">{money(gst)}</dd>
                      <dt className="font-semibold">{t("Total")}</dt><dd className="text-right font-semibold">{money(inv.total)}</dd>
                    </dl>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default withAuth(BillsPage, ['patient']);
