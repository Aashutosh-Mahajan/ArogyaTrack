'use client';

import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { KeyRound, Laptop, Loader2, LogOut, MonitorSmartphone, ShieldCheck, Smartphone, X } from 'lucide-react';
import { api } from '@/lib/api';
import { ErrorState, Panel, SkeletonRows, StatusPill } from '@/components/ui/page';
import { Field, PasswordInput, flattenErrors } from '@/components/auth/FormKit';
import { cn } from '@/lib/utils';
import type { SecurityInfo } from '@/types';
import { t, intlLocale, tn } from '@/lib/i18n';

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never';

function relative(iso?: string | null) {
  if (!iso) return 'never';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return t("{days} days ago", { days });
  const months = Math.floor(days / 30);
  return months === 1 ? t("a month ago") : t("{months} months ago", { months });
}

function ChangePassword({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({ old_password: '', new_password: '', confirm_password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const change = useMutation({
    mutationFn: () => api.dashboard.changePassword(form),
    onSuccess: () => {
      toast.success(t("Password changed"));
      setForm({ old_password: '', new_password: '', confirm_password: '' });
      setErrors({});
      onDone();
    },
    onError: (e: any) => setErrors(flattenErrors(e?.response?.data)),
  });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!form.old_password) er.old_password = t("Enter your current password");
    if (form.new_password.length < 8) er.new_password = t("Use at least 8 characters");
    if (form.new_password !== form.confirm_password) er.confirm_password = t("Passwords do not match");
    setErrors(er);
    if (!Object.keys(er).length) change.mutate();
  };
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {errors.detail && <p className="text-sm text-destructive">{errors.detail}</p>}
      <Field label={t("Current password")} error={errors.old_password}>
        {(id) => <PasswordInput id={id} name="old_password" value={form.old_password} onChange={set('old_password')} autoComplete="current-password" showMeter={false} invalid={!!errors.old_password} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("New password")} error={errors.new_password}>
          {(id) => <PasswordInput id={id} name="new_password" value={form.new_password} onChange={set('new_password')} invalid={!!errors.new_password} />}
        </Field>
        <Field label={t("Confirm new password")} error={errors.confirm_password}>
          {(id) => <PasswordInput id={id} name="confirm_password" value={form.confirm_password} onChange={set('confirm_password')} showMeter={false} invalid={!!errors.confirm_password} />}
        </Field>
      </div>
      <div className="flex justify-end">
        <button type="submit" disabled={change.isPending} className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-primary px-4 text-[13.5px] font-medium text-primary-foreground shadow-button disabled:opacity-60">
          {change.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{' '}{t("Update password")}</button>
      </div>
    </form>
  );
}

function TwoFactorDialog({ enabled, open, onOpenChange, onDone }: { enabled: boolean; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const toggle = useMutation({
    mutationFn: () => api.dashboard.toggle2FA(password),
    onSuccess: (res) => {
      toast.success(res.is_2fa_enabled ? t("Two-step sign-in is on") : t("Two-step sign-in is off"));
      setPassword('');
      onOpenChange(false);
      onDone();
    },
    onError: (e: any) => setError(e?.response?.data?.password?.[0] || t("Could not update this setting")),
  });
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { onOpenChange(o); setError(null); setPassword(''); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-pop data-[state=open]:animate-in data-[state=open]:zoom-in-95">
          <div className="flex items-start justify-between">
            <Dialog.Title className="text-[17px] font-semibold">{enabled ? t("Turn off two-step sign-in?") : t("Turn on two-step sign-in")}</Dialog.Title>
            <Dialog.Close className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label={t("Close")}><X className="h-4 w-4" /></Dialog.Close>
          </div>
          <Dialog.Description className="mt-2 text-[13.5px] text-muted-foreground">
            {t("{value} Confirm your password to continue.", { value: enabled
              ? 'Your account will only be protected by your password.'
              : 'Each time you sign in, we will email you a 6-digit code to enter after your password.' })}</Dialog.Description>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!password) return setError(t("Enter your password"));
              toggle.mutate();
            }}
            className="mt-5 space-y-4"
          >
            <Field label={t("Password")} error={error ?? undefined}>
              {(id) => <PasswordInput id={id} name="confirm-password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" showMeter={false} invalid={!!error} />}
            </Field>
            <div className="flex justify-end gap-2">
              <Dialog.Close type="button" className="h-10 rounded-[10px] border px-4 text-[13.5px] font-medium hover:bg-muted">{t("Cancel")}</Dialog.Close>
              <button type="submit" disabled={toggle.isPending} className={cn('inline-flex h-10 items-center gap-2 rounded-[10px] px-4 text-[13.5px] font-medium shadow-sm disabled:opacity-60', enabled ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground')}>
                {toggle.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {enabled ? t("Turn off") : t("Turn on")}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function SecuritySettings() {
  const qc = useQueryClient();
  const [twoFaOpen, setTwoFaOpen] = useState(false);
  const security = useQuery<SecurityInfo>({ queryKey: ['dashboard-security'], queryFn: () => api.dashboard.getSecurity() });
  const refresh = () => qc.invalidateQueries({ queryKey: ['dashboard-security'] });

  const revoke = useMutation({
    mutationFn: () => api.dashboard.revokeOtherSessions(),
    onSuccess: (res) => {
      toast.success(res.revoked ? tn(res.revoked, 'Signed out 1 other session', 'Signed out {count} other sessions') : t("No other sessions were active"));
      refresh();
    },
  });

  if (security.isError) return <ErrorState onRetry={() => security.refetch()} />;
  const s = security.data;
  const others = (s?.active_sessions ?? []).filter((x) => !x.is_current).length;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <Panel title={t("Password")} description={s ? t("Last changed {relative}", { relative: relative(s.password_last_changed) }) : undefined} icon={KeyRound}>
          <ChangePassword onDone={refresh} />
        </Panel>

        <Panel
          title={t("Active sessions")}
          description={t("Devices that are signed in to your account")}
          icon={MonitorSmartphone}
          actions={
            others > 0 && (
              <button onClick={() => revoke.mutate()} disabled={revoke.isPending} className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-medium text-destructive hover:bg-destructive/5 disabled:opacity-60">
                {revoke.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}{' '}{t("Sign out others")}</button>
            )
          }
        >
          {security.isLoading ? (
            <SkeletonRows rows={3} />
          ) : s?.active_sessions.length ? (
            <ul className="divide-y">
              {s.active_sessions.map((sess) => {
                const mobile = /android|ios|iphone|mobile/i.test(sess.device);
                const Icon = mobile ? Smartphone : Laptop;
                return (
                  <li key={sess.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[14px] font-medium">
                        <span className="truncate">{sess.device}</span>
                        {sess.is_current && <StatusPill tone="success">{t("This device")}</StatusPill>}
                      </div>
                      <div className="text-xs text-muted-foreground">{t("{ip_address} · signed in {fmt}", { ip_address: sess.ip_address, fmt: fmt(sess.last_active) })}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[13.5px] text-muted-foreground">{t("No active sessions recorded.")}</p>
          )}
        </Panel>
      </div>

      <div className="space-y-6">
        <Panel title={t("Two-step sign-in")} icon={ShieldCheck}>
          {security.isLoading ? (
            <SkeletonRows rows={1} />
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <StatusPill tone={s?.is_2fa_enabled ? 'success' : 'neutral'}>{s?.is_2fa_enabled ? t("On") : t("Off")}</StatusPill>
                  <p className="mt-2 text-[13.5px] text-muted-foreground">
                    {s?.is_2fa_enabled ? t("A code is emailed to you every time you sign in.") : t("Add an emailed code to every sign-in for extra protection.")}
                  </p>
                </div>
              </div>
              <button onClick={() => setTwoFaOpen(true)} className="mt-4 inline-flex h-9 items-center rounded-[10px] border bg-card px-3.5 text-[13px] font-medium shadow-sm hover:bg-muted">
                {s?.is_2fa_enabled ? t("Turn off") : t("Turn on")}
              </button>
              <TwoFactorDialog enabled={!!s?.is_2fa_enabled} open={twoFaOpen} onOpenChange={setTwoFaOpen} onDone={refresh} />
            </>
          )}
        </Panel>

        <Panel title={t("Account activity")} icon={KeyRound}>
          <dl className="space-y-3 text-[13.5px]">
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t("Last sign-in")}</dt><dd className="text-right font-medium">{s ? fmt(s.last_login) : '—'}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t("Password changed")}</dt><dd className="text-right font-medium">{s ? fmt(s.password_last_changed) : '—'}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t("Active sessions")}</dt><dd className="tabular text-right font-medium">{s?.active_sessions.length ?? '—'}</dd></div>
          </dl>
        </Panel>
      </div>
    </div>
  );
}
