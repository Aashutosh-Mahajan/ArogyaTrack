'use client';

import { ShieldCheck } from 'lucide-react';
import SplitSignInLayout from '@/components/auth/SplitSignInLayout';
import { AuthHeading, SignInForm } from '@/components/auth/SignInForm';
import { t } from '@/lib/i18n';
import { tRich } from '@/lib/i18n-rich';

export default function AdminSignInPage() {
  return (
    <SplitSignInLayout
      backHref="/roles"
      backLabel={t("All roles")}
      headline={<>{tRich("District-level disease intelligence, <em>live.</em>", (c) => <span className="font-serif-accent text-[#9be3cf]">{c}</span>)}</>}
      points={[
        t("Heat maps, clusters and anomaly detection"),
        t("7, 14 and 30-day case forecasts"),
        t("Alert workflow and doctor licence approvals"),
      ]}
    >
      <AuthHeading eyebrow={t("Surveillance command")} title={t("Authority sign-in")} description={t("For health administrators and surveillance officers.")} />
      <SignInForm
        roles={['admin', 'authority']}
        roleName="authority"
        emailPlaceholder="officer@health.gov.in"
        registerHref=""
        notice={
          <div className="flex items-start gap-2.5 rounded-xl border bg-muted/60 px-3.5 py-3 text-[13px] text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{t("Authority accounts are provisioned by system administrators. Every sign-in is logged.")}</div>
        }
      />
    </SplitSignInLayout>
  );
}
