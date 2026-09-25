'use client';

import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { t } from '@/lib/i18n';

/** Shown to doctors whose licence is not yet approved; re-checks so it clears as soon as an admin approves. */
export function ApprovalBanner() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const isDoctor = user?.role === 'doctor';

  const me = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => api.auth.getCurrentUser() as Promise<{ approval_status?: 'pending' | 'approved' | 'rejected' | null }>,
    enabled: isDoctor,
    refetchInterval: (q) => (q.state.data?.approval_status === 'approved' ? false : 60_000),
  });

  const status = me.data?.approval_status ?? user?.approval_status;

  useEffect(() => {
    if (me.data && me.data.approval_status !== user?.approval_status) {
      updateUser({ approval_status: me.data.approval_status ?? null });
    }
  }, [me.data, user?.approval_status, updateUser]);

  if (!isDoctor || !status || status === 'approved') return null;

  const rejected = status === 'rejected';
  return (
    <div
      role="status"
      className={
        'mb-6 flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-[13.5px] ' +
        (rejected ? 'border-destructive/30 bg-destructive/5' : 'border-warning/30 bg-warning/8')
      }
    >
      {rejected ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /> : <Clock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />}
      <div>
        <div className="font-semibold text-foreground">{rejected ? t("Licence not approved") : t("Licence review in progress")}</div>
        <p className="mt-0.5 text-muted-foreground">
          {rejected
            ? t("An administrator rejected your registration. Contact your hospital administrator to resubmit your documents.")
            : t("You can look around, but scanning health cards and opening patient records unlock once an administrator approves your medical licence. This page updates automatically.")}
        </p>
      </div>
    </div>
  );
}
