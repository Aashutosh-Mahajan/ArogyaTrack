'use client';

import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  length?: number;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}

/** Separate digit boxes backed by a single string value; supports paste. */
export function OtpInput({ value, onChange, onComplete, length = 6, invalid, disabled, autoFocus = true }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] || '');

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const commit = (next: string) => {
    onChange(next);
    if (next.length === length) onComplete?.(next);
  };

  const handleChange = (i: number, raw: string) => {
    const d = raw.replace(/\D/g, '');
    if (!d) return;
    if (d.length > 1) {
      // Pasted or autofilled several digits at once
      const next = (value.slice(0, i) + d).slice(0, length);
      commit(next);
      refs.current[Math.min(next.length, length - 1)]?.focus();
      return;
    }
    const arr = digits.slice();
    arr[i] = d;
    const next = arr.join('').slice(0, length);
    commit(next);
    if (i < length - 1) refs.current[i + 1]?.focus();
  };

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const arr = digits.slice();
      if (arr[i]) {
        arr[i] = '';
        onChange(arr.join(''));
      } else if (i > 0) {
        arr[i - 1] = '';
        onChange(arr.join(''));
        refs.current[i - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    else if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus();
  };

  return (
    <div className="flex justify-between gap-2" role="group" aria-label={t("Verification code")}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e)}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          disabled={disabled}
          aria-label={t("Digit {value}", { value: i + 1 })}
          className={cn(
            'tabular h-14 w-full min-w-0 rounded-xl border bg-card text-center text-xl font-semibold text-foreground shadow-sm outline-none transition-[border-color,box-shadow] focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:opacity-60',
            invalid ? 'border-destructive' : d ? 'border-foreground/25' : 'border-input'
          )}
        />
      ))}
    </div>
  );
}
