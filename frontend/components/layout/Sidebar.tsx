'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, X } from 'lucide-react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { useAuthStore } from '@/store/authStore';
import { Logo } from '@/components/brand/Logo';
import { cn } from '@/lib/utils';
import { roleLabel } from '@/lib/roles';
import { isNavActive, portalFor, portalNav, type NavItem } from './nav';
import { displayName, initialsOf, useLogout, useShellCounts } from './useShell';
import { t as tr } from '@/lib/i18n';

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname() || '';
  const { t } = useLanguage();
  const user = useAuthStore((s) => s.user);
  const portal = portalFor(user?.role, pathname);
  const config = portalNav[portal];
  const counts = useShellCounts(portal);
  const logout = useLogout();

  const name = displayName(user);
  const label = (item: NavItem) => t(item.label);

  return (
    <>
      {/* Mobile scrim */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={cn(
          'fixed inset-0 z-40 bg-foreground/30 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col border-r bg-card transition-transform duration-300 ease-spring lg:translate-x-0',
          open ? 'translate-x-0 shadow-ambient-lg' : '-translate-x-full'
        )}
        aria-label={tr("Primary")}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Logo />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
            aria-label={tr("Close menu")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pb-3">
          <div className="flex items-center gap-2 rounded-lg bg-muted/70 px-3 py-2 text-xs font-medium text-muted-foreground">
            <span className="live-dot" />
            {t(config.title)}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-none">
          {config.groups.filter((g) => !g.roles || g.roles.includes(user?.role ?? '')).map((group) => (
            <div key={group.label} className="mt-4 first:mt-1">
              <div className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-[0.09em] text-muted-foreground/80">
                {t(group.label)}
              </div>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isNavActive(item, pathname);
                  const Icon = item.icon;
                  const count = item.badge ? counts[item.badge] : 0;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'group relative flex items-center gap-3 rounded-[10px] px-3 py-2 text-[13.5px] font-medium transition-colors duration-150',
                          active
                            ? 'bg-primary/10 text-primary'
                            : 'text-foreground/70 hover:bg-muted hover:text-foreground'
                        )}
                      >
                        {active && (
                          <span className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
                        )}
                        <Icon
                          className={cn(
                            'h-[18px] w-[18px] shrink-0 transition-colors',
                            active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                          )}
                          strokeWidth={1.8}
                        />
                        <span className="flex-1 truncate">{label(item)}</span>
                        {count > 0 && (
                          <span className="tabular min-w-[20px] rounded-md bg-destructive px-1.5 py-0.5 text-center text-[10.5px] font-semibold leading-none text-destructive-foreground">
                            {count > 99 ? '99+' : count}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-primary to-primary/70 text-[13px] font-semibold text-primary-foreground">
              {initialsOf(name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-foreground">{name}</div>
              <div className="truncate text-[11.5px] text-muted-foreground">{roleLabel(user?.role)}</div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              aria-label={t("Logout")}
              title={t("Logout")}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
