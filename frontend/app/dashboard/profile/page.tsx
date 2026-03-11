'use client';

import React from 'react';
import { withAuth } from '@/components/auth/withAuth';
import { ProfileView } from '@/components/dashboard/ProfileView';

function ProfilePage(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="mt-1 text-sm text-gray-500">
          View and manage your personal information, address, and privacy settings.
        </p>
      </div>
      <ProfileView />
    </div>

  );
}

export default withAuth(ProfilePage, ['patient']);
