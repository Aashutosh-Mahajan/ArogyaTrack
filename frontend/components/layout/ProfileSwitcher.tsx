'use client';

import React from 'react';
import Link from 'next/link';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Check, ChevronsUpDown, UserPlus, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';
import { initialsOf } from './useShell';
import { t } from '@/lib/i18n';

interface ProfileLite {
  id: string;
  name: string;
  relationship: string;
  patient_id?: string;
}

const REL: Record<string, string> = { get self() { return t("You"); }, get child() { return t("Child"); }, get parent() { return t("Parent"); }, get spouse() { return t("Spouse"); }, get sibling() { return t("Sibling"); }, get other() { return t("Family"); } };

/** Lets a patient act on behalf of a family member; every patient view follows the active profile. */
export function ProfileSwitcher() {
  const queryClient = useQueryClient();
  const updateUser = useAuthStore((s) => s.updateUser);

  const { data } = useQuery({
    queryKey: ['my-profiles'],
    queryFn: () => api.patients.getMyProfiles() as Promise<{ active_profile_id: string | null; profiles: ProfileLite[] }>,
    staleTime: 5 * 60_000,
  });

  const switchTo = useMutation({
    mutationFn: (id: string) => api.patients.switchProfile(id),
    onSuccess: async (_res, id) => {
      const next = data?.profiles.find((p) => p.id === id);
      if (next) {
        const [first, ...rest] = next.name.split(' ');
        updateUser({ first_name: first, last_name: rest.join(' ') });
        toast.success(t("Now viewing {name}", { name: next.name }));
      }
      // Everything patient-scoped depends on the active profile.
      await queryClient.invalidateQueries();
    },
  });

  const profiles = data?.profiles ?? [];
  if (profiles.length === 0) return null;
  const active = profiles.find((p) => String(p.id) === String(data?.active_profile_id)) ?? profiles[0];

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="flex h-9 max-w-[220px] items-center gap-2 rounded-lg border bg-card pl-1.5 pr-2 text-left shadow-sm outline-none transition-colors hover:bg-muted data-[state=open]:bg-muted"
        aria-label={t("Switch family profile")}
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent text-[10px] font-semibold text-accent-foreground">
          {initialsOf(active.name)}
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block truncate text-[12.5px] font-semibold leading-tight">{active.name}</span>
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="z-50 w-64 rounded-xl border bg-popover p-1 shadow-pop animate-in fade-in-0 zoom-in-95">
          <div className="flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-muted-foreground">
            <Users className="h-3.5 w-3.5" />{' '}{t("Family profiles")}</div>
          {profiles.map((p) => {
            const isActive = p.id === active.id;
            return (
              <DropdownMenu.Item
                key={p.id}
                disabled={switchTo.isPending}
                onSelect={() => !isActive && switchTo.mutate(p.id)}
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] outline-none data-[highlighted]:bg-muted',
                  isActive && 'bg-primary/5'
                )}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-[11px] font-semibold text-accent-foreground">
                  {initialsOf(p.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="block text-[11.5px] text-muted-foreground">{REL[p.relationship] ?? p.relationship}</span>
                </span>
                {isActive && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenu.Item>
            );
          })}
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item asChild className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-primary outline-none data-[highlighted]:bg-muted">
            <Link href="/dashboard/profile?add=1">
              <UserPlus className="h-4 w-4" />{' '}{t("Add family member")}</Link>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
