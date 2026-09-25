'use client';

import React, { Suspense } from 'react';
import { withAuth } from '@/components/auth/withAuth';
import { ProfileView } from '@/components/dashboard/ProfileView';
import { PageHeader } from '@/components/ui/page';
import { t } from '@/lib/i18n';

function ProfilePage(): React.JSX.Element {
  return (
    <div>
      <PageHeader title={t("Profile")} description={t("Personal details, family members and privacy preferences.")} />
      <Suspense fallback={null}>
        <ProfileView />
      </Suspense>
    </div>
  );
}

export default withAuth(ProfilePage, ['patient']);
