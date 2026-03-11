'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { SecurityInfo } from '@/types';
import {
  FiShield,
  FiLock,
  FiSmartphone,
  FiMonitor,
  FiEye,
  FiEyeOff,
  FiCheck,
  FiClock,
  FiGlobe,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

/* ── Skeleton ─────────────────────────────────────────────── */

function SecuritySkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-xl border bg-white p-6">
          <div className="h-5 w-40 bg-gray-200 rounded mb-4" />
          <div className="space-y-3">
            <div className="h-4 w-full bg-gray-100 rounded" />
            <div className="h-4 w-3/4 bg-gray-100 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Change Password Form ─────────────────────────────────── */

function ChangePasswordForm() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      api.dashboard.changePassword({
        old_password: oldPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      }),
    onSuccess: () => {
      toast.success('Password changed successfully');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      queryClient.invalidateQueries({ queryKey: ['dashboard-security'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to change password';
      toast.error(msg);
    },
  });

  const canSubmit =
    oldPassword.length > 0 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword &&
    !mutation.isPending;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="space-y-4"
    >
      {/* Old password */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Current Password
        </label>
        <div className="relative">
          <input
            type={showOld ? 'text' : 'password'}
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-10 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            placeholder="Enter current password"
          />
          <button
            type="button"
            onClick={() => setShowOld(!showOld)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showOld ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* New password */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          New Password
        </label>
        <div className="relative">
          <input
            type={showNew ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-10 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            placeholder="Minimum 8 characters"
          />
          <button
            type="button"
            onClick={() => setShowNew(!showNew)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showNew ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
          </button>
        </div>
        {newPassword.length > 0 && newPassword.length < 8 && (
          <p className="mt-1 text-xs text-red-500">Must be at least 8 characters</p>
        )}
      </div>

      {/* Confirm password */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Confirm New Password
        </label>
        <div className="relative">
          <input
            type={showConfirm ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-10 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            placeholder="Re-enter new password"
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showConfirm ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
          </button>
        </div>
        {confirmPassword.length > 0 && confirmPassword !== newPassword && (
          <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
        )}
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {mutation.isPending ? 'Changing…' : 'Change Password'}
      </button>
    </form>
  );
}

/* ── Helper ────────────────────────────────────────────────── */

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/* ── Main Component ───────────────────────────────────────── */

export function SecuritySettings() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<SecurityInfo>({
    queryKey: ['dashboard-security'],
    queryFn: () => api.dashboard.getSecurity(),
    staleTime: 30_000,
  });

  const toggle2FA = useMutation({
    mutationFn: () => api.dashboard.toggle2FA(),
    onSuccess: (res) => {
      toast.success(res.is_2fa_enabled ? '2FA enabled' : '2FA disabled');
      queryClient.invalidateQueries({ queryKey: ['dashboard-security'] });
    },
    onError: () => toast.error('Failed to update 2FA setting'),
  });

  if (isLoading) return <SecuritySkeleton />;
  if (isError || !data) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center">
        <FiShield className="mx-auto h-10 w-10 text-gray-300" />
        <p className="mt-2 text-sm text-gray-500">Unable to load security settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Login & Password Info ──────────────────────────── */}
      <div className="rounded-xl border bg-white shadow-sm">
        <div className="border-b px-6 py-4">
          <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <FiShield className="h-5 w-5 text-primary-600" />
            Account Security
          </h3>
        </div>
        <div className="divide-y">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                <FiClock className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Last Login</p>
                <p className="text-xs text-gray-500">
                  {data.last_login
                    ? new Date(data.last_login).toLocaleString()
                    : 'Never'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50">
                <FiLock className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Password Last Changed</p>
                <p className="text-xs text-gray-500">
                  {data.password_last_changed
                    ? new Date(data.password_last_changed).toLocaleString()
                    : 'Never changed'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50">
                <FiSmartphone className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Two-Factor Authentication</p>
                <p className="text-xs text-gray-500">
                  {data.is_2fa_enabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                Coming Soon
              </span>
              <button
                onClick={() => toggle2FA.mutate()}
                disabled={toggle2FA.isPending}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  data.is_2fa_enabled ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    data.is_2fa_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Active Sessions ────────────────────────────────── */}
      <div className="rounded-xl border bg-white shadow-sm">
        <div className="border-b px-6 py-4">
          <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <FiMonitor className="h-5 w-5 text-primary-600" />
            Active Sessions
            <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {data.active_sessions.length}
            </span>
          </h3>
        </div>
        <div className="divide-y">
          {data.active_sessions.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <FiMonitor className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">No active sessions found.</p>
            </div>
          ) : (
            data.active_sessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between px-6 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50">
                    <FiMonitor className="h-4 w-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{session.device}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <FiGlobe className="h-3 w-3" />
                      <span>{session.ip_address}</span>
                      <span className="text-gray-300">•</span>
                      <span>{timeAgo(session.last_active)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-green-600">
                  <FiCheck className="h-3 w-3" />
                  Active
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Change Password ────────────────────────────────── */}
      <div className="rounded-xl border bg-white shadow-sm">
        <div className="border-b px-6 py-4">
          <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <FiLock className="h-5 w-5 text-primary-600" />
            Change Password
          </h3>
        </div>
        <div className="px-6 py-5">
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
