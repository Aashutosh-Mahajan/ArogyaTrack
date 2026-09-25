'use client';

import React from 'react';
import { withAuth } from '@/components/auth/withAuth';
import { SecuritySettings } from '@/components/dashboard/SecuritySettings';
import { PageHeader } from '@/components/ui/page';
import { t } from '@/lib/i18n';

function SecurityPage(): React.JSX.Element {
  return (
    <div>
      <PageHeader title={t("Security")} description={t("Password, two-step sign-in and the devices signed in to your account.")} />
      <SecuritySettings />
    </div>
  );
}

export default withAuth(SecurityPage, ['patient']);
