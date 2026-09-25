'use client';

import React from 'react';

/** Shared Recharts styling so every chart follows the theme tokens in light and dark mode. */
export const C = {
  primary: 'hsl(var(--chart-1))',
  blue: 'hsl(var(--chart-2))',
  amber: 'hsl(var(--chart-3))',
  violet: 'hsl(var(--chart-4))',
  red: 'hsl(var(--chart-5))',
  grid: 'hsl(var(--border))',
  muted: 'hsl(var(--muted-foreground))',
};

export const SERIES = [C.primary, C.blue, C.amber, C.violet, C.red];

export const axisProps = {
  tick: { fontSize: 11.5, fill: C.muted },
  axisLine: false,
  tickLine: false,
} as const;

export const gridProps = { stroke: C.grid, strokeDasharray: '3 4', vertical: false } as const;

interface TipProps {
  active?: boolean;
  payload?: { name?: string; value?: number | string; color?: string; dataKey?: string }[];
  label?: string | number;
  unit?: string;
  formatter?: (v: number | string) => string;
}

export function ChartTooltip({ active, payload, label, unit, formatter }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[140px] rounded-xl border bg-popover px-3 py-2.5 text-[12.5px] shadow-pop">
      {label !== undefined && <div className="mb-1.5 font-medium text-foreground">{label}</div>}
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              {p.name ?? p.dataKey}
            </span>
            <span className="tabular font-semibold text-foreground">
              {p.value === undefined || p.value === null ? '—' : formatter ? formatter(p.value) : p.value}
              {unit ? ` ${unit}` : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-[12px] text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
