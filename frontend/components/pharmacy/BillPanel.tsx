'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AlertTriangle, Loader2, ReceiptText } from 'lucide-react';
import { api } from '@/lib/api';
import { extractError } from '@/components/auth/SignInForm';
import { PAYMENT_METHODS, money, type Billing, type Invoice } from '@/lib/billing';
import { docPaths } from '@/lib/documents';
import { PdfActions } from '@/components/ui/pdf-actions';
import { cn } from '@/lib/utils';
import { t, intlLocale, tn } from '@/lib/i18n';

/** Bill for what this pharmacy dispensed on one prescription, and its past invoices. */
export function BillPanel({ prescriptionId }: { prescriptionId: string }) {
  const qc = useQueryClient();
  const [discount, setDiscount] = useState('');
  const [method, setMethod] = useState<string>('cash');
  const [error, setError] = useState<string | null>(null);

  const q = useQuery<Billing>({ queryKey: ['pharmacy-billing', prescriptionId], queryFn: () => api.pharmacy.getBilling(prescriptionId) as Promise<Billing> });

  const create = useMutation({
    mutationFn: () =>
      api.pharmacy.createInvoice({ prescription_id: prescriptionId, payment_method: method, ...(discount ? { discount } : {}) }) as Promise<Invoice>,
    onSuccess: (inv) => {
      toast.success(t("Invoice {invoice_number} created", { invoice_number: inv.invoice_number }));
      setDiscount('');
      setError(null);
      ['pharmacy-billing', 'pharmacy-invoices', 'pharmacy-stats', 'pharmacy-history'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: (e) => setError(extractError(e, t("Could not create the invoice."))),
  });

  const b = q.data;
  if (!b || (!b.unbilled_items.length && !b.invoices.length)) return null;

  const subtotal = Number(b.unbilled_subtotal);
  const disc = Math.min(Number(discount) || 0, subtotal);
  const discountTooHigh = (Number(discount) || 0) > subtotal;

  return (
    <section className="border-t bg-muted/20 px-5 py-4">
      <div className="mb-3 flex items-center gap-2 text-[13.5px] font-semibold">
        <ReceiptText className="h-4 w-4 text-primary" />{' '}{t("Bill")}</div>

      {b.unbilled_items.length > 0 && (
        <div className="rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px] text-[13px]">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-3 py-2 font-medium">{t("Medicine")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("Qty")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("Unit price")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("Amount")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {b.unbilled_items.map((it) => (
                  <tr key={it.id}>
                    <td className="px-3 py-2 font-medium">{it.medicine_name}</td>
                    <td className="tabular px-3 py-2 text-right">{it.quantity_dispensed}</td>
                    <td className="tabular px-3 py-2 text-right text-muted-foreground">{money(it.unit_price)}</td>
                    <td className="tabular px-3 py-2 text-right font-medium">{money(it.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {b.unpriced_items > 0 && (
            <p className="flex items-start gap-2 border-t px-3 py-2 text-xs text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t("{value} from stock with no unit price and will be billed at ₹0. Set prices in Inventory before dispensing.", { value: b.unpriced_items === 1 ? 'One item came' : `${b.unpriced_items} items came` })}</p>
          )}

          <div className="grid gap-4 border-t p-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs font-medium text-muted-foreground">{t("Discount (₹)")}<input
                  inputMode="decimal"
                  value={discount}
                  onChange={(e) => { setDiscount(e.target.value.replace(/[^\d.]/g, '')); setError(null); }}
                  placeholder="0.00"
                  className={cn('tabular mt-1 block h-9 w-28 rounded-lg border bg-card px-2.5 text-[13px] text-foreground', discountTooHigh && 'border-destructive')}
                  aria-invalid={discountTooHigh}
                />
              </label>
              <div>
                <div className="text-xs font-medium text-muted-foreground">{t("Payment")}</div>
                <div className="mt-1 inline-flex rounded-lg border bg-card p-0.5" role="radiogroup" aria-label={t("Payment method")}>
                  {PAYMENT_METHODS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      role="radio"
                      aria-checked={method === p.value}
                      onClick={() => setMethod(p.value)}
                      className={cn('rounded-md px-2.5 py-1 text-[12.5px] font-medium', method === p.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="tabular text-xs text-muted-foreground">{disc > 0 ? t("Subtotal {subtotal} · Discount − {discount}", { subtotal: money(subtotal), discount: money(disc) }) : t("Subtotal {subtotal}", { subtotal: money(subtotal) })}
              </div>
              <div className="tabular text-[20px] font-semibold tracking-[-0.02em]">{money(subtotal - disc)}</div>
              <div className="text-[11px] text-muted-foreground">{t("Prices include GST; the invoice shows the CGST/SGST split.")}</div>
              <button
                type="button"
                onClick={() => create.mutate()}
                disabled={create.isPending || discountTooHigh}
                className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-medium text-primary-foreground shadow-button disabled:opacity-50"
              >
                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ReceiptText className="h-4 w-4" />}{' '}{t("Generate invoice")}</button>
            </div>
          </div>
          {(error || discountTooHigh) && (
            <p role="alert" className="border-t px-3 py-2 text-xs font-medium text-destructive">{discountTooHigh ? t("Discount cannot be more than the bill.") : error}</p>
          )}
        </div>
      )}

      {b.invoices.length > 0 && (
        <ul className={cn('space-y-2', b.unbilled_items.length > 0 && 'mt-3')}>
          {b.invoices.map((inv) => (
            <li key={inv.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-[13px]">
              <span className="font-mono font-semibold">{inv.invoice_number}</span>
              <span className="text-muted-foreground">
                {tn(inv.items.length, '{when} · 1 item · {method}', '{when} · {count} items · {method}', { when: new Date(inv.created_at).toLocaleString(intlLocale(), { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }), method: t(inv.payment_method_display) })}
              </span>
              <span className="tabular ml-auto text-right">
                <span className="block font-semibold">{money(inv.total)}</span>
                <span className="block text-[11px] text-muted-foreground">{t("incl. GST {money}", { money: money(Number(inv.cgst) + Number(inv.sgst)) })}</span>
              </span>
              <PdfActions path={docPaths.invoice(inv.id)} fileName={`${inv.invoice_number}.pdf`} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
