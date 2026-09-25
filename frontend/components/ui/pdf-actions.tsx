'use client';

import React, { useState } from 'react';
import { Download, Eye, Loader2 } from 'lucide-react';
import { getPdf } from '@/lib/documents';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';

interface PdfActionsProps {
  path: string;
  fileName: string;
  /** Called after a successful view or download (e.g. to refresh download counts). */
  onDone?: () => void;
  size?: 'sm' | 'md';
  labels?: boolean;
  className?: string;
}

/** "View" and "Download PDF" buttons for a server-generated document. */
export function PdfActions({ path, fileName, onDone, size = 'sm', labels = true, className }: PdfActionsProps) {
  const [busy, setBusy] = useState<'view' | 'download' | null>(null);
  const run = async (mode: 'view' | 'download') => {
    setBusy(mode);
    const ok = await getPdf(path, fileName, mode);
    setBusy(null);
    if (ok) onDone?.();
  };
  const btn = cn(
    'inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium transition-colors hover:bg-muted disabled:opacity-60',
    size === 'sm' ? 'h-8 px-2.5 text-[12.5px]' : 'h-10 px-3.5 text-[13.5px]'
  );
  return (
    <div className={cn('inline-flex gap-1.5', className)}>
      <button type="button" onClick={() => run('view')} disabled={!!busy} className={btn} aria-label={t("View {fileName}", { fileName })}>
        {busy === 'view' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
        {labels && <span className="hidden sm:inline">{t("View")}</span>}
      </button>
      <button type="button" onClick={() => run('download')} disabled={!!busy} className={cn(btn, 'border-primary/40 bg-primary/5 text-primary hover:bg-primary/10')} aria-label={t("Download {fileName}", { fileName })}>
        {busy === 'download' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        {labels && <span className="hidden sm:inline">{t("PDF")}</span>}
      </button>
    </div>
  );
}
