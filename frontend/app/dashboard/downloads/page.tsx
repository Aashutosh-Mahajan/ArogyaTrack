'use client';

import React from 'react';
import { withAuth } from '@/components/auth/withAuth';
import { DownloadCenter } from '@/components/dashboard/DownloadCenter';

function DownloadsPage(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Downloads</h1>
        <p className="text-sm text-gray-500 mt-1">
          View and download your medical records, lab reports, and visit attachments.
        </p>
      </div>
      <DownloadCenter />
    </div>
  );
}

export default withAuth(DownloadsPage, ['patient']);
