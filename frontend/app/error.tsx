'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { t } from '@/lib/i18n';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-5">
      <div className="max-w-md text-center">
        <h1 className="text-[24px] font-semibold tracking-[-0.03em]">{t("Something went wrong on this page")}</h1>
        <p className="mt-2 text-[14.5px] text-muted-foreground">{t("The problem has been logged in your browser console. Try again, or go back to the start.")}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={reset} className="inline-flex h-10 items-center rounded-[10px] bg-primary px-4 text-[13.5px] font-medium text-primary-foreground shadow-button">{t("Try again")}</button>
          <Link href="/" className="inline-flex h-10 items-center rounded-[10px] border bg-card px-4 text-[13.5px] font-medium shadow-sm hover:bg-muted">{t("Home")}</Link>
        </div>
      </div>
    </div>
  );
}
