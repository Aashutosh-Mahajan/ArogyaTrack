'use client';

import SplitSignInLayout from '@/components/auth/SplitSignInLayout';
import { AuthHeading, SignInForm } from '@/components/auth/SignInForm';
import { t } from '@/lib/i18n';
import { tRich } from '@/lib/i18n-rich';

export default function PharmacistSignInPage() {
  return (
    <SplitSignInLayout
      backHref="/roles"
      backLabel={t("All roles")}
      headline={<>{tRich("Verify every prescription <em>before</em> it leaves the counter.", (c) => <span className="font-serif-accent text-[#9be3cf]">{c}</span>)}</>}
      points={[
        t("Scan prescription QR codes with signature verification"),
        t("Record full and partial dispensing per item"),
        t("Inventory with low-stock and expiry tracking"),
      ]}
    >
      <AuthHeading eyebrow={t("Pharmacy portal")} title={t("Sign in as a pharmacist")} description={t("Verify, dispense and manage stock.")} />
      <SignInForm roles={['pharmacist']} emailPlaceholder="you@pharmacy.in" registerHref="/signup/pharmacist" registerLabel={t("Register your pharmacy")} />
    </SplitSignInLayout>
  );
}
