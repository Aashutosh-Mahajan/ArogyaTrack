'use client';

import React from 'react';
import { withAuth } from '@/components/auth/withAuth';
import { DownloadCenter } from '@/components/dashboard/DownloadCenter';
import { PageHeader } from '@/components/ui/page';
import { t } from '@/lib/i18n';

function DownloadsPage(): React.JSX.Element {
  return (
    <div>
      <PageHeader title={t("Downloads")} description={t("Your health card, visit records, prescriptions, invoices and lab results as ready-to-print PDFs, plus files your doctors uploaded.")} />
      <DownloadCenter />
    </div>
  );
}

export default withAuth(DownloadsPage, ['patient']);
