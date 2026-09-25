import React from 'react';
import { t } from './i18n';

/**
 * Translate a sentence that contains one styled phrase, marked `<em>…</em>`:
 *
 *   tRich('Your health record, <em>wherever</em> you are treated.', (c) => <span className="accent">{c}</span>)
 *
 * The whole sentence is one message, so translators can move the emphasised
 * phrase to wherever their grammar needs it.
 */
export function tRich(message: string, em: (chunk: string) => React.ReactNode, vars?: Record<string, string | number>): React.ReactNode {
  const text = t(message, vars);
  const parts = text.split(/<em>([\s\S]*?)<\/em>/);
  return parts.map((part, i) => (i % 2 === 1 ? <React.Fragment key={i}>{em(part)}</React.Fragment> : part));
}
