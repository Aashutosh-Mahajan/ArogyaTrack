'use client';

import React from 'react';
import { PageHeader } from '@/components/ui/page';

interface DashboardHeaderProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

/** Thin wrapper kept for existing pages; renders the shared page header. */
export function DashboardHeader({ title = 'Overview', subtitle, actions }: DashboardHeaderProps) {
  return <PageHeader title={title} description={subtitle} actions={actions} />;
}
