'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, User } from 'lucide-react';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import { ErrorState, PageHeader, SkeletonRows } from '@/components/ui/page';
import { DispenseList } from '@/components/pharmacy/DispenseList';
import type { Prescription } from '@/types';
import { t } from '@/lib/i18n';

function DispensePage() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery<Prescription>({ queryKey: ['pharmacy-rx', id], queryFn: () => api.prescriptions.getById(id) });

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/pharmacy/scan" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />{' '}{t("Scan another")}</Link>
      <PageHeader
        title={t("Dispense prescription")}
        description={q.data ? <span className="inline-flex items-center gap-1.5"><User className="h-4 w-4" /> {q.data.patient_name}</span> : t("Signature verified. Record what you hand over.")}
      />
      {q.isLoading ? (
        <div className="rounded-2xl border bg-card p-5"><SkeletonRows rows={3} /></div>
      ) : q.isError || !q.data ? (
        <ErrorState message={t("This prescription could not be loaded.")} onRetry={() => q.refetch()} />
      ) : (
        <DispenseList prescriptions={[q.data]} onChanged={() => q.refetch()} />
      )}
    </div>
  );
}

export default withAuth(DispensePage, ['pharmacist']);
