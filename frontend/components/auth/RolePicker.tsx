'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Globe2, Pill, Stethoscope, User, type LucideIcon } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { t } from '@/lib/i18n';
import { tRich } from '@/lib/i18n-rich';

interface RoleCard {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  note?: string;
}

interface RolePickerProps {
  mode: 'signin' | 'signup';
}

export function RolePicker({ mode }: RolePickerProps) {
  const signup = mode === 'signup';
  const cards: RoleCard[] = [
    {
      key: 'patient',
      title: t("Patient"),
      description: t("Records, prescriptions, health card and dose reminders."),
      icon: User,
      href: signup ? '/signup/patient' : '/patient/signin',
    },
    {
      key: 'doctor',
      title: t("Doctor"),
      description: t("Patient history, consultations and safe prescribing."),
      icon: Stethoscope,
      href: signup ? '/signup/doctor' : '/doctor/signin',
      note: t("Licence approval required"),
    },
    {
      key: 'pharmacist',
      title: t("Pharmacist"),
      description: t("Verify prescriptions, dispense and manage stock."),
      icon: Pill,
      href: signup ? '/signup/pharmacist' : '/pharmacist/signin',
    },
    {
      key: 'authority',
      title: t("Health authority"),
      description: t("Surveillance map, forecasts, clusters and alerts."),
      icon: Globe2,
      href: '/admin/signin',
      note: signup ? t("Provisioned accounts only") : t("Restricted access"),
    },
  ];

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-50 mask-fade-b" aria-hidden="true" />
      <div className="pointer-events-none absolute left-1/2 top-[-240px] h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]" aria-hidden="true" />

      <header className="relative flex items-center justify-between px-5 py-5 md:px-10">
        <Logo />
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-muted" />
          <Link
            href={signup ? '/login' : '/signup'}
            className="inline-flex h-9 items-center rounded-[10px] border bg-card px-3.5 text-[13.5px] font-medium shadow-sm hover:bg-muted"
          >
            {signup ? t("Sign in") : t("Create account")}
          </Link>
        </div>
      </header>

      <main id="main" className="relative mx-auto max-w-5xl px-5 pb-20 pt-10 md:pt-16">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-xl text-center"
        >
          <div className="kicker text-primary">{signup ? t("Create an account") : t("Sign in")}</div>
          <h1 className="mt-3 text-4xl font-semibold leading-[1.05] tracking-[-0.04em] md:text-5xl">
            {signup ? (
              <>{tRich("How will you use <em>ArogyaTrack?</em>", (c) => <span className="font-serif-accent text-primary">{c}</span>)}</>
            ) : (
              <>{tRich("Choose your <em>portal.</em>", (c) => <span className="font-serif-accent text-primary">{c}</span>)}</>
            )}
          </h1>
          <p className="mt-4 text-[15.5px] text-muted-foreground">
            {signup
              ? t("Pick the account type that matches your role. You can add family members to a patient account later.")
              : t("Each role has its own workspace. Your email and password work in the one you registered for.")}
          </p>
        </motion.div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {cards.map((c, i) => {
            const Icon = c.icon;
            return (
              <motion.div
                key={c.key}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.08 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              >
                <Link
                  href={c.href}
                  className="group relative flex h-full items-start gap-5 rounded-2xl border bg-card p-6 shadow-sm transition-[transform,box-shadow,border-color] duration-300 ease-spring hover:-translate-y-1 hover:border-primary/35 hover:shadow-card-hover"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-6 w-6" strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[17px] font-semibold tracking-tight">{c.title}</h2>
                      {c.note && (
                        <span className="rounded-md bg-warning/12 px-1.5 py-0.5 text-[11px] font-medium text-warning">{c.note}</span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">{c.description}</p>
                  </div>
                  <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-all duration-300 group-hover:translate-x-1 group-hover:text-primary" />
                </Link>
              </motion.div>
            );
          })}
        </div>

        <p className="mt-10 text-center text-[13.5px] text-muted-foreground">
          {signup ? t("Already registered? ") : t("New to ArogyaTrack? ")}
          <Link href={signup ? '/login' : '/signup'} className="font-semibold text-primary hover:underline">
            {signup ? t("Sign in") : t("Create an account")}
          </Link>
        </p>
      </main>
    </div>
  );
}
