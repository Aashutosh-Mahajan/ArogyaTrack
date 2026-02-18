'use client';

import React from 'react';
import { withAuth } from '@/components/auth/withAuth';
import { SecuritySettings } from '@/components/dashboard/SecuritySettings';

function SecurityPage(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Security Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your account security, sessions, and password.
        </p>
      </div>
      <SecuritySettings />
    </div>
  );
}

export default withAuth(SecurityPage, ['patient', 'doctor', 'admin']);
