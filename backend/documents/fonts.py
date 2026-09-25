"""Fonts for generated PDFs.

Noto Sans covers Latin text; prescriptions can also be printed in Hindi,
Marathi, Tamil, Telugu and Bengali, which need their own Noto fonts and
HarfBuzz shaping (via ``uharfbuzz``) so conjuncts and vowel signs join
correctly. The Indic fonts have no Latin punctuation, so `markup` switches
font per run of script.
"""

from pathlib import Path
from xml.sax.saxutils import escape

from django.conf import settings
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.fonts import addMapping

FONT_DIR = Path(settings.BASE_DIR) / "assets" / "fonts"

BASE = "NotoSans"

# Font family -> Unicode ranges it should render.
SCRIPT_FONTS = {
    "NotoSansDevanagari": ((0x0900, 0x097F), (0xA8E0, 0xA8FF), (0x1CD0, 0x1CFF)),
    "NotoSansBengali": ((0x0980, 0x09FF),),
    "NotoSansTamil": ((0x0B80, 0x0BFF),),
    "NotoSansTelugu": ((0x0C00, 0x0C7F),),
}

# Joiners stay with the run they sit in.
_JOINERS = {"‌", "‍"}

_registered = False


def register_fonts():
    """Register Noto Sans and the Indic families once per process."""
    global _registered
    if _registered:
        return
    for family in (BASE, *SCRIPT_FONTS):
        regular = TTFont(family, FONT_DIR / f"{family}-Regular.ttf")
        bold = TTFont(f"{family}-Bold", FONT_DIR / f"{family}-Bold.ttf")
        for font in (regular, bold):
            font.shapable = True
            pdfmetrics.registerFont(font)
        addMapping(family, 0, 0, family)
        addMapping(family, 1, 0, f"{family}-Bold")
        addMapping(family, 0, 1, family)
        addMapping(family, 1, 1, f"{family}-Bold")
    _registered = True


def _family_of(ch):
    code = ord(ch)
    for family, ranges in SCRIPT_FONTS.items():
        for lo, hi in ranges:
            if lo <= code <= hi:
                return family
    return None


def markup(text):
    """Escape `text` for a Paragraph, wrapping Indic runs in their font.

    Newlines become line breaks. None renders as an empty string.
    """
    if text is None:
        return ""
    text = str(text)
    out, run, current = [], [], None

    def flush():
        if not run:
            return
        chunk = escape("".join(run)).replace("\n", "<br/>")
        out.append(f'<font face="{current}">{chunk}</font>' if current else chunk)
        run.clear()

    for ch in text:
        family = current if ch in _JOINERS else _family_of(ch)
        if family != current:
            flush()
            current = family
        run.append(ch)
    flush()
    return "".join(out)
