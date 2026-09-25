'use client';

import React, { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Loader2, Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Field, fieldClass, flattenErrors } from '@/components/auth/FormKit';
import type { Medicine } from '@/types';
import { t as tr } from '@/lib/i18n';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/** Add a stock line (medicine + batch) from the shared medicine catalogue. */
export function AddInventoryModal({ isOpen, onClose, onSuccess }: Props) {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [medicine, setMedicine] = useState<Medicine | null>(null);
  const [f, setF] = useState({ quantity_in_stock: '', low_stock_threshold: '10', unit_price: '', batch_number: '', expiry_date: '' });
  const [err, setErr] = useState<Record<string, string>>({});

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const results = useQuery<Medicine[]>({
    queryKey: ['medicine-search', debounced],
    queryFn: () => api.prescriptions.getMedicines({ search: debounced }),
    enabled: isOpen && !medicine,
  });

  const reset = () => {
    setQuery('');
    setMedicine(null);
    setF({ quantity_in_stock: '', low_stock_threshold: '10', unit_price: '', batch_number: '', expiry_date: '' });
    setErr({});
  };

  const add = useMutation({
    mutationFn: () =>
      api.pharmacy.addInventory({
        medicine: medicine!.id,
        quantity_in_stock: Number(f.quantity_in_stock),
        low_stock_threshold: Number(f.low_stock_threshold) || 0,
        ...(f.unit_price ? { unit_price: f.unit_price } : {}),
        batch_number: f.batch_number.trim(),
        ...(f.expiry_date ? { expiry_date: f.expiry_date } : {}),
      }),
    onSuccess: () => {
      toast.success(tr("{name} added to stock", { name: medicine!.name }));
      qc.invalidateQueries({ queryKey: ['pharmacy-inventory'] });
      qc.invalidateQueries({ queryKey: ['pharmacy-stats'] });
      reset();
      onSuccess?.();
      onClose();
    },
    onError: (e: any) => setErr(flattenErrors(e?.response?.data)),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!medicine) er.medicine = tr("Choose a medicine");
    if (!(Number(f.quantity_in_stock) >= 0) || f.quantity_in_stock === '') er.quantity_in_stock = tr("Enter the quantity received");
    if (f.expiry_date && f.expiry_date < new Date().toISOString().slice(0, 10)) er.expiry_date = tr("This batch has already expired");
    setErr(er);
    if (!Object.keys(er).length) add.mutate();
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <Dialog.Root open={isOpen} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-card p-6 shadow-pop">
          <div className="flex items-start justify-between">
            <div>
              <Dialog.Title className="text-[17px] font-semibold">{tr("Add stock")}</Dialog.Title>
              <Dialog.Description className="mt-1 text-[13.5px] text-muted-foreground">{tr("Each batch is a separate line so expiry dates stay accurate.")}</Dialog.Description>
            </div>
            <Dialog.Close className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label={tr("Close")}><X className="h-4 w-4" /></Dialog.Close>
          </div>
          <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
            <div className="space-y-1.5">
              <div className="text-[13px] font-medium">{tr("Medicine")}<span className="ml-0.5 text-destructive">*</span></div>
              {medicine ? (
                <div className="flex items-center gap-3 rounded-[10px] border border-primary/30 bg-primary/5 px-3.5 py-2.5">
                  <div className="min-w-0 flex-1"><div className="text-[14px] font-medium">{medicine.name}</div><div className="text-xs text-muted-foreground">{medicine.generic_name} · {medicine.drug_class}</div></div>
                  <button type="button" onClick={() => setMedicine(null)} className="text-[12.5px] font-medium text-primary">{tr("Change")}</button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr("Search the catalogue")} className={`${fieldClass(!!err.medicine)} pl-10`} autoFocus aria-label={tr("Search medicine")} />
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-[10px] border">
                    {results.isLoading ? (
                      <div className="flex items-center gap-2 px-3 py-2.5 text-[13px] text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />{' '}{tr("Loading…")}</div>
                    ) : results.data?.length ? (
                      results.data.map((m) => (
                        <button key={m.id} type="button" onClick={() => { setMedicine(m); setErr({ ...err, medicine: '' }); }} className="flex w-full flex-col items-start border-b px-3 py-2 text-left last:border-0 hover:bg-muted">
                          <span className="text-[13.5px] font-medium">{m.name}</span>
                          <span className="text-xs text-muted-foreground">{m.generic_name} · {m.drug_class}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2.5 text-[13px] text-muted-foreground">{tr("No medicines found.")}</div>
                    )}
                  </div>
                  {err.medicine && <p className="text-xs font-medium text-destructive">{err.medicine}</p>}
                </>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label={tr("Quantity")} required error={err.quantity_in_stock}>{(id) => <input id={id} inputMode="numeric" value={f.quantity_in_stock} onChange={set('quantity_in_stock')} className={fieldClass(!!err.quantity_in_stock)} />}</Field>
              <Field label={tr("Reorder at")} error={err.low_stock_threshold} hint={tr("Flag as low at or below")}>{(id) => <input id={id} inputMode="numeric" value={f.low_stock_threshold} onChange={set('low_stock_threshold')} className={fieldClass()} />}</Field>
              <Field label={tr("Batch number")} error={err.batch_number}>{(id) => <input id={id} value={f.batch_number} onChange={set('batch_number')} className={fieldClass()} />}</Field>
              <Field label={tr("Expiry date")} error={err.expiry_date}>{(id) => <input id={id} type="date" value={f.expiry_date} onChange={set('expiry_date')} className={fieldClass(!!err.expiry_date)} />}</Field>
              <Field label={tr("Unit price (₹)")} error={err.unit_price}>{(id) => <input id={id} inputMode="decimal" value={f.unit_price} onChange={set('unit_price')} className={fieldClass()} />}</Field>
            </div>
            {err.non_field_errors && <p className="text-sm text-destructive">{err.non_field_errors}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Dialog.Close type="button" className="h-10 rounded-[10px] border px-4 text-[13.5px] font-medium hover:bg-muted">{tr("Cancel")}</Dialog.Close>
              <button type="submit" disabled={add.isPending} className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-primary px-4 text-[13.5px] font-medium text-primary-foreground shadow-button disabled:opacity-60">
                {add.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{' '}{tr("Add to stock")}</button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default AddInventoryModal;
