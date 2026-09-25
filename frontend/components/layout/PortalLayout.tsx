'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { DashboardLayout } from './DashboardLayout';

/** Routes inside a portal folder that render without the app shell. */
const PUBLIC_SUFFIXES = ['/signin', '/register'];

export function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  if (PUBLIC_SUFFIXES.some((s) => pathname.endsWith(s))) return <>{children}</>;
  return <DashboardLayout>{children}</DashboardLayout>;
}
