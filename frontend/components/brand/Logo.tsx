import Link from 'next/link';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary text-primary-foreground shadow-button',
        className
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" className="h-[62%] w-[62%]" fill="none">
        <path
          d="M4 17h5l3-8 5 15 3.2-9.4L21.6 17H28"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

interface LogoProps {
  href?: string;
  className?: string;
  /** Force light text, for use on photos or always-dark panels. */
  inverted?: boolean;
  subtitle?: boolean;
}

export function Logo({ href = '/', className, inverted = false, subtitle = true }: LogoProps) {
  return (
    <Link href={href} className={cn('group inline-flex items-center gap-2.5', className)} aria-label={t("ArogyaTrack home")}>
      <LogoMark className="transition-transform duration-300 ease-spring group-hover:scale-105" />
      <span className="flex flex-col leading-none">
        <span className={cn('text-[17px] font-semibold tracking-[-0.03em]', inverted ? 'text-white' : 'text-foreground')}>ArogyaTrack</span>
        {subtitle && (
          <span
            className={cn(
              'mt-1 text-[10px] font-medium uppercase tracking-[0.14em]',
              inverted ? 'text-white/60' : 'text-muted-foreground'
            )}
          >{t("Health surveillance")}</span>
        )}
      </span>
    </Link>
  );
}
