/**
 * Interface translations.
 *
 * Messages are keyed by their English text: `t('Save changes')`. Values are
 * interpolated from `{name}` placeholders: `t('Good morning, {name}', { name })`.
 * English needs no catalog; other languages load `locales/<code>.json` on
 * demand and fall back to English for anything missing.
 *
 * `t` is a plain function (usable in any component or helper). The
 * LanguageProvider remounts the page when the language changes, so every
 * component re-renders with the new catalog.
 */

export const LANGUAGES = [
  { code: 'en', label: 'English', english: 'English' },
  { code: 'hi', label: 'हिन्दी', english: 'Hindi' },
  { code: 'mr', label: 'मराठी', english: 'Marathi' },
  { code: 'ta', label: 'தமிழ்', english: 'Tamil' },
  { code: 'te', label: 'తెలుగు', english: 'Telugu' },
  { code: 'bn', label: 'বাংলা', english: 'Bengali' },
] as const;

export type Language = (typeof LANGUAGES)[number]['code'];

export const isLanguage = (v: unknown): v is Language => LANGUAGES.some((l) => l.code === v);

let current: Language = 'en';
let catalog: Record<string, string> = {};

type Vars = Record<string, string | number | null | undefined>;

function interpolate(message: string, vars?: Vars) {
  if (!vars) return message;
  return message.replace(/\{(\w+)\}/g, (match, key) => (key in vars && vars[key] != null ? String(vars[key]) : match));
}

/** Translate an English interface message into the current language. */
export function t(message: string, vars?: Vars): string {
  if (!message) return message;
  const translated = current === 'en' ? message : catalog[message] || message;
  return interpolate(translated, vars);
}

/**
 * Mark a message for translation without translating it yet — for static
 * lists whose values are rendered later with `t(value)` (or stored as data
 * in English, like prescription frequencies).
 */
export const m = (message: string): string => message;

/** Choose the singular or plural message by `count` and interpolate `{count}`. */
export function tn(count: number, one: string, other: string, vars?: Vars): string {
  return t(count === 1 ? one : other, { count, ...vars });
}

export function getLanguage(): Language {
  return current;
}

/** Load the catalog for `lang` and make it current. */
export async function loadLanguage(lang: Language): Promise<void> {
  if (lang === 'en') {
    catalog = {};
  } else {
    const mod = await import(`../locales/${lang}.json`);
    catalog = (mod.default ?? mod) as Record<string, string>;
  }
  current = lang;
}

/**
 * Locale for Intl/`toLocale*String` calls: Indian formats in the current
 * language, always with Latin digits so clinical numbers stay unambiguous.
 */
export function intlLocale(): string {
  return current === 'en' ? 'en-IN' : `${current}-IN-u-nu-latn`;
}
