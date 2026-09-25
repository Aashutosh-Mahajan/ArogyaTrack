'use client';

import React, { useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Building2, Loader2, Package, PackagePlus, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import { EmptyState, ErrorState, PageHeader, Panel, Skeleton, SkeletonRows, Stat, StatusPill } from '@/components/ui/page';
import { Field, fieldClass } from '@/components/auth/FormKit';
import { AddInventoryModal } from '@/components/pharmacy/AddInventoryModal';
import { PharmacySetup, useMyPharmacy } from '@/components/pharmacy/PharmacySetup';
import { cn } from '@/lib/utils';
import { t, intlLocale } from '@/lib/i18n';

interface Item {
  id: string;
  medicine: string;
  medicine_name: string;
  medicine_generic: string;
  quantity_in_stock: number;
  low_stock_threshold: number;
  unit_price: string | null;
  batch_number: string;
  expiry_date: string | null;
  updated_at: string;
}

const FILTERS = [
  { k: 'all', get l() { return t("All lines"); } },
  { k: 'low', get l() { return t("Low stock"); } },
  { k: 'expiring', get l() { return t("Expiring in 90 days"); } },
  { k: 'expired', get l() { return t("Expired"); } },
] as const;

function expiryState(date: string | null) {
  if (!date) return null;
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label: t("Expired"), tone: 'danger' as const, days };
  if (days <= 90) return { label: t('{count} d left', { count: days }), tone: 'warning' as const, days };
  return { label: new Date(date).toLocaleDateString(intlLocale(), { month: 'short', year: 'numeric' }), tone: 'neutral' as const, days };
}

function EditItem({ item, onClose }: { item: Item; onClose: () => void }) {
  const qc = useQueryClient();
  const [receive, setReceive] = useState('');
  const [f, setF] = useState({ low_stock_threshold: String(item.low_stock_threshold), unit_price: item.unit_price ?? '', batch_number: item.batch_number, expiry_date: item.expiry_date ?? '' });
  const refresh = () => ['pharmacy-inventory', 'pharmacy-stats'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  const save = useMutation({
    mutationFn: async () => {
      if (receive) await api.pharmacy.receiveStock(item.id, Number(receive));
      await api.pharmacy.updateInventoryItem(item.id, {
        low_stock_threshold: Number(f.low_stock_threshold) || 0,
        unit_price: f.unit_price || null,
        batch_number: f.batch_number,
        expiry_date: f.expiry_date || null,
      });
    },
    onSuccess: () => {
      toast.success(t("Stock line updated"));
      refresh();
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => api.pharmacy.deleteInventoryItem(item.id),
    onSuccess: () => {
      toast.success(t("Stock line removed"));
      refresh();
      onClose();
    },
  });

  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-pop">
          <div className="flex items-start justify-between">
            <div>
              <Dialog.Title className="text-[17px] font-semibold">{item.medicine_name}</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-[13px] text-muted-foreground">{item.batch_number ? t("{quantity} units in stock · batch {batch}", { quantity: item.quantity_in_stock, batch: item.batch_number }) : t("{quantity} units in stock", { quantity: item.quantity_in_stock })}</Dialog.Description>
            </div>
            <Dialog.Close className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label={t("Close")}><X className="h-4 w-4" /></Dialog.Close>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="mt-5 space-y-4">
            <Field label={t("Units received")} hint={t("Added to the current quantity")}>{(id) => <input id={id} inputMode="numeric" value={receive} onChange={(e) => setReceive(e.target.value.replace(/\D/g, ''))} placeholder="0" className={fieldClass()} />}</Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t("Reorder at")}>{(id) => <input id={id} inputMode="numeric" value={f.low_stock_threshold} onChange={(e) => setF({ ...f, low_stock_threshold: e.target.value.replace(/\D/g, '') })} className={fieldClass()} />}</Field>
              <Field label={t("Unit price (₹)")}>{(id) => <input id={id} inputMode="decimal" value={f.unit_price} onChange={(e) => setF({ ...f, unit_price: e.target.value })} className={fieldClass()} />}</Field>
              <Field label={t("Batch")}>{(id) => <input id={id} value={f.batch_number} onChange={(e) => setF({ ...f, batch_number: e.target.value })} className={fieldClass()} />}</Field>
              <Field label={t("Expiry")}>{(id) => <input id={id} type="date" value={f.expiry_date} onChange={(e) => setF({ ...f, expiry_date: e.target.value })} className={fieldClass()} />}</Field>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button type="button" onClick={() => remove.mutate()} disabled={remove.isPending} className="inline-flex h-10 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-medium text-destructive hover:bg-destructive/5 disabled:opacity-60">
                <Trash2 className="h-4 w-4" />{' '}{t("Remove line")}</button>
              <button type="submit" disabled={save.isPending} className="ml-auto inline-flex h-10 items-center gap-2 rounded-[10px] bg-primary px-4 text-[13.5px] font-medium text-primary-foreground shadow-button disabled:opacity-60">
                {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{' '}{t("Save")}</button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function InventoryPage() {
  const pharmacy = useMyPharmacy();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [editPharmacy, setEditPharmacy] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['k']>('all');
  const [search, setSearch] = useState('');
  const inv = useQuery<Item[]>({ queryKey: ['pharmacy-inventory', false], queryFn: () => api.pharmacy.getInventory() as Promise<Item[]>, enabled: !!pharmacy.data });

  const all = useMemo(() => inv.data ?? [], [inv.data]);
  const list = useMemo(() => {
    const s = search.trim().toLowerCase();
    return all.filter((i) => {
      const ex = expiryState(i.expiry_date);
      const ok =
        filter === 'all' ||
        (filter === 'low' && i.quantity_in_stock <= i.low_stock_threshold) ||
        (filter === 'expiring' && ex && ex.days >= 0 && ex.days <= 90) ||
        (filter === 'expired' && ex && ex.days < 0);
      return ok && (!s || i.medicine_name.toLowerCase().includes(s) || (i.medicine_generic || '').toLowerCase().includes(s) || i.batch_number.toLowerCase().includes(s));
    });
  }, [all, filter, search]);

  const value = all.reduce((sum, i) => sum + (Number(i.unit_price) || 0) * i.quantity_in_stock, 0);
  const low = all.filter((i) => i.quantity_in_stock <= i.low_stock_threshold).length;
  const expiring = all.filter((i) => { const e = expiryState(i.expiry_date); return e && e.days >= 0 && e.days <= 90; }).length;

  if (pharmacy.isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (!pharmacy.data) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title={t("Inventory")} />
        <Panel><PharmacySetup /></Panel>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t("Inventory")}
        description={pharmacy.data.name}
        actions={
          <>
            <button onClick={() => setEditPharmacy(true)} className="inline-flex h-10 items-center gap-2 rounded-[10px] border bg-card px-3.5 text-[13.5px] font-medium shadow-sm hover:bg-muted"><Building2 className="h-4 w-4 text-muted-foreground" />{' '}{t("Pharmacy details")}</button>
            <button onClick={() => setAdding(true)} className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-primary px-4 text-[13.5px] font-medium text-primary-foreground shadow-button"><Plus className="h-4 w-4" />{' '}{t("Add stock")}</button>
          </>
        }
      />

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("Stock lines")} value={all.length} icon={Package} loading={inv.isLoading} />
        <Stat label={t("Low stock")} value={low} icon={PackagePlus} tone={low ? 'danger' : 'success'} loading={inv.isLoading} />
        <Stat label={t("Expiring in 90 days")} value={expiring} icon={Package} tone={expiring ? 'warning' : 'success'} loading={inv.isLoading} />
        <Stat label={t("Stock value")} value={`₹${Math.round(value).toLocaleString(intlLocale())}`} icon={Package} tone="info" loading={inv.isLoading} hint={t("Where a unit price is set")} />
      </section>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex flex-wrap rounded-[10px] border bg-card p-1 shadow-sm">
          {FILTERS.map((f) => (
            <button key={f.k} onClick={() => setFilter(f.k)} className={cn('rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors', filter === f.k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>{f.l}</button>
          ))}
        </div>
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("Medicine or batch")} className={`${fieldClass()} h-10 pl-10`} aria-label={t("Search inventory")} />
        </div>
      </div>

      {inv.isLoading ? (
        <div className="rounded-2xl border bg-card p-5"><SkeletonRows rows={6} /></div>
      ) : inv.isError ? (
        <ErrorState onRetry={() => inv.refetch()} />
      ) : !list.length ? (
        <EmptyState icon={Package} title={all.length ? t("Nothing matches") : t("No stock yet")} description={all.length ? undefined : t("Add the medicines you carry so dispensing can check and deduct stock.")} action={!all.length && <button onClick={() => setAdding(true)} className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-primary px-3.5 text-[13px] font-medium text-primary-foreground shadow-button"><Plus className="h-4 w-4" />{' '}{t("Add stock")}</button>} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
          <table className="w-full min-w-[760px] text-[13.5px]">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">{t("Medicine")}</th>
                <th className="px-5 py-3 font-medium">{t("Batch")}</th>
                <th className="px-5 py-3 font-medium">{t("Expiry")}</th>
                <th className="px-5 py-3 text-right font-medium">{t("Price")}</th>
                <th className="px-5 py-3 text-right font-medium">{t("In stock")}</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map((i) => {
                const ex = expiryState(i.expiry_date);
                const isLow = i.quantity_in_stock <= i.low_stock_threshold;
                return (
                  <tr key={i.id} className="hover:bg-muted/30">
                    <td className="px-5 py-3"><div className="font-medium">{i.medicine_name}</div><div className="text-xs text-muted-foreground">{i.medicine_generic}</div></td>
                    <td className="px-5 py-3 font-mono text-[12.5px]">{i.batch_number || '—'}</td>
                    <td className="px-5 py-3">{ex ? <StatusPill tone={ex.tone} dot={ex.tone !== 'neutral'}>{ex.label}</StatusPill> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="tabular px-5 py-3 text-right">{i.unit_price ? `₹${Number(i.unit_price).toFixed(2)}` : '—'}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={cn('tabular text-[15px] font-semibold', isLow && 'text-destructive')}>{i.quantity_in_stock}</span>
                      {isLow && <div className="text-[11px] text-destructive">{t("reorder at {low_stock_threshold}", { low_stock_threshold: i.low_stock_threshold })}</div>}
                    </td>
                    <td className="pr-4 text-right">
                      <button onClick={() => setEditing(i)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={t("Edit {medicine_name}", { medicine_name: i.medicine_name })}><Pencil className="h-4 w-4" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AddInventoryModal isOpen={adding} onClose={() => setAdding(false)} />
      {editing && <EditItem item={editing} onClose={() => setEditing(null)} />}
      <Dialog.Root open={editPharmacy} onOpenChange={setEditPharmacy}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-card p-6 shadow-pop">
            <div className="mb-4 flex items-start justify-between">
              <Dialog.Title className="text-[17px] font-semibold">{t("Pharmacy details")}</Dialog.Title>
              <Dialog.Close className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label={t("Close")}><X className="h-4 w-4" /></Dialog.Close>
            </div>
            <PharmacySetup initial={pharmacy.data} onSaved={() => setEditPharmacy(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

export default withAuth(InventoryPage, ['pharmacist']);
