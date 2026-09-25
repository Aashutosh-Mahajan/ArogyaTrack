'use client';

import React, { useCallback, useId, useRef, useState } from 'react';
import { Check, Eye, EyeOff, FileCheck2, Plus, UploadCloud, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';

export const fieldClass = (invalid?: boolean) =>
  cn(
    'flex h-11 w-full rounded-[10px] border bg-card px-3.5 text-sm text-foreground shadow-[0_1px_2px_hsl(var(--shadow-color)/0.04)] transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 hover:border-foreground/25 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 disabled:opacity-60',
    invalid ? 'border-destructive' : 'border-input'
  );

/* ─── Field wrapper ───────────────────────────────────────────────── */
interface FieldProps {
  label: React.ReactNode;
  required?: boolean;
  error?: string;
  hint?: React.ReactNode;
  className?: string;
  children: (id: string) => React.ReactNode;
}

export function Field({ label, required, error, hint, className, children }: FieldProps) {
  const id = useId();
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-[13px] font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children(id)}
      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/* ─── Stepper ─────────────────────────────────────────────────────── */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="mb-8 flex items-center gap-2" aria-label={t("Progress")}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-1 flex-col gap-2">
            <div className={cn('h-1 rounded-full transition-colors duration-500', done || active ? 'bg-primary' : 'bg-border')} />
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold',
                  done ? 'bg-primary text-primary-foreground' : active ? 'border border-primary text-primary' : 'border text-muted-foreground'
                )}
              >
                {done ? <Check className="h-2.5 w-2.5" strokeWidth={3.5} /> : i + 1}
              </span>
              <span className={cn('truncate text-[12px] font-medium', active ? 'text-foreground' : 'text-muted-foreground')}>{t(label)}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ─── Password with strength meter ────────────────────────────────── */
export function passwordScore(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^a-zA-Z0-9]/.test(p)) s++;
  return s;
}

export function PasswordInput({
  id,
  value,
  onChange,
  invalid,
  name = 'password',
  autoComplete = 'new-password',
  showMeter = true,
}: {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  invalid?: boolean;
  name?: string;
  autoComplete?: string;
  showMeter?: boolean;
}) {
  const [show, setShow] = useState(false);
  const score = passwordScore(value);
  const label = score <= 1 ? t("Weak") : score === 2 ? t("Fair") : score === 3 ? t("Good") : t("Strong");
  const color = score <= 1 ? 'bg-destructive' : score === 2 ? 'bg-warning' : 'bg-success';
  return (
    <div>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          aria-invalid={invalid}
          className={cn(fieldClass(invalid), 'pr-10')}
          placeholder={t("At least 8 characters")}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={show ? t("Hide password") : t("Show password")}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {showMeter && value && (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex flex-1 gap-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={cn('h-1 flex-1 rounded-full transition-colors', i < Math.max(score, 1) ? color : 'bg-border')} />
            ))}
          </div>
          <span className="w-12 text-right text-[11px] font-medium text-muted-foreground">{label}</span>
        </div>
      )}
    </div>
  );
}

/* ─── Chip multi-select with optional custom entries ──────────────── */
export function ChipToggle({
  options,
  selected,
  onChange,
  allowCustom,
  customPlaceholder = t('Add another…'),
  exclusive,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  allowCustom?: boolean;
  customPlaceholder?: string;
  /** Option that clears all others when chosen (e.g. "None"). */
  exclusive?: string;
}) {
  const [custom, setCustom] = useState('');
  const toggle = (opt: string) => {
    const on = selected.includes(opt);
    if (exclusive && opt === exclusive) return onChange(on ? [] : [exclusive]);
    const base = exclusive ? selected.filter((s) => s !== exclusive) : selected;
    onChange(on ? base.filter((s) => s !== opt) : [...base, opt]);
  };
  const addCustom = () => {
    const v = custom.trim();
    if (!v) return;
    const base = exclusive ? selected.filter((s) => s !== exclusive) : selected;
    if (!base.some((s) => s.toLowerCase() === v.toLowerCase())) onChange([...base, v]);
    setCustom('');
  };
  const extras = selected.filter((s) => !options.includes(s));

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {[...options, ...extras].map((opt) => {
          const on = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              aria-pressed={on}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors',
                on ? 'border-primary bg-primary/10 text-primary' : 'bg-card text-muted-foreground hover:border-foreground/25 hover:text-foreground'
              )}
            >
              {on && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
              {t(opt)}
            </button>
          );
        })}
      </div>
      {allowCustom && (
        <div className="mt-3 flex gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder={customPlaceholder}
            className={cn(fieldClass(), 'h-10')}
          />
          <button
            type="button"
            onClick={addCustom}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={t("Add")}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── File drop zone ──────────────────────────────────────────────── */
const MAX_MB = 5;
const ACCEPTED = ['image/jpeg', 'image/png', 'application/pdf'];

export function FileDrop({
  label,
  required,
  file,
  onFile,
  error,
  hint = t('JPG, PNG or PDF · up to {size} MB', { size: MAX_MB }),
}: {
  label: string;
  required?: boolean;
  file: File | null;
  onFile: (f: File | null) => void;
  error?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const accept = useCallback(
    (f?: File | null) => {
      if (!f) return;
      if (!ACCEPTED.includes(f.type)) return setLocalError(t('Use a JPG, PNG or PDF file.'));
      if (f.size > MAX_MB * 1024 * 1024) return setLocalError(t('That file is over {size} MB.', { size: MAX_MB }));
      setLocalError(null);
      onFile(f);
    },
    [onFile]
  );

  const shownError = localError || error;

  return (
    <div className="space-y-1.5">
      <div className="text-[13px] font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </div>
      <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={(e) => accept(e.target.files?.[0])} />
      {file ? (
        <div className="flex items-center gap-3 rounded-[10px] border border-primary/30 bg-primary/5 px-3.5 py-3">
          <FileCheck2 className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-medium text-foreground">{file.name}</div>
            <div className="text-[11.5px] text-muted-foreground">{t("{value} KB", { value: (file.size / 1024).toFixed(0) })}</div>
          </div>
          <button
            type="button"
            onClick={() => {
              onFile(null);
              if (inputRef.current) inputRef.current.value = '';
            }}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={t("Remove file")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            accept(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            'flex w-full items-center gap-3 rounded-[10px] border border-dashed px-4 py-4 text-left transition-colors',
            dragging ? 'border-primary bg-primary/5' : shownError ? 'border-destructive bg-destructive/5' : 'bg-muted/30 hover:border-foreground/30 hover:bg-muted/60'
          )}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-card text-muted-foreground">
            <UploadCloud className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-[13.5px] font-medium text-foreground">{t("Drop a file or")}{' '}<span className="text-primary">{t("browse")}</span>
            </span>
            <span className="block text-[12px] text-muted-foreground">{hint}</span>
          </span>
        </button>
      )}
      {shownError && <p className="text-xs font-medium text-destructive">{shownError}</p>}
    </div>
  );
}

/* ─── Consent checkbox ────────────────────────────────────────────── */
export function CheckRow({
  checked,
  onChange,
  children,
  invalid,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
  invalid?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg p-1 text-[13.5px]">
      <span
        className={cn(
          'mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors',
          checked ? 'border-primary bg-primary text-primary-foreground' : invalid ? 'border-destructive' : 'border-input bg-card'
        )}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3.5} />}
      </span>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={invalid ? 'text-destructive' : 'text-muted-foreground'}>{children}</span>
    </label>
  );
}

/** Turn a DRF error payload into a flat {field: message} map. */
export function flattenErrors(data: any): Record<string, string> {
  const src = data?.errors ?? data;
  const out: Record<string, string> = {};
  if (!src || typeof src !== 'object') return out;
  for (const [k, v] of Object.entries(src)) {
    if (k === 'detail') continue;
    out[k] = Array.isArray(v) ? String(v[0]) : typeof v === 'string' ? v : JSON.stringify(v);
  }
  return out;
}
