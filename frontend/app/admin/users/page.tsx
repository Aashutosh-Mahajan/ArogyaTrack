'use client';

import React, { useEffect, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { History, Loader2, Search, ShieldCheck, Users } from 'lucide-react';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import { EmptyState, ErrorState, PageHeader, SkeletonRows, StatusPill } from '@/components/ui/page';
import { fieldClass } from '@/components/auth/FormKit';
import { roleLabel } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { t as tr, intlLocale, tn } from '@/lib/i18n';

interface UserRow {
  id: number;
  email: string;
  name: string;
  role: string;
  verification_status: string;
  approval_status: string | null;
  is_active: boolean;
  is_2fa_enabled: boolean;
  date_joined: string;
  last_login: string | null;
}

interface AuditRow {
  id: number;
  event_type: string;
  event_label: string;
  action: string;
  user: string | null;
  resource_type: string;
  resource_id: string;
  ip_address: string | null;
  severity: 'info' | 'warning' | 'critical' | string;
  created_at: string;
}

const ROLES = [
  { key: '', get label() { return tr("All roles"); } },
  { key: 'patient', get label() { return tr("Patients"); } },
  { key: 'doctor', get label() { return tr("Doctors"); } },
  { key: 'pharmacist', get label() { return tr("Pharmacists"); } },
  { key: 'admin', get label() { return tr("Admins"); } },
];

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never';

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function UsersTab() {
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const users = useQuery<UserRow[]>({
    queryKey: ['admin-users', role, q],
    queryFn: () => api.admin.users({ ...(role ? { role } : {}), ...(q ? { search: q } : {}) } as any),
  });

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("Search by email")} className={`${fieldClass()} h-10 pl-10`} aria-label={tr("Search users")} />
        </div>
        <select value={role} onChange={(e) => setRole(e.target.value)} className={`${fieldClass()} h-10 sm:w-44`} aria-label={tr("Filter by role")}>
          {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
      </div>
      {users.isLoading ? (
        <div className="rounded-2xl border bg-card p-5"><SkeletonRows rows={6} /></div>
      ) : users.isError ? (
        <ErrorState onRetry={() => users.refetch()} />
      ) : !users.data?.length ? (
        <EmptyState icon={Users} title={tr("No users match")} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
          <table className="w-full min-w-[820px] text-[13.5px]">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">{tr("User")}</th>
                <th className="px-5 py-3 font-medium">{tr("Role")}</th>
                <th className="px-5 py-3 font-medium">{tr("Status")}</th>
                <th className="px-5 py-3 font-medium">{tr("2FA")}</th>
                <th className="px-5 py-3 font-medium">{tr("Joined")}</th>
                <th className="px-5 py-3 font-medium">{tr("Last sign-in")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.data.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30">
                  <td className="px-5 py-3">
                    <div className="font-medium">{u.name || '—'}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="px-5 py-3">{roleLabel(u.role)}</td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {!u.is_active ? (
                        <StatusPill tone="neutral">{tr("Inactive")}</StatusPill>
                      ) : u.verification_status !== 'verified' ? (
                        <StatusPill tone="warning">{tr("Email unverified")}</StatusPill>
                      ) : (
                        <StatusPill tone="success">{tr("Active")}</StatusPill>
                      )}
                      {u.approval_status && u.approval_status !== 'approved' && (
                        <StatusPill tone={u.approval_status === 'rejected' ? 'danger' : 'warning'}>{u.approval_status === 'rejected' ? tr("Licence rejected") : tr("Licence pending")}</StatusPill>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">{u.is_2fa_enabled ? <ShieldCheck className="h-4 w-4 text-success" aria-label={tr("On")} /> : <span className="text-muted-foreground">{tr("Off")}</span>}</td>
                  <td className="px-5 py-3 text-muted-foreground">{new Date(u.date_joined).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td className="px-5 py-3 text-muted-foreground">{fmt(u.last_login)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.data.length >= 200 && <div className="border-t px-5 py-3 text-xs text-muted-foreground">{tr("Showing the 200 most recent accounts. Narrow the search to find others.")}</div>}
        </div>
      )}
    </div>
  );
}

const PAGE = 50;

function AuditTab() {
  const [severity, setSeverity] = useState('');
  const logs = useInfiniteQuery({
    queryKey: ['admin-audit', severity],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api.admin.auditLogs({ paged: 1, limit: PAGE, offset: pageParam, ...(severity ? { severity } : {}) }) as unknown as Promise<{ count: number; results: AuditRow[] }>,
    getNextPageParam: (last, all) => {
      const n = all.reduce((s, p) => s + p.results.length, 0);
      return n < last.count ? n : undefined;
    },
  });
  const rows = logs.data?.pages.flatMap((p) => p.results) ?? [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-[13px] text-muted-foreground">{logs.data ? tn(logs.data.pages[0].count, '1 event', '{count} events') : ''}</div>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} className={`${fieldClass()} h-10 w-44`} aria-label={tr("Filter by severity")}>
          <option value="">{tr("All severities")}</option>
          <option value="info">{tr("Info")}</option>
          <option value="warning">{tr("Warning")}</option>
          <option value="critical">{tr("Critical")}</option>
        </select>
      </div>
      {logs.isLoading ? (
        <div className="rounded-2xl border bg-card p-5"><SkeletonRows rows={6} /></div>
      ) : logs.isError ? (
        <ErrorState onRetry={() => logs.refetch()} />
      ) : !rows.length ? (
        <EmptyState icon={History} title={tr("No audit events")} />
      ) : (
        <>
          <ol className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
            {rows.map((r) => (
              <li key={r.id} className="flex items-start gap-4 px-5 py-3.5">
                <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', r.severity === 'critical' ? 'bg-destructive' : r.severity === 'warning' ? 'bg-warning' : 'bg-primary/60')} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-medium">{r.action}</span>
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{r.event_label}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {r.user || tr("System")}
                    {r.resource_type ? ` · ${r.resource_type}` : ''}
                    {r.ip_address ? ` · ${r.ip_address}` : ''}
                  </div>
                </div>
                <time className="shrink-0 text-xs text-muted-foreground" dateTime={r.created_at}>{fmt(r.created_at)}</time>
              </li>
            ))}
          </ol>
          {logs.hasNextPage && (
            <button onClick={() => logs.fetchNextPage()} disabled={logs.isFetchingNextPage} className="mx-auto mt-4 flex h-10 items-center gap-2 rounded-[10px] border bg-card px-4 text-[13.5px] font-medium shadow-sm hover:bg-muted disabled:opacity-60">
              {logs.isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />}{' '}{tr("Load older events")}</button>
          )}
        </>
      )}
    </div>
  );
}

function UsersPage(): React.JSX.Element {
  const [tab, setTab] = useState<'users' | 'audit'>('users');
  return (
    <div>
      <PageHeader eyebrow={tr("Administration")} title={tr("Users & audit log")} description={tr("Every account on the platform, and a record of sign-ins, approvals and other sensitive actions.")} />
      <div className="mb-5 inline-flex rounded-[10px] border bg-card p-1 shadow-sm">
        {[
          { k: 'users' as const, l: tr("Users"), i: Users },
          { k: 'audit' as const, l: tr("Audit log"), i: History },
        ].map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className={cn('inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors', tab === t.k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
            <t.i className="h-4 w-4" /> {t.l}
          </button>
        ))}
      </div>
      {tab === 'users' ? <UsersTab /> : <AuditTab />}
    </div>
  );
}

export default withAuth(UsersPage, ['admin']);
