'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { IndianRupee, ReceiptText, Search } from 'lucide-react';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import { EmptyState, ErrorState, PageHeader, SkeletonRows, Stat } from '@/components/ui/page';
import { fieldClass } from '@/components/auth/FormKit';
import { PdfActions } from '@/components/ui/pdf-actions';
import { docPaths } from '@/lib/documents';
import { money, type Invoice } from '@/lib/billing';
import { t as tr, intlLocale, tn } from '@/lib/i18n';

function InvoicesPage() {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const q = useQuery<Invoice[]>({
    queryKey: ['pharmacy-invoices', debounced],
    queryFn: () => api.pharmacy.listInvoices(debounced ? { search: debounced } : undefined) as Promise<Invoice[]>,
  });
  const list = useMemo(() => q.data ?? [], [q.data]);

  const totals = useMemo(() => {
    const today = new Date().toDateString();
    const todays = list.filter((i) => new Date(i.created_at).toDateString() === today);
    return {
      today: todays.reduce((n, i) => n + Number(i.total), 0),
      todayCount: todays.length,
      all: list.reduce((n, i) => n + Number(i.total), 0),
    };
  }, [list]);

  return (
    <div>
      <PageHeader title={tr("Invoices")} description={tr("Bills issued at your counter. Generate one from the dispensing screen after handing over medicines.")} />

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label={tr("Billed today")} value={money(totals.today)} hint={tn(totals.todayCount, '1 invoice', '{count} invoices')} icon={IndianRupee} loading={q.isLoading} />
        <Stat label={debounced ? tr("Matching invoices") : tr("Invoices")} value={list.length} icon={ReceiptText} tone="info" loading={q.isLoading} />
        <Stat label={debounced ? tr("Total of matches") : tr("Total billed")} value={money(totals.all)} icon={IndianRupee} tone="success" loading={q.isLoading} className="col-span-2 lg:col-span-1" />
      </section>

      <div className="relative mb-4 sm:w-80">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("Invoice number, patient or patient ID")} className={`${fieldClass()} h-10 pl-10`} aria-label={tr("Search invoices")} />
      </div>

      {q.isLoading ? (
        <div className="rounded-2xl border bg-card p-5"><SkeletonRows rows={6} /></div>
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : !list.length ? (
        <EmptyState
          icon={ReceiptText}
          title={debounced ? tr("No invoices match") : tr("No invoices yet")}
          description={debounced ? undefined : tr("Dispense a prescription, then use Generate invoice in its Bill section.")}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
          <table className="w-full min-w-[760px] text-[13.5px]">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">{tr("Invoice")}</th>
                <th className="px-5 py-3 font-medium">{tr("Patient")}</th>
                <th className="px-5 py-3 font-medium">{tr("Prescription")}</th>
                <th className="px-5 py-3 text-right font-medium">{tr("Items")}</th>
                <th className="px-5 py-3 font-medium">{tr("Payment")}</th>
                <th className="px-5 py-3 text-right font-medium">{tr("Total")}</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map((inv) => (
                <tr key={inv.id} className="hover:bg-muted/30">
                  <td className="px-5 py-3">
                    <div className="font-mono font-semibold">{inv.invoice_number}</div>
                    <div className="text-xs text-muted-foreground">{new Date(inv.created_at).toLocaleString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
                  </td>
                  <td className="px-5 py-3"><div>{inv.patient_name}</div><div className="font-mono text-xs text-muted-foreground">{inv.patient_uid}</div></td>
                  <td className="px-5 py-3"><div className="font-mono text-[13px]">{inv.prescription_number}</div><div className="text-xs text-muted-foreground">{inv.doctor_name}</div></td>
                  <td className="tabular px-5 py-3 text-right">{inv.items.length}</td>
                  <td className="px-5 py-3 text-muted-foreground">{tr(inv.payment_method_display)}</td>
                  <td className="tabular px-5 py-3 text-right">
                    <div className="font-semibold">{money(inv.total)}</div>
                    <div className="text-xs text-muted-foreground">{Number(inv.discount) > 0 ? tr("incl. GST {gst} · {discount} off", { gst: money(Number(inv.cgst) + Number(inv.sgst)), discount: money(inv.discount) }) : tr("incl. GST {gst}", { gst: money(Number(inv.cgst) + Number(inv.sgst)) })}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <PdfActions path={docPaths.invoice(inv.id)} fileName={`${inv.invoice_number}.pdf`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default withAuth(InvoicesPage, ['pharmacist']);
