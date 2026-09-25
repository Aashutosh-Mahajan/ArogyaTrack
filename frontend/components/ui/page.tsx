import React from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';

/* ─── Page header ─────────────────────────────────────────────────── */
interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, eyebrow, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <div className="kicker mb-2">{eyebrow}</div>}
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.03em] text-foreground md:text-[30px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[14.5px] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ─── Panel ───────────────────────────────────────────────────────── */
interface PanelProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  bodyClassName?: string;
}

export function Panel({ title, description, icon: Icon, actions, className, bodyClassName, children, ...rest }: PanelProps) {
  return (
    <section className={cn('min-w-0 rounded-2xl border bg-card shadow-[0_1px_2px_hsl(var(--shadow-color)/0.04)]', className)} {...rest}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 px-5 pb-1 pt-5 md:px-6">
          <div className="flex min-w-0 items-start gap-3">
            {Icon && (
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" strokeWidth={2} />
              </span>
            )}
            <div className="min-w-0">
              {title && <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>}
              {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn('p-5 md:p-6', (title || actions) && 'pt-4 md:pt-4', bodyClassName)}>{children}</div>
    </section>
  );
}

/* ─── Stat tile ───────────────────────────────────────────────────── */
type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const toneClasses: Record<Tone, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/14 text-warning',
  danger: 'bg-destructive/10 text-destructive',
  info: 'bg-info/12 text-info',
  neutral: 'bg-muted text-muted-foreground',
};

interface StatProps {
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  hint?: React.ReactNode;
  href?: string;
  loading?: boolean;
  className?: string;
}

export function Stat({ label, value, icon: Icon, tone = 'primary', hint, href, loading, className }: StatProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
        {Icon && (
          <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', toneClasses[tone])}>
            <Icon className="h-4 w-4" strokeWidth={2} />
          </span>
        )}
      </div>
      <div className="mt-3">
        {loading ? (
          <div className="skeleton h-8 w-20" />
        ) : (
          <div className="tabular text-[28px] font-semibold leading-none tracking-[-0.03em] text-foreground">{value}</div>
        )}
        {hint && <div className="mt-2 text-xs text-muted-foreground">{hint}</div>}
      </div>
      {href && (
        <ArrowUpRight className="absolute bottom-4 right-4 h-4 w-4 text-muted-foreground opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary group-hover:opacity-100" />
      )}
    </>
  );
  const cls = cn(
    'group relative flex flex-col justify-between rounded-2xl border bg-card p-5 shadow-[0_1px_2px_hsl(var(--shadow-color)/0.04)] transition-[transform,box-shadow,border-color] duration-300 ease-spring',
    href && 'hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card-hover',
    className
  );
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/* ─── Empty state ─────────────────────────────────────────────────── */
interface EmptyStateProps {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({ icon: Icon, title, description, action, className, compact }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 text-center',
        compact ? 'px-4 py-8' : 'px-6 py-14',
        className
      )}
    >
      {Icon && (
        <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border bg-card text-muted-foreground shadow-sm">
          <Icon className="h-5 w-5" strokeWidth={1.8} />
        </span>
      )}
      <div className="text-[14.5px] font-semibold text-foreground">{title}</div>
      {description && <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ─── Skeleton ────────────────────────────────────────────────────── */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Error state ─────────────────────────────────────────────────── */
export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/25 bg-destructive/5 px-6 py-10 text-center">
      <div className="text-[14.5px] font-semibold text-foreground">{t("We couldn't load this")}</div>
      <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{message || t("The server did not respond. Check your connection and try again.")}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg border bg-card px-3.5 py-1.5 text-[13px] font-medium hover:bg-muted"
        >{t("Try again")}</button>
      )}
    </div>
  );
}

/* ─── Status pill ─────────────────────────────────────────────────── */
export function StatusPill({ tone = 'neutral', children, dot = true, className }: { tone?: Tone; children: React.ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium', toneClasses[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function severityTone(level?: string | null): Tone {
  const l = (level || '').toLowerCase();
  if (['critical', 'very high', 'very_high', 'high', 'severe', 'emergency'].includes(l)) return 'danger';
  if (['medium', 'moderate', 'warning', 'elevated'].includes(l)) return 'warning';
  if (['low', 'mild', 'normal', 'ok', 'resolved', 'completed', 'active_ok'].includes(l)) return 'success';
  return 'neutral';
}
