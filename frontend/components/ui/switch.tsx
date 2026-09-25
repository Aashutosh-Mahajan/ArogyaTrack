'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

/** Accessible on/off switch. The knob is anchored left so its travel is exact. */
export function Switch({ checked, onCheckedChange, className, disabled, ...rest }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-60',
        checked ? 'bg-primary' : 'bg-muted-foreground/30',
        className
      )}
      {...rest}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute left-0.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform duration-200',
          checked ? 'translate-x-[18px]' : 'translate-x-0'
        )}
      />
    </button>
  );
}
