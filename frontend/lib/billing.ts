export interface InvoiceItem {
  id: string;
  medicine_name: string;
  generic_name?: string;
  dosage: string;
  quantity_dispensed: number;
  unit_price: string | null;
  amount: string | null;
  hsn_code?: string;
  gst_rate?: string | null;
  taxable_value?: string | null;
  tax_amount?: string | null;
  dispensed_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  created_at: string;
  pharmacy: { id: string; name: string; license_number: string; address: string; district?: string; phone: string; email: string; gstin?: string };
  pharmacist_name: string;
  prescription: string;
  prescription_number: string;
  doctor_name: string;
  patient_name: string;
  patient_uid: string;
  patient_phone?: string;
  items: InvoiceItem[];
  subtotal: string;
  discount: string;
  total: string;
  taxable_value: string;
  cgst: string;
  sgst: string;
  payment_method: 'cash' | 'upi' | 'card' | 'other';
  payment_method_display: string;
}

export interface Billing {
  unbilled_items: InvoiceItem[];
  unbilled_subtotal: string;
  unpriced_items: number;
  invoices: Invoice[];
}

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
] as const;

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });

/** ₹1,234.50 — or an em dash when no price was recorded. */
export function money(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  return Number.isFinite(n) ? inr.format(n) : '—';
}

/** Cost of `quantity` units taken earliest-expiry first, as dispensing does. Null if unpriced. */
export function estimateCost(
  batches: { quantity_in_stock: number; unit_price: string | null; expiry_date: string | null }[],
  quantity: number
): number | null {
  const today = new Date().toISOString().slice(0, 10);
  const usable = batches
    .filter((b) => b.quantity_in_stock > 0 && (!b.expiry_date || b.expiry_date >= today))
    .sort((a, b) => (a.expiry_date ?? '9999').localeCompare(b.expiry_date ?? '9999'));
  let left = quantity;
  let cost = 0;
  let priced = false;
  for (const b of usable) {
    if (left <= 0) break;
    const take = Math.min(b.quantity_in_stock, left);
    if (b.unit_price !== null && b.unit_price !== '') {
      cost += take * Number(b.unit_price);
      priced = true;
    }
    left -= take;
  }
  return priced ? cost : null;
}
