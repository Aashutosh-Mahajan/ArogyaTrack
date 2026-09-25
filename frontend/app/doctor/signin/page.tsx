'use client';

import { ShieldAlert } from 'lucide-react';
import SplitSignInLayout from '@/components/auth/SplitSignInLayout';
import { AuthHeading, SignInForm } from '@/components/auth/SignInForm';
import { t } from '@/lib/i18n';
import { tRich } from '@/lib/i18n-rich';

export default function DoctorSignInPage() {
  return (
    <SplitSignInLayout
      backHref="/roles"
      backLabel={t("All roles")}
      headline={<>{tRich("The full history, <em>one scan</em> away.", (c) => <span className="font-serif-accent text-[#9be3cf]">{c}</span>)}</>}
      points={[
        t("Scan a health card for audited access to patient history"),
        t("Interaction and allergy checks before prescribing"),
        t("Decision support and a high-risk patient watchlist"),
      ]}
      decoration={
        <div className="flex items-start gap-3 rounded-xl border border-white/15 bg-white/10 p-3.5 text-[13px] text-white/85 backdrop-blur">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />{t("Doctor accounts can open patient data only after an administrator approves the medical licence.")}</div>
      }
    >
      <AuthHeading eyebrow={t("Doctor portal")} title={t("Sign in as a doctor")} description={t("Manage patients, records and prescriptions.")} />
      <SignInForm roles={['doctor']} emailPlaceholder="you@hospital.in" registerHref="/signup/doctor" registerLabel={t("Register as a doctor")} />
    </SplitSignInLayout>
  );
}
