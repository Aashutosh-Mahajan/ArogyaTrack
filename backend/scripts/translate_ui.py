"""Translate the web app's interface messages with the configured LLM.

Reads the message lists produced by the extractors and fills
``frontend/locales/<lang>.json`` (English message -> translation). Only
messages missing from a catalog are sent, so re-running after UI changes
translates just the new text. Every translation must keep the message's
``{placeholders}``; anything that fails validation is left out and the app
falls back to English for it.

Usage (from backend/):
    python scripts/translate_ui.py                 # all languages
    python scripts/translate_ui.py hi ta           # selected languages
    python scripts/translate_ui.py --retranslate hi  # redo a language

Uses AI_API_KEY / AI_BASE_URL / AI_MODEL from backend/.env. Only interface
text is sent — never patient data.
"""

import json
import os
import re
import sys
import warnings
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

warnings.filterwarnings("ignore")
BACKEND = Path(__file__).resolve().parent.parent
FRONTEND = BACKEND.parent / "frontend"
sys.path.insert(0, str(BACKEND))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from config.ai import ai_chat, ai_configured  # noqa: E402

LANGUAGES = {"hi": "Hindi", "mr": "Marathi", "ta": "Tamil", "te": "Telugu", "bn": "Bengali"}
BATCH = 40
WORKERS = 6
PLACEHOLDER = re.compile(r"\{(\w+)\}")

SYSTEM = """You translate the user interface of ArogyaTrack, an Indian digital health platform used by patients, doctors, pharmacists and public-health officials, from English into {language}.

Rules:
- Return ONLY a JSON object mapping each input key to its translation.
- Keep every placeholder in curly braces exactly as written, e.g. {{name}}, {{count}}; move it to wherever the {language} grammar needs it. Never translate or drop a placeholder.
- Keep leading and trailing spaces and punctuation such as "· ", " — ", "…", "→", "(", ")" exactly where they are.
- Write natural, everyday {language} that a patient with basic literacy understands, in the polite/respectful register used by Indian public-health apps. Keep it as short as the English (these are buttons, labels and messages).
- Use {language} script. Keep widely used English/technical terms in Latin letters when that is what Indian users actually say or when no common native word exists: QR, PDF, OTP, GST, GSTIN, HSN, ICD-10, HbA1c, BMI, UPI, CSV, ZIP, AI, ID, 2FA, units such as mg, mg/dL, mmHg, kg, %, and medicine or brand names (ArogyaTrack, Paracetamol, Prophet, DBSCAN, XGBoost, Isolation Forest).
- Write "email" in the local script as Indian apps do (e.g. Hindi ईमेल) rather than in Latin letters.
- Never translate or transliterate the product name ArogyaTrack.
- Translate disease names into their common {language} names when a well-known one exists; otherwise keep the English name.
- Do not translate example values such as email addresses, IDs (HS-2026-XXXXXX), licence numbers or GSTIN samples.
- Numbers stay in Western digits (0-9).
"""


def load(path, default):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except FileNotFoundError:
        return default


def valid(src, dst):
    if not isinstance(dst, str) or not dst.strip():
        return False
    return sorted(PLACEHOLDER.findall(src)) == sorted(PLACEHOLDER.findall(dst))


def restore_edges(src, dst):
    """Keep the source's leading/trailing whitespace (models often trim it)."""
    lead = src[: len(src) - len(src.lstrip())]
    trail = src[len(src.rstrip()):]
    return lead + dst.strip() + trail


def translate_batch(lang, batch):
    payload = {str(i): m for i, m in enumerate(batch)}
    raw = ai_chat(
        [
            {"role": "system", "content": SYSTEM.format(language=LANGUAGES[lang])},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
        ],
        default_model="gpt-4.1",
        temperature=0.2,
        max_tokens=16000,
        json_mode=True,
        timeout=240,
    )
    data = json.loads(raw[raw.find("{"): raw.rfind("}") + 1])
    out, bad = {}, []
    for i, src in enumerate(batch):
        dst = data.get(str(i))
        if valid(src, dst):
            out[src] = restore_edges(src, dst)
        else:
            bad.append(src)
    return out, bad


def main():
    if not ai_configured():
        sys.exit("AI_API_KEY is not set in backend/.env")
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    retranslate = "--retranslate" in sys.argv
    langs = args or list(LANGUAGES)

    msgs = {m["message"] for m in load(FRONTEND / "scripts/i18n/frontend-messages.json", [])}
    msgs |= {m["message"] for m in load(FRONTEND / "scripts/i18n/backend-messages.json", [])}
    messages = sorted(msgs)
    seeds = load(FRONTEND / "scripts/i18n/seeds.json", {})

    for lang in langs:
        path = FRONTEND / "locales" / f"{lang}.json"
        catalog = {} if retranslate else load(path, {})
        # Drop messages the UI no longer uses.
        catalog = {k: v for k, v in catalog.items() if k in msgs}
        for src, dst in seeds.get(lang, {}).items():
            if src in msgs and src not in catalog and valid(src, dst):
                catalog[src] = dst
        todo = [m for m in messages if m not in catalog]
        print(f"[{lang}] {len(catalog)} cached, {len(todo)} to translate", flush=True)

        failed = []
        batches = [todo[i:i + BATCH] for i in range(0, len(todo), BATCH)]
        with ThreadPoolExecutor(WORKERS) as pool:
            futures = {pool.submit(translate_batch, lang, b): b for b in batches}
            for n, fut in enumerate(as_completed(futures), 1):
                try:
                    out, bad = fut.result()
                    catalog.update(out)
                    failed += bad
                except Exception as exc:  # retried below
                    failed += futures[fut]
                    print(f"[{lang}] batch failed: {type(exc).__name__}: {str(exc)[:120]}", flush=True)
                if n % 5 == 0 or n == len(batches):
                    print(f"[{lang}] {n}/{len(batches)} batches", flush=True)
                    path.write_text(json.dumps(dict(sorted(catalog.items())), ensure_ascii=False, indent=1), encoding="utf-8")

        # One retry, in small batches, for anything that failed validation.
        if failed:
            retry = [failed[i:i + 10] for i in range(0, len(failed), 10)]
            still = []
            for b in retry:
                try:
                    out, bad = translate_batch(lang, b)
                    catalog.update(out)
                    still += bad
                except Exception:
                    still += b
            if still:
                print(f"[{lang}] left in English ({len(still)}): {still[:5]}", flush=True)

        path.write_text(json.dumps(dict(sorted(catalog.items())), ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"[{lang}] done: {len(catalog)}/{len(messages)} messages", flush=True)


if __name__ == "__main__":
    main()
