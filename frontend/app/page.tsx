'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BellRing,
  Brain,
  Check,
  ClipboardList,
  Fingerprint,
  Globe2,
  History,
  KeyRound,
  Lock,
  Menu,
  Network,
  Pill,
  QrCode,
  ScanLine,
  ShieldCheck,
  Stethoscope,
  TrendingUp,
  User,
  Waypoints,
  X,
} from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { useAuthStore } from '@/store/authStore';
import { roleHome } from '@/lib/roles';
import { formatAsOf, formatCompact, usePublicStats } from '@/lib/publicStats';
import { cn } from '@/lib/utils';
import { t as tr, intlLocale } from '@/lib/i18n';
import { tRich } from '@/lib/i18n-rich';

const ease = [0.22, 1, 0.36, 1] as const;

function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, delay, ease }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ═══ Navigation ═══════════════════════════════════════════════════ */
const NAV_LINKS = [
  { href: '#platform', get label() { return tr("Platform"); } },
  { href: '#roles', get label() { return tr("Who it serves"); } },
  { href: '#intelligence', get label() { return tr("Surveillance"); } },
  { href: '#security', get label() { return tr("Security"); } },
];

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { isAuthenticated, user } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const signedIn = mounted && isAuthenticated && user;

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4">
      <nav
        className={cn(
          'mx-auto flex h-14 max-w-6xl items-center justify-between rounded-2xl px-3 pl-4 transition-all duration-500 ease-spring',
          scrolled ? 'fluid-nav' : 'border border-transparent'
        )}
        aria-label={tr("Main")}
      >
        <Logo subtitle={false} />
        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-[13.5px] font-medium text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <LanguageSwitcher className="text-foreground/70 hover:bg-foreground/5" />
          <ThemeToggle className="h-9 w-9 rounded-lg text-foreground/70 hover:bg-foreground/5" />
          {signedIn ? (
            <Link
              href={roleHome(user!.role)}
              className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-primary px-4 text-[13.5px] font-medium text-primary-foreground shadow-button transition-transform active:scale-[0.98]"
            >{tr("Open dashboard")}{' '}<ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden h-9 items-center rounded-[10px] px-3.5 text-[13.5px] font-medium text-foreground/80 transition-colors hover:bg-foreground/5 hover:text-foreground sm:inline-flex"
              >{tr("Sign in")}</Link>
              <Link
                href="/signup"
                className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-primary px-4 text-[13.5px] font-medium text-primary-foreground shadow-button transition-transform active:scale-[0.98]"
              >{tr("Get started")}</Link>
            </>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg p-2 text-foreground/70 hover:bg-foreground/5 md:hidden"
            aria-label={open ? tr("Close menu") : tr("Open menu")}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="fluid-nav mx-auto mt-2 max-w-6xl rounded-2xl p-2 md:hidden"
          >
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-foreground/5">
                {l.label}
              </a>
            ))}
            {!signedIn && (
              <Link href="/login" className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-foreground/5">{tr("Sign in")}</Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/* ═══ Hero ═════════════════════════════════════════════════════════ */
function Hero() {
  const { data: stats, isLoading } = usePublicStats();
  const top = stats?.top_diseases?.[0];

  const figures = [
    { label: tr("Districts monitored"), value: stats?.monitored_regions },
    { label: tr("Active clusters"), value: stats?.active_clusters },
    { label: tr("Forecasts generated"), value: stats?.forecasts_generated },
  ];

  return (
    <section id="platform" className="relative overflow-hidden pb-20 pt-32 md:pb-28 md:pt-40">
      <div className="pointer-events-none absolute inset-0 bg-grid mask-fade-b opacity-60" aria-hidden="true" />
      <div
        className="pointer-events-none absolute -top-40 right-[-10%] h-[620px] w-[620px] rounded-full bg-primary/15 blur-[120px]"
        aria-hidden="true"
      />

      <div className="container relative grid items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
            className="inline-flex items-center gap-2.5 rounded-full border bg-card/70 py-1 pl-2 pr-3.5 text-[12.5px] font-medium text-muted-foreground shadow-sm backdrop-blur"
          >
            <span className="flex items-center gap-1.5 rounded-full bg-success/12 px-2 py-0.5 text-success">
              <span className="live-dot" />{' '}{tr("Live")}</span>
            {stats ? tr("Surveillance data as of {formatAsOf}", { formatAsOf: formatAsOf(stats.as_of) }) : tr("National disease surveillance")}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.05, ease }}
            className="mt-6 text-[44px] font-semibold leading-[1.02] tracking-[-0.045em] text-foreground sm:text-6xl lg:text-[70px]"
          >{tRich("See outbreaks <em>before</em> they spread.", (c) => <span className="font-serif-accent text-primary">{c}</span>)}</motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.12, ease }}
            className="mt-6 max-w-xl text-[17px] leading-relaxed text-muted-foreground"
          >{tr("ArogyaTrack links patient records, e-prescriptions and pharmacy dispensing to a surveillance layer that forecasts cases and flags disease clusters district by district — so care teams and health authorities act on the same picture.")}</motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <Link
              href="/signup"
              className="group inline-flex h-12 items-center gap-3 rounded-xl bg-primary pl-5 pr-2 text-[15px] font-medium text-primary-foreground shadow-button transition-transform active:scale-[0.98]"
            >{tr("Create your health ID")}<span className="btn-icon-wrap h-8 w-8 rounded-lg">
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
            <Link
              href="/roles"
              className="inline-flex h-12 items-center gap-2 rounded-xl border bg-card px-5 text-[15px] font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
            >{tr("Sign in by role")}</Link>
          </motion.div>

          <motion.dl
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.35 }}
            className="mt-12 grid max-w-lg grid-cols-3 divide-x border-t pt-6"
          >
            {figures.map((f) => (
              <div key={f.label} className="px-4 first:pl-0">
                <dt className="text-xs text-muted-foreground">{f.label}</dt>
                <dd className="tabular mt-1 text-2xl font-semibold tracking-tight text-foreground">
                  {isLoading ? <span className="skeleton inline-block h-6 w-12 align-middle" /> : formatCompact(f.value)}
                </dd>
              </div>
            ))}
          </motion.dl>
        </div>

        {/* Visual */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.1, ease }}
          className="relative mx-auto w-full max-w-[560px]"
        >
          <div className="bezel-shell rounded-[2rem]">
            <div className="relative aspect-[4/3.4] overflow-hidden rounded-[calc(2rem-0.3125rem)]">
              <Image
                src="/image.png"
                alt={tr("A team of doctors and nurses in a hospital corridor")}
                fill
                priority
                sizes="(min-width: 1024px) 560px, 100vw"
                className="object-cover object-[50%_30%]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#06201c]/70 via-transparent to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between text-white">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/70">{tr("Care network")}</div>
                  <div className="mt-1 text-lg font-semibold tracking-tight">
                    {stats ? tr("{formatCompact} doctors · {formatCompact2} pharmacists", { formatCompact: formatCompact(stats.doctors_registered), formatCompact2: formatCompact(stats.pharmacists_registered) }) : tr("Doctors · Pharmacists · Patients")}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Floating: alerts */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.55, ease }}
            className="glass absolute -left-4 top-8 w-[220px] rounded-2xl p-4 sm:-left-10"
          >
            <div className="flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
              <BellRing className="h-3.5 w-3.5 text-destructive" />{' '}{tr("Outbreak alerts")}</div>
            <div className="tabular mt-2 text-3xl font-semibold tracking-tight text-foreground">
              {stats ? stats.active_alerts : '—'}
            </div>
            <div className="mt-1 text-[12px] text-muted-foreground">{tr("active across monitored districts")}</div>
          </motion.div>

          {/* Floating: top disease */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.7, ease }}
            className="glass absolute -right-3 top-[46%] w-[230px] animate-float rounded-2xl p-4 sm:-right-8"
          >
            <div className="flex items-center justify-between text-[12px] font-medium text-muted-foreground">
              <span className="flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 text-warning" />{' '}{tr("Leading this week")}</span>
            </div>
            <div className="mt-2 truncate text-[15px] font-semibold text-foreground">{top?.disease_name ?? '—'}</div>
            <div className="tabular text-[12.5px] text-muted-foreground">
              {top ? tr("{formatCompact} reported cases", { formatCompact: formatCompact(top.total_cases) }) : tr("Awaiting data")}
            </div>
            <div className="mt-3 flex h-8 items-end gap-1">
              {(stats?.top_diseases ?? []).map((d, i) => {
                const max = stats!.top_diseases[0].total_cases || 1;
                return (
                  <div
                    key={tr(d.disease_name)}
                    title={`${tr(d.disease_name)}: ${d.total_cases}`}
                    className={cn('flex-1 rounded-sm', i === 0 ? 'bg-primary' : 'bg-primary/25')}
                    style={{ height: `${Math.max(12, (d.total_cases / max) * 100)}%` }}
                  />
                );
              })}
            </div>
          </motion.div>

          {/* Floating: health card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.85, ease }}
            className="glass absolute -bottom-6 right-6 flex items-center gap-3 rounded-2xl py-3 pl-3 pr-4"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <QrCode className="h-5 w-5" />
            </span>
            <div>
              <div className="text-[13px] font-semibold text-foreground">{tr("QR health card")}</div>
              <div className="text-[12px] text-muted-foreground">{tr("Time-limited doctor access")}</div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ═══ Live ticker ══════════════════════════════════════════════════ */
function Ticker() {
  const { data: stats } = usePublicStats();
  const items = stats?.top_diseases ?? [];
  if (!items.length) return null;
  const row = [...items, ...items, ...items];
  return (
    <div className="border-y bg-card/60 py-4">
      <div className="container flex items-center gap-6">
        <div className="hidden shrink-0 items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground sm:flex">
          <Activity className="h-4 w-4 text-primary" />{' '}{tr("7-day cases")}
        </div>
        <div className="relative flex-1 overflow-hidden mask-fade-x">
          <div className="marquee-track flex w-max gap-10">
            {[...row, ...row].map((d, i) => (
              <span key={i} className="flex items-center gap-2.5 whitespace-nowrap text-[14px]">
                <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                <span className="font-medium text-foreground">{tr(d.disease_name)}</span>
                <span className="tabular text-muted-foreground">{d.total_cases.toLocaleString(intlLocale())}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══ Roles ════════════════════════════════════════════════════════ */
const ROLES = [
  {
    key: 'patient',
    get label() { return tr("Patients"); },
    icon: User,
    get title() { return tr("Your records, prescriptions and reminders in one health ID."); },
    get points() { return [tr("A QR health card you control — revoke doctor access at any time"), tr("Every consultation, lab report and prescription in one timeline"), tr("Dose reminders and adherence tracking for active prescriptions"), tr("Family profiles: manage records for parents and children")]; },
    cta: { href: '/signup/patient', get label() { return tr("Create a patient ID"); } },
    preview: [
      { icon: ClipboardList, get title() { return tr("Consultation · General medicine"); }, get meta() { return tr("Visit notes and vitals"); } },
      { icon: Pill, get title() { return tr("Amlodipine 10 mg"); }, get meta() { return tr("Once daily · 21 days left"); } },
      { icon: Activity, get title() { return tr("HbA1c"); }, get meta() { return tr("Lab result trend"); } },
    ],
  },
  {
    key: 'doctor',
    get label() { return tr("Doctors"); },
    icon: Stethoscope,
    get title() { return tr("Scan a card, see the full history, prescribe safely."); },
    get points() { return [tr("Scan a patient QR to open their history with audited access"), tr("Drug-interaction and allergy checks before a prescription is issued"), tr("Clinical decision support suggests differentials from symptoms"), tr("High-risk patient watchlist ranked by computed risk score")]; },
    cta: { href: '/signup/doctor', get label() { return tr("Register as a doctor"); } },
    preview: [
      { icon: ScanLine, get title() { return tr("Health card scanned"); }, get meta() { return tr("Access granted for 24 hours"); } },
      { icon: ShieldCheck, get title() { return tr("No interactions found"); }, get meta() { return tr("3 medicines checked"); } },
      { icon: Brain, get title() { return tr("Decision support"); }, get meta() { return tr("Ranked differential diagnoses"); } },
    ],
  },
  {
    key: 'pharmacist',
    get label() { return tr("Pharmacists"); },
    icon: Pill,
    get title() { return tr("Verify, dispense and track stock from one counter."); },
    get points() { return [tr("Scan a prescription QR — signatures are verified server-side"), tr("Partial and full dispensing recorded against each line item"), tr("Inventory with low-stock and expiry visibility"), tr("Complete dispensing history for audit")]; },
    cta: { href: '/signup/pharmacist', get label() { return tr("Register a pharmacy"); } },
    preview: [
      { icon: QrCode, get title() { return tr("Prescription verified"); }, get meta() { return tr("Signature valid"); } },
      { icon: Pill, get title() { return tr("2 of 3 items dispensed"); }, get meta() { return tr("Remaining held for refill"); } },
      { icon: History, get title() { return tr("Dispensing log"); }, get meta() { return tr("Timestamped per pharmacist"); } },
    ],
  },
  {
    key: 'authority',
    get label() { return tr("Health authorities"); },
    icon: Globe2,
    get title() { return tr("A live map of disease burden, with forecasts and alerts."); },
    get points() { return [tr("Heat map of cases per 100k across monitored districts"), tr("Spatial clustering surfaces emerging hotspots"), tr("7, 14 and 30-day case forecasts with confidence bands"), tr("Alert workflow: acknowledge, escalate, resolve")]; },
    cta: { href: '/admin/signin', get label() { return tr("Authority sign-in"); } },
    preview: [
      { icon: Network, get title() { return tr("Cluster detected"); }, get meta() { return tr("Spatial density flag"); } },
      { icon: TrendingUp, get title() { return tr("14-day forecast"); }, get meta() { return tr("Upper bound above threshold"); } },
      { icon: BellRing, get title() { return tr("Alert escalated"); }, get meta() { return tr("Routed to district officer"); } },
    ],
  },
] as const;

function Roles() {
  const [active, setActive] = useState(0);
  const role = ROLES[active];

  return (
    <section id="roles" className="py-24 md:py-32">
      <div className="container">
        <Reveal className="max-w-2xl">
          <div className="kicker">{tr("One record · four roles")}</div>
          <h2 className="mt-3 text-4xl font-semibold leading-[1.05] tracking-[-0.04em] md:text-5xl">{tRich("Built around the people who <em>actually</em> deliver care.", (c) => <span className="font-serif-accent text-primary">{c}</span>)}</h2>
        </Reveal>

        <Reveal delay={0.1} className="mt-10">
          <div role="tablist" aria-label={tr("Roles")} className="inline-flex flex-wrap gap-1 rounded-xl border bg-card p-1 shadow-sm">
            {ROLES.map((r, i) => {
              const Icon = r.icon;
              return (
                <button
                  key={r.key}
                  role="tab"
                  aria-selected={i === active}
                  onClick={() => setActive(i)}
                  className={cn(
                    'relative flex items-center gap-2 rounded-lg px-4 py-2 text-[13.5px] font-medium transition-colors',
                    i === active ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {i === active && (
                    <motion.span layoutId="role-pill" className="absolute inset-0 rounded-lg bg-primary" transition={{ type: 'spring', bounce: 0.18, duration: 0.5 }} />
                  )}
                  <Icon className="relative h-4 w-4" />
                  <span className="relative">{r.label}</span>
                </button>
              );
            })}
          </div>
        </Reveal>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <AnimatePresence mode="wait">
            <motion.div
              key={role.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease }}
              className="rounded-3xl border bg-card p-7 shadow-sm md:p-10"
            >
              <h3 className="max-w-md text-2xl font-semibold leading-tight tracking-[-0.03em] md:text-[28px]">{role.title}</h3>
              <ul className="mt-7 space-y-3.5">
                {role.points.map((p) => (
                  <li key={p} className="flex gap-3 text-[15px] text-foreground/80">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
              <Link href={role.cta.href} className="group mt-9 inline-flex items-center gap-1.5 text-[14.5px] font-semibold text-primary">
                {role.cta.label}
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </motion.div>
          </AnimatePresence>

          <div className="relative overflow-hidden rounded-3xl border bg-sunken p-6 md:p-8">
            <div className="pointer-events-none absolute inset-0 bg-dots opacity-70" aria-hidden="true" />
            <AnimatePresence mode="wait">
              <motion.div
                key={role.key}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="relative space-y-3"
              >
                <div className="mb-5 flex items-center justify-between">
                  <span className="text-[12px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{tr("{label} workspace", { label: role.label })}</span>
                  <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <span className="live-dot" />{' '}{tr("Synced")}</span>
                </div>
                {role.preview.map((p, i) => {
                  const Icon = p.icon;
                  return (
                    <motion.div
                      key={p.title}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.08 * i, duration: 0.45, ease }}
                      className="flex items-center gap-3.5 rounded-2xl border bg-card p-4 shadow-sm"
                      style={{ marginLeft: `${i * 18}px` }}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-semibold text-foreground">{p.title}</div>
                        <div className="truncate text-[12.5px] text-muted-foreground">{p.meta}</div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══ Intelligence ═════════════════════════════════════════════════ */
const MODELS = [
  { icon: TrendingUp, get name() { return tr("Prophet forecasting"); }, get desc() { return tr("7, 14 and 30-day case forecasts per district with upper and lower bounds."); } },
  { icon: Network, get name() { return tr("DBSCAN clustering"); }, get desc() { return tr("Density-based spatial clustering that surfaces emerging hotspots."); } },
  { icon: Waypoints, get name() { return tr("Isolation Forest"); }, get desc() { return tr("Unsupervised anomaly detection on case patterns threshold rules miss."); } },
  { icon: Brain, get name() { return tr("XGBoost risk scoring"); }, get desc() { return tr("Environmental and demographic features fused into a per-region risk tier."); } },
];

function Intelligence() {
  const { data: stats } = usePublicStats();

  const tiles = [
    { label: tr("Surveillance records"), value: stats?.surveillance_records, span: 'md:col-span-2' },
    { label: tr("Cases in the last 7 days"), value: stats?.cases_last_7_days, span: '' },
    { label: tr("States covered"), value: stats?.states_covered, span: '' },
  ];

  return (
    <section id="intelligence" className="relative overflow-hidden border-y bg-sunken py-24 md:py-32">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40 mask-fade-b" aria-hidden="true" />
      <div className="container relative grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <Reveal>
          <div className="kicker">{tr("Surveillance intelligence")}</div>
          <h2 className="mt-3 text-4xl font-semibold leading-[1.05] tracking-[-0.04em] md:text-5xl">{tRich("Four models watching the data, <em>every day.</em>", (c) => <span className="font-serif-accent text-primary">{c}</span>)}
          </h2>
          <p className="mt-5 max-w-md text-[16px] leading-relaxed text-muted-foreground">{tr("Clinical activity flows into k-anonymised district aggregates. The pipeline forecasts, clusters, scores risk and raises alerts that authorities can act on.")}</p>
          <div className="mt-8 inline-flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
            <span className="live-dot" />
            <span className="text-[14px] font-medium">
              {stats ? tr("{ml_models_live} of {ml_models_total} models loaded", { ml_models_live: stats.ml_models_live, ml_models_total: stats.ml_models_total }) : tr("Checking model status…")}
            </span>
          </div>
        </Reveal>

        <div className="space-y-4">
          <Reveal delay={0.05}>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {tiles.map((t) => (
                <div key={t.label} className={cn('col-span-2 rounded-2xl border bg-card p-5 shadow-sm md:col-span-1', t.span)}>
                  <div className="text-[12.5px] text-muted-foreground">{t.label}</div>
                  <div className="tabular mt-2 text-3xl font-semibold tracking-[-0.03em]">
                    {stats ? (t.value ?? 0).toLocaleString(intlLocale()) : '—'}
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2">
            {MODELS.map((m, i) => {
              const Icon = m.icon;
              return (
                <Reveal key={m.name} delay={0.08 + i * 0.05}>
                  <div className="group h-full rounded-2xl border bg-card p-5 shadow-sm transition-[transform,box-shadow] duration-300 ease-spring hover:-translate-y-0.5 hover:shadow-ambient">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="mt-4 text-[15px] font-semibold">{m.name}</div>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">{m.desc}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══ Flow ═════════════════════════════════════════════════════════ */
const STEPS = [
  { get title() { return tr("Patient registers"); }, get desc() { return tr("A health ID and QR card are issued on sign-up, with family profiles."); } },
  { get title() { return tr("Doctor consults"); }, get desc() { return tr("Card scan grants time-limited access; visits and prescriptions are recorded."); } },
  { get title() { return tr("Pharmacy dispenses"); }, get desc() { return tr("Prescription QR is verified before any medicine leaves the counter."); } },
  { get title() { return tr("Surveillance learns"); }, get desc() { return tr("Anonymised aggregates feed forecasts, clusters and outbreak alerts."); } },
];

function Flow() {
  return (
    <section className="py-24 md:py-32">
      <div className="container">
        <Reveal className="mx-auto max-w-2xl text-center">
          <div className="kicker">{tr("How it fits together")}</div>
          <h2 className="mt-3 text-4xl font-semibold leading-[1.05] tracking-[-0.04em] md:text-5xl">{tr("From a clinic visit to a district alert")}</h2>
        </Reveal>
        <div className="relative mt-16 grid gap-8 md:grid-cols-4 md:gap-6">
          <div className="absolute left-0 right-0 top-5 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block" aria-hidden="true" />
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.08} className="relative">
              <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border bg-card text-sm font-semibold text-primary shadow-sm">
                {String(i + 1).padStart(2, '0')}
              </div>
              <h3 className="mt-5 text-[17px] font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{s.desc}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══ Security ═════════════════════════════════════════════════════ */
const SECURITY = [
  { icon: Lock, get title() { return tr("httpOnly session cookies"); }, get desc() { return tr("Tokens never touch JavaScript, closing off the usual XSS theft route."); } },
  { icon: Fingerprint, get title() { return tr("K-anonymised surveillance"); }, get desc() { return tr("No individual can be re-identified from the aggregates authorities see."); } },
  { icon: KeyRound, get title() { return tr("Role-based access"); }, get desc() { return tr("Patients, doctors, pharmacists and authorities see only what their role allows."); } },
  { icon: History, get title() { return tr("Full audit trail"); }, get desc() { return tr("Record access, prescription checks and approvals are logged with actor and time."); } },
  { icon: QrCode, get title() { return tr("Signed QR tokens"); }, get desc() { return tr("Health cards and prescriptions carry signatures verified server-side."); } },
  { icon: ShieldCheck, get title() { return tr("Verified clinicians"); }, get desc() { return tr("Doctor accounts stay locked until an administrator approves the licence."); } },
];

function Security() {
  return (
    <section id="security" className="border-t py-24 md:py-32">
      <div className="container grid gap-14 lg:grid-cols-[0.8fr_1.2fr]">
        <Reveal>
          <div className="kicker">{tr("Security & privacy")}</div>
          <h2 className="mt-3 text-4xl font-semibold leading-[1.05] tracking-[-0.04em] md:text-5xl">{tRich("Health data deserves <em>restraint.</em>", (c) => <span className="font-serif-accent text-primary">{c}</span>)}
          </h2>
          <p className="mt-5 max-w-sm text-[16px] leading-relaxed text-muted-foreground">{tr("Access is narrow by default and every sensitive action leaves a record.")}</p>
        </Reveal>
        <div className="grid gap-x-10 gap-y-9 sm:grid-cols-2">
          {SECURITY.map((s, i) => {
            const Icon = s.icon;
            return (
              <Reveal key={s.title} delay={i * 0.04}>
                <div className="flex gap-4">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" strokeWidth={1.8} />
                  <div>
                    <div className="text-[15px] font-semibold">{s.title}</div>
                    <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">{s.desc}</p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ═══ CTA + footer ═════════════════════════════════════════════════ */
function Cta() {
  return (
    <section className="pb-24">
      <div className="container">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] bg-primary px-8 py-16 text-primary-foreground md:px-16 md:py-20">
            <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(rgba(255,255,255,0.5)_1px,transparent_1px)] [background-size:22px_22px] mask-fade-b" aria-hidden="true" />
            <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
            <div className="relative flex flex-col items-start justify-between gap-10 md:flex-row md:items-end">
              <div className="max-w-xl">
                <h2 className="text-4xl font-semibold leading-[1.05] tracking-[-0.04em] md:text-5xl">{tRich("Start with your own <em>health ID.</em>", (c) => <span className="font-serif-accent">{c}</span>)}
                </h2>
                <p className="mt-4 text-[16px] text-primary-foreground/75">{tr("Register in a few minutes. Your records follow you to any doctor or pharmacy on the network.")}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/signup"
                  className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 text-[15px] font-semibold text-[#0b3b33] shadow-lg transition-transform active:scale-[0.98]"
                >{tr("Get started")}{' '}<ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-12 items-center rounded-xl border border-white/25 px-6 text-[15px] font-medium text-white transition-colors hover:bg-white/10"
                >{tr("Sign in")}</Link>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t py-10">
      <div className="container flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <Logo subtitle={false} />
          <span className="text-[13px] text-muted-foreground">{tr("© {getFullYear} ArogyaTrack", { getFullYear: new Date().getFullYear() })}</span>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[13.5px] text-muted-foreground" aria-label={tr("Footer")}>
          <Link href="/roles" className="hover:text-foreground">{tr("Sign in")}</Link>
          <Link href="/signup" className="hover:text-foreground">{tr("Register")}</Link>
          <Link href="/prescription/verify" className="hover:text-foreground">{tr("Verify a prescription")}</Link>
          <a href="#security" className="hover:text-foreground">{tr("Security")}</a>
        </nav>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-background">
      <Nav />
      <main id="main">
        <Hero />
        <Ticker />
        <Roles />
        <Intelligence />
        <Flow />
        <Security />
        <Cta />
      </main>
      <Footer />
    </div>
  );
}
