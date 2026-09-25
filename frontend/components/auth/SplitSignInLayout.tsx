'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Check } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { formatAsOf, formatCompact, usePublicStats } from '@/lib/publicStats';
import { t, m } from '@/lib/i18n';
import { tRich } from '@/lib/i18n-rich';

interface Props {
  /** Headline on the image panel. */
  headline?: React.ReactNode;
  /** Bullet points on the image panel. */
  points?: string[];
  /** Optional extra element on the image panel (e.g. a notice). */
  decoration?: React.ReactNode;
  /** Where the top-left back link goes. */
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
  /** Wider form column for multi-step registration. */
  wide?: boolean;
  /** Legacy prop kept for older callers; ignored. */
  features?: unknown;
}

const DEFAULT_POINTS = [
  m("Records, prescriptions and dispensing in one place"),
  m("Signed QR health cards and prescriptions"),
  m("Access is role-based and every action is audited"),
];

export default function SplitSignInLayout({
  headline,
  points = DEFAULT_POINTS,
  decoration,
  backHref = '/',
  backLabel = 'Home',
  children,
  wide = false,
}: Props) {
  const { data: stats } = usePublicStats();

  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Image panel */}
      <aside className="relative hidden overflow-hidden lg:block">
        <Image
          src="/image.png"
          alt={t("Doctors and nurses standing together in a hospital")}
          fill
          priority
          sizes="45vw"
          className="object-cover object-[50%_25%]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#04201b]/50 via-[#04201b]/45 to-[#04201b]/95" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#04201b]/70 via-[#04201b]/25 to-transparent" />
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(255,255,255,0.25)_1px,transparent_1px)] [background-size:22px_22px] mask-fade-b" />

        <div className="relative flex h-full flex-col justify-between p-10 xl:p-12">
          <Logo inverted />

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-md text-white"
          >
            <h2 className="text-[34px] font-semibold leading-[1.08] tracking-[-0.035em] xl:text-[40px]">
              {headline ?? (
                <>{tRich("Care that connects, <em>surveillance</em> that sees ahead.", (c) => <span className="font-serif-accent text-[#9be3cf]">{c}</span>)}</>
              )}
            </h2>
            {decoration && <div className="mt-6">{decoration}</div>}
            <ul className="mt-7 space-y-3">
              {points.map((p) => (
                <li key={p} className="flex items-start gap-3 text-[14.5px] text-white/80">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 backdrop-blur">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  {t(p)}
                </li>
              ))}
            </ul>
          </motion.div>

          <div className="flex items-end justify-between gap-6 border-t border-white/15 pt-6 text-white">
            {[
              { k: t("Districts"), v: stats?.monitored_regions },
              { k: t("Active alerts"), v: stats?.active_alerts },
              { k: t("Forecasts"), v: stats?.forecasts_generated },
            ].map((s) => (
              <div key={s.k}>
                <div className="tabular text-2xl font-semibold tracking-tight">{stats ? formatCompact(s.v) : '—'}</div>
                <div className="text-xs text-white/60">{s.k}</div>
              </div>
            ))}
            <div className="ml-auto text-right text-[11px] text-white/50">
              {stats ? <>{t("Live data")}<br />{t("as of {formatAsOf}", { formatAsOf: formatAsOf(stats.as_of) })}</> : null}
            </div>
          </div>
        </div>
      </aside>

      {/* Form column */}
      <main id="main" className="relative flex min-h-dvh min-w-0 flex-col">
        <div className="flex items-center justify-between px-5 py-5 md:px-10">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> {backLabel}
          </Link>
          <div className="flex items-center gap-2">
            <Logo subtitle={false} className="lg:hidden" />
            <LanguageSwitcher />
          <ThemeToggle className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-muted" />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 pb-12 md:px-10">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className={wide ? 'w-full max-w-[640px]' : 'w-full max-w-[400px]'}
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
