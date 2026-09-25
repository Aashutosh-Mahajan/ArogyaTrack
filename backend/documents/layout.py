"""Branded A4 layout shared by every generated PDF."""

from io import BytesIO

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

from .fonts import BASE, markup, register_fonts

# Brand palette (matches the web app).
TEAL = colors.HexColor("#107063")
TEAL_DARK = colors.HexColor("#0b3b34")
TEAL_TINT = colors.HexColor("#eaf5f2")
INK = colors.HexColor("#0f1e1c")
MUTED = colors.HexColor("#5b6b69")
RULE = colors.HexColor("#dfe7e6")
ZEBRA = colors.HexColor("#f6f9f8")
RED = colors.HexColor("#b42318")
RED_TINT = colors.HexColor("#fdecea")
AMBER = colors.HexColor("#a15c07")
AMBER_TINT = colors.HexColor("#fdf3e3")
GREEN = colors.HexColor("#0f7a4a")

PAGE_W, PAGE_H = A4
MARGIN_X = 18 * mm
CONTENT_W = PAGE_W - 2 * MARGIN_X


def _style(name, **kw):
    kw.setdefault("fontName", BASE)
    kw.setdefault("fontSize", 9.5)
    kw.setdefault("leading", kw["fontSize"] * 1.42)
    kw.setdefault("textColor", INK)
    kw.setdefault("shaping", 1)
    return ParagraphStyle(name, **kw)


class Styles:
    def __init__(self):
        register_fonts()
        self.title = _style("title", fontSize=19, leading=23, fontName=f"{BASE}-Bold")
        self.subtitle = _style("subtitle", fontSize=10, textColor=MUTED)
        self.section = _style("section", fontSize=8, leading=10, fontName=f"{BASE}-Bold", textColor=TEAL)
        self.body = _style("body")
        self.small = _style("small", fontSize=8, textColor=MUTED)
        self.label = _style("label", fontSize=7.5, leading=9.5, textColor=MUTED)
        self.value = _style("value", fontSize=10, leading=13.5, fontName=f"{BASE}-Bold")
        self.value_right = _style("value_right", fontSize=10, leading=13.5, fontName=f"{BASE}-Bold", alignment=TA_RIGHT)
        self.cell = _style("cell", fontSize=8.8)
        self.cell_bold = _style("cell_bold", fontSize=8.8, fontName=f"{BASE}-Bold")
        self.cell_muted = _style("cell_muted", fontSize=7.8, textColor=MUTED)
        self.cell_right = _style("cell_right", fontSize=8.8, alignment=TA_RIGHT)
        self.cell_right_bold = _style("cell_right_bold", fontSize=8.8, alignment=TA_RIGHT, fontName=f"{BASE}-Bold")
        self.head = _style("head", fontSize=7.5, leading=9.5, fontName=f"{BASE}-Bold", textColor=MUTED)
        self.head_right = _style("head_right", fontSize=7.5, leading=9.5, fontName=f"{BASE}-Bold", textColor=MUTED, alignment=TA_RIGHT)


def P(text, style):
    """Paragraph from plain text (escaped, script-aware)."""
    return Paragraph(markup(text), style)


def _draw_mark(c, x, y, size):
    """The ArogyaTrack mark: pulse line on a rounded teal square."""
    c.setFillColor(TEAL)
    c.roundRect(x, y, size, size, size * 0.24, stroke=0, fill=1)
    s = size / 32.0
    c.setStrokeColor(colors.white)
    c.setLineWidth(2.6 * s)
    c.setLineCap(1)
    c.setLineJoin(1)
    pts = [(4, 15), (9, 15), (12, 23), (17, 8), (20.2, 17.4), (21.6, 15), (28, 15)]
    path = c.beginPath()
    path.moveTo(x + pts[0][0] * s, y + pts[0][1] * s)
    for px, py in pts[1:]:
        path.lineTo(x + px * s, y + py * s)
    c.drawPath(path, stroke=1, fill=0)


class _NumberedCanvas(pdfcanvas.Canvas):
    """Canvas that knows the total page count when drawing footers."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved = []

    def showPage(self):
        self._saved.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._saved)
        for state in self._saved:
            self.__dict__.update(state)
            self._draw_page_number(total)
            super().showPage()
        super().save()

    def _draw_page_number(self, total):
        self.setFont(BASE, 7.5)
        self.setFillColor(MUTED)
        self.drawRightString(PAGE_W - MARGIN_X, 11 * mm, f"Page {self._pageNumber} of {total}")


def local_time(value=None):
    """`value` (default: now) in the document time zone (India by default)."""
    from zoneinfo import ZoneInfo

    from django.conf import settings

    value = value or timezone.now()
    if timezone.is_naive(value):
        return value
    return value.astimezone(ZoneInfo(settings.DOCUMENT_TIME_ZONE))


def build_pdf(story, *, title, reference="", footer_note="Confidential health information. Handle as per data protection policy."):
    """Render `story` onto branded A4 pages and return the PDF bytes."""
    register_fonts()
    buf = BytesIO()
    generated = local_time().strftime("%d %b %Y, %I:%M %p")

    def on_page(c, doc):
        c.saveState()
        top = PAGE_H - 14 * mm
        _draw_mark(c, MARGIN_X, top - 7 * mm, 8.5 * mm)
        c.setFillColor(INK)
        c.setFont(f"{BASE}-Bold", 12.5)
        c.drawString(MARGIN_X + 11 * mm, top - 3.2 * mm, "ArogyaTrack")
        c.setFont(BASE, 7.5)
        c.setFillColor(MUTED)
        c.drawString(MARGIN_X + 11 * mm, top - 7 * mm, "Connected care and health surveillance")
        c.setFont(f"{BASE}-Bold", 9)
        c.setFillColor(TEAL)
        c.drawRightString(PAGE_W - MARGIN_X, top - 3.2 * mm, title.upper())
        if reference:
            c.setFont(BASE, 8)
            c.setFillColor(MUTED)
            c.drawRightString(PAGE_W - MARGIN_X, top - 7 * mm, reference)
        c.setStrokeColor(TEAL)
        c.setLineWidth(1.4)
        c.line(MARGIN_X, top - 10.5 * mm, PAGE_W - MARGIN_X, top - 10.5 * mm)

        c.setStrokeColor(RULE)
        c.setLineWidth(0.6)
        c.line(MARGIN_X, 15 * mm, PAGE_W - MARGIN_X, 15 * mm)
        c.setFont(BASE, 7.5)
        c.setFillColor(MUTED)
        c.drawString(MARGIN_X, 11 * mm, f"Generated {generated} · ArogyaTrack")
        c.setFont(BASE, 6.8)
        c.drawString(MARGIN_X, 7.5 * mm, footer_note)
        c.restoreState()

    doc = BaseDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=MARGIN_X,
        rightMargin=MARGIN_X,
        topMargin=30 * mm,
        bottomMargin=22 * mm,
        title=f"{title} {reference}".strip(),
        author="ArogyaTrack",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="body", leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    doc.addPageTemplates([PageTemplate(id="page", frames=[frame], onPage=on_page)])
    doc.build(story, canvasmaker=_NumberedCanvas)
    return buf.getvalue()


# ── building blocks ────────────────────────────────────────────────


def heading(st, title, subtitle=None):
    out = [P(title, st.title)]
    if subtitle:
        out += [Spacer(1, 1.5 * mm), P(subtitle, st.subtitle)]
    out.append(Spacer(1, 6 * mm))
    return out


def section(st, title):
    """Small teal caps label with a hairline under it."""
    t = Table([[P(title.upper(), st.section)]], colWidths=[CONTENT_W])
    t.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, -1), 0.6, RULE),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]))
    return [Spacer(1, 5 * mm), t, Spacer(1, 2.5 * mm)]


def fields(st, pairs, cols=3):
    """Grid of label-over-value cells; empty values show as an em dash."""
    cells = [[P(label, st.label), Spacer(1, 0.6 * mm), P(value if value not in (None, "") else "—", st.value)] for label, value in pairs]
    rows = [cells[i:i + cols] for i in range(0, len(cells), cols)]
    if rows and len(rows[-1]) < cols:
        rows[-1] += [""] * (cols - len(rows[-1]))
    t = Table(rows, colWidths=[CONTENT_W / cols] * cols)
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


def panel(st, pairs_left, pairs_right, title_left, title_right):
    """Two side-by-side tinted boxes (e.g. patient | doctor)."""
    def box(title, pairs):
        inner = [[P(title.upper(), st.section)]]
        for label, value in pairs:
            inner.append([P(label, st.label)])
            inner.append([P(value if value not in (None, "") else "—", st.value)])
        t = Table(inner, colWidths=[(CONTENT_W - 6 * mm) / 2 - 8 * mm])
        t.setStyle(TableStyle([
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0.6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0.6),
            ("BOTTOMPADDING", (0, 0), (0, 0), 4),
        ]))
        return t

    outer = Table([[box(title_left, pairs_left), "", box(title_right, pairs_right)]],
                  colWidths=[(CONTENT_W - 6 * mm) / 2, 6 * mm, (CONTENT_W - 6 * mm) / 2])
    outer.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), TEAL_TINT),
        ("BACKGROUND", (2, 0), (2, 0), TEAL_TINT),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (0, 0), 4 * mm),
        ("LEFTPADDING", (2, 0), (2, 0), 4 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5 * mm),
        ("ROUNDEDCORNERS", [2.5 * mm, 2.5 * mm, 2.5 * mm, 2.5 * mm]),
    ]))
    return outer


def data_table(st, head, rows, widths, right=(), bold_first=True, repeat=1):
    """Table with a muted header row, hairline rows and zebra striping.

    `rows` hold plain values or ready-made flowables; `right` lists column
    indexes to right-align.
    """
    def cell(v, i, header=False):
        if not isinstance(v, (str, int, float)) and v is not None:
            return v
        if header:
            return P(v, st.head_right if i in right else st.head)
        if i in right:
            return P(v, st.cell_right)
        return P(v, st.cell_bold if (bold_first and i == 0) else st.cell)

    data = [[cell(h, i, True) for i, h in enumerate(head)]]
    data += [[cell(v, i) for i, v in enumerate(r)] for r in rows]
    total = sum(widths)
    t = Table(data, colWidths=[CONTENT_W * w / total for w in widths], repeatRows=repeat)
    style = [
        ("LINEBELOW", (0, 0), (-1, 0), 0.8, RULE),
        ("LINEBELOW", (0, 1), (-1, -1), 0.4, RULE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("BACKGROUND", (0, 0), (-1, 0), ZEBRA),
    ]
    for r in range(2, len(data), 2):
        style.append(("BACKGROUND", (0, r), (-1, r), ZEBRA))
    t.setStyle(TableStyle(style))
    return t


def text_block(st, text):
    return P(text if text else "Not recorded.", st.body if text else st.small)


def callout(st, text, tone="info"):
    fg, bg = {"danger": (RED, RED_TINT), "warning": (AMBER, AMBER_TINT)}.get(tone, (TEAL_DARK, TEAL_TINT))
    t = Table([[P(text, _style("callout", fontSize=8.8, textColor=fg))]], colWidths=[CONTENT_W])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("LEFTPADDING", (0, 0), (-1, -1), 3.5 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3.5 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5 * mm),
        ("ROUNDEDCORNERS", [2 * mm, 2 * mm, 2 * mm, 2 * mm]),
    ]))
    return t


def signature(st, label, name):
    t = Table([["", ""], ["", P(label, st.small)], ["", P(name, st.cell_bold)]], colWidths=[CONTENT_W - 62 * mm, 62 * mm])
    t.setStyle(TableStyle([
        ("LINEABOVE", (1, 1), (1, 1), 0.7, INK),
        ("TOPPADDING", (0, 0), (-1, 0), 14 * mm),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ]))
    return KeepTogether([Spacer(1, 4 * mm), t])
