# Interface translations

The web app is available in English, Hindi, Marathi, Tamil, Telugu and Bengali.
Users pick a language from the language menu (top bar in the portals, top right on
public pages); the choice is saved in the browser.

## Writing UI text

Messages are keyed by their English text:

```tsx
import { t, tn, m } from '@/lib/i18n';
import { tRich } from '@/lib/i18n-rich';

t('Save changes')
t('Good morning, {name}', { name })                         // placeholders
tn(count, '1 invoice', '{count} invoices')                 // singular / plural
const STEPS = [m('About you'), m('Health history')]         // static lists: mark, then render with t(step)
tRich('Create your <em>health ID.</em>', (c) => <span className="font-serif-accent">{c}</span>)
```

- Keep each sentence in **one** message (use placeholders, not string concatenation) —
  word order differs between languages.
- Values saved to the database (e.g. prescription frequencies) stay in English; only
  the displayed label goes through `t()`.
- Dates and numbers: use `intlLocale()` instead of `'en-IN'`.

## Updating the catalogs

After adding or changing UI text:

```bash
# 1. collect messages
node scripts/i18n/extract-frontend.js > scripts/i18n/frontend-messages.json
cd ../backend && python scripts/extract_i18n_messages.py > ../frontend/scripts/i18n/backend-messages.json

# 2. translate only what is new (uses AI_API_KEY / AI_BASE_URL / AI_MODEL from backend/.env)
python scripts/translate_ui.py            # or: python scripts/translate_ui.py hi ta
```

Catalogs live in `locales/<code>.json` (English message → translation). Anything
missing falls back to English. Translations are machine-generated; have a native
speaker review clinical wording before relying on it.
