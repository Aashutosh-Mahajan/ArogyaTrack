'use client';

import React from 'react';
import { withAuth } from '@/components/auth/withAuth';
import { AlertsPanel } from '@/components/dashboard/AlertsPanel';
import { PageHeader } from '@/components/ui/page';
import { t } from '@/lib/i18n';

function AlertsPage(): React.JSX.Element {
  return (
    <div>
      <PageHeader title={t("Alerts")} description={t("Abnormal results, missed medication and disease outbreaks reported in your area.")} />
      <AlertsPanel />
    </div>
  );
}

export default withAuth(AlertsPage, ['patient']);
