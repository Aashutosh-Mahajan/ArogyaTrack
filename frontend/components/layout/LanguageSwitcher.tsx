'use client';

import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, Languages } from 'lucide-react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { LANGUAGES, t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Language menu used in the app header and on public pages. */
export function LanguageSwitcher({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { language, setLanguage } = useLanguage();
  const current = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={cn(
          'flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground data-[state=open]:bg-muted',
          className
        )}
        aria-label={t('Change language')}
      >
        <Languages className="h-4 w-4" />
        {!compact && <span className="hidden sm:inline">{current.label}</span>}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="z-50 min-w-[190px] rounded-xl border bg-popover p-1 shadow-pop animate-in fade-in-0 zoom-in-95">
          {LANGUAGES.map((l) => (
            <DropdownMenu.Item
              key={l.code}
              onSelect={() => setLanguage(l.code)}
              lang={l.code}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-[13.5px] outline-none data-[highlighted]:bg-muted"
            >
              <span>
                {l.label}
                {l.code !== 'en' && <span className="ml-2 text-xs text-muted-foreground">{l.english}</span>}
              </span>
              {language === l.code && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
