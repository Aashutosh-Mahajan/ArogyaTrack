'use client';

import { withAuth } from '@/components/auth/withAuth';
import { DownloadCenter } from '@/components/dashboard/DownloadCenter';

function DownloadsPage() {
  return (
    <div className="space-y-6">
      <DownloadCenter />
    </div>
  );
}

export default withAuth(DownloadsPage, ['patient']);
