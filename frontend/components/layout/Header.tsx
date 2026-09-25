'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Bell, ChevronDown, Languages, LogOut, Menu, ShieldCheck, User } from 'lucide-react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useAuthStore } from '@/store/authStore';
import { ThemeToggle } from '@/components/ThemeToggle';
import { roleLabel } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { findNavItem, portalFor, portalNav } from './nav';
import { displayName, initialsOf, useLogout, useShellCounts } from './useShell';
import { ProfileSwitcher } from './ProfileSwitcher';
import { t as tr } from '@/lib/i18n';

const menuItem =
  'flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-foreground outline-none transition-colors data-[highlighted]:bg-muted';

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const pathname = usePathname() || '';
  const { t } = useLanguage();
  const user = useAuthStore((s) => s.user);
  const portal = portalFor(user?.role, pathname);
  const counts = useShellCounts(portal);
  const logout = useLogout();

  const current = findNavItem(portal, pathname);
  const title = current ? t(current.label) : t('Workspace');
  const name = displayName(user);

  const alertsHref =
    portal === 'patient' ? '/dashboard/alerts' : portal === 'admin' ? '/admin/alerts' : null;
  const alertCount = portal === 'patient' ? counts.patientAlerts : portal === 'admin' ? counts.surveillanceAlerts : 0;
  const profileHref = portal === 'patient' ? '/dashboard/profile' : null;
  const securityHref =
    portal === 'doctor' ? '/doctor/security' : portal === 'patient' ? '/dashboard/security' : null;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-xl md:px-8">
      <button
        type="button"
        onClick={onMenuClick}
        className="-ml-1 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
        aria-label={tr("Open menu")}
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="min-w-0">
        <div className="hidden text-[11.5px] font-medium text-muted-foreground sm:block">
          {t(portalNav[portal].title)}
        </div>
        <div className="truncate text-[15px] font-semibold leading-tight tracking-tight text-foreground">{title}</div>
      </div>

      <div className="flex-1" />

      {portal === 'patient' && <ProfileSwitcher />}

      <LanguageSwitcher />

      <ThemeToggle className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" />

      {alertsHref && (
        <Link
          href={alertsHref}
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={alertCount ? tr("{alertCount} unread alerts", { alertCount }) : tr("Alerts")}
        >
          <Bell className="h-[18px] w-[18px]" />
          {alertCount > 0 && (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
          )}
        </Link>
      )}

      <div className="mx-1 hidden h-6 w-px bg-border sm:block" />

      <DropdownMenu.Root>
        <DropdownMenu.Trigger className="flex items-center gap-2.5 rounded-xl py-1 pl-1 pr-2 outline-none transition-colors hover:bg-muted data-[state=open]:bg-muted">
          <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-gradient-to-br from-primary to-primary/70 text-xs font-semibold text-primary-foreground">
            {initialsOf(name)}
          </span>
          <span className="hidden text-left md:block">
            <span className="block max-w-[160px] truncate text-[13px] font-semibold leading-tight text-foreground">{name}</span>
            <span className="block text-[11px] leading-tight text-muted-foreground">{roleLabel(user?.role)}</span>
          </span>
          <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground md:block" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={8} className="z-50 w-60 rounded-xl border bg-popover p-1 shadow-pop animate-in fade-in-0 zoom-in-95">
            <div className="px-2.5 py-2">
              <div className="truncate text-[13px] font-semibold">{name}</div>
              <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
            </div>
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            {profileHref && (
              <DropdownMenu.Item asChild className={menuItem}>
                <Link href={profileHref}>
                  <User className="h-4 w-4 text-muted-foreground" />{' '}{tr("Profile")}</Link>
              </DropdownMenu.Item>
            )}
            {securityHref && (
              <DropdownMenu.Item asChild className={menuItem}>
                <Link href={securityHref}>
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />{' '}{tr("Security")}</Link>
              </DropdownMenu.Item>
            )}
            {(profileHref || securityHref) && <DropdownMenu.Separator className="my-1 h-px bg-border" />}
            <DropdownMenu.Item onSelect={logout} className={cn(menuItem, 'text-destructive data-[highlighted]:bg-destructive/10')}>
              <LogOut className="h-4 w-4" /> {t("Logout")}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </header>
  );
}
