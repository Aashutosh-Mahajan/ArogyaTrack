'use client';

import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import { t } from '@/lib/i18n';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="px-5 py-5 md:px-10">
        <Logo />
      </header>
      <main id="main" className="flex flex-1 items-center justify-center px-5 pb-20">
        <div className="max-w-md text-center">
          <div className="font-serif-accent text-[96px] leading-none text-primary">404</div>
          <h1 className="mt-4 text-[26px] font-semibold tracking-[-0.03em]">{t("This page doesn't exist")}</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">{t("The link may be old, or the address mistyped.")}</p>
          <div className="mt-8 flex justify-center gap-2">
            <Link href="/" className="inline-flex h-10 items-center rounded-[10px] bg-primary px-4 text-[13.5px] font-medium text-primary-foreground shadow-button">{t("Go home")}</Link>
            <Link href="/login" className="inline-flex h-10 items-center rounded-[10px] border bg-card px-4 text-[13.5px] font-medium shadow-sm hover:bg-muted">{t("Sign in")}</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
