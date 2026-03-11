'use client';

import React from 'react';
import { withAuth } from '@/components/auth/withAuth';
import { AlertsPanel } from '@/components/dashboard/AlertsPanel';

function AlertsPage(): React.JSX.Element {
  return (

    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Alerts &amp; Notifications</h1>
        <p className="mt-1 text-sm text-gray-500">
          View and manage your health alerts and risk notifications.
        </p>
      </div>
      <AlertsPanel />
    </div>

  );
}

export default withAuth(AlertsPage, ['patient']);
