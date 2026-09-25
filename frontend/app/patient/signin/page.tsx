'use client';

import SplitSignInLayout from '@/components/auth/SplitSignInLayout';
import { AuthHeading, SignInForm } from '@/components/auth/SignInForm';
import { t } from '@/lib/i18n';
import { tRich } from '@/lib/i18n-rich';

export default function PatientSignInPage() {
  return (
    <SplitSignInLayout
      backHref="/roles"
      backLabel={t("All roles")}
      headline={<>{tRich("Your health record, <em>wherever</em> you are treated.", (c) => <span className="font-serif-accent text-[#9be3cf]">{c}</span>)}</>}
      points={[
        t("Consultations, prescriptions and lab reports in one timeline"),
        t("A QR health card you can share or revoke"),
        t("Dose reminders and adherence tracking"),
      ]}
    >
      <AuthHeading eyebrow={t("Patient portal")} title={t("Sign in as a patient")} description={t("Access your records, prescriptions and health card.")} />
      <SignInForm roles={['patient']} registerHref="/signup/patient" registerLabel={t("Create a patient account")} />
    </SplitSignInLayout>
  );
}
