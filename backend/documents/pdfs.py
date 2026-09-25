"""PDF builders for every document a user can download.

Each function takes model instances and returns PDF bytes. Access control
is the caller's job (see ``documents.views``).
"""

from decimal import Decimal

from django.conf import settings
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Flowable, Image, KeepTogether, Spacer, Table, TableStyle

from .fonts import BASE, markup
from .layout import (
    AMBER,
    CONTENT_W,
    GREEN,
    INK,
    MUTED,
    RED,
    RULE,
    TEAL,
    TEAL_DARK,
    TEAL_TINT,
    P,
    Styles,
    _draw_mark,
    build_pdf,
    callout,
    local_time,
    data_table,
    fields,
    heading,
    panel,
    section,
    signature,
    text_block,
)


def _date(value, fmt="%d %b %Y"):
    if not value:
        return "—"
    if getattr(value, "hour", None) is not None:
        value = local_time(value)
    return value.strftime(fmt)


def _datetime(value):
    return _date(value, "%d %b %Y, %I:%M %p")


def _age(profile):
    try:
        age = profile.calculate_age() if profile.date_of_birth else profile.age
    except Exception:
        age = profile.age
    return f"{age} years" if age not in (None, "") else "—"


def _money(value):
    if value is None:
        return "—"
    value = Decimal(value).quantize(Decimal("0.01"))
    whole, frac = f"{value:.2f}".split(".")
    sign = "-" if whole.startswith("-") else ""
    whole = whole.lstrip("-")
    # Indian digit grouping: 12,34,567.00
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        whole = ",".join(groups + [tail])
    return f"{sign}₹{whole}.{frac}"


_ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
         "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]


def _words_below_1000(n):
    out = []
    if n >= 100:
        out.append(f"{_ONES[n // 100]} Hundred")
        n %= 100
    if n >= 20:
        out.append(_TENS[n // 10] + (f" {_ONES[n % 10]}" if n % 10 else ""))
    elif n:
        out.append(_ONES[n])
    return " ".join(out)


def amount_in_words(value):
    """₹1,234.50 -> 'Rupees One Thousand Two Hundred Thirty Four and Fifty Paise Only' (Indian system)."""
    value = Decimal(value).quantize(Decimal("0.01"))
    rupees, paise = int(value), int((value - int(value)) * 100)
    parts = []
    for size, name in ((10**7, "Crore"), (10**5, "Lakh"), (1000, "Thousand")):
        if rupees >= size:
            parts.append(f"{_words_below_1000(rupees // size)} {name}")
            rupees %= size
    if rupees:
        parts.append(_words_below_1000(rupees))
    words = "Rupees " + (" ".join(parts) if parts else "Zero")
    if paise:
        words += f" and {_words_below_1000(paise)} Paise"
    return words + " Only"


def _patient_pairs(profile):
    return [
        ("Name", profile.name),
        ("Patient ID", profile.patient_id),
        ("Age / gender", f"{_age(profile)} · {(profile.gender or '').title() or '—'}"),
        ("Blood group", profile.blood_group),
    ]


# ── visit record ───────────────────────────────────────────────────


def visit_record_pdf(record):
    from medical.models import HealthMetric, LabTestResult

    st = Styles()
    profile = record.profile
    story = heading(st, "Visit record", f"{record.department or 'Consultation'} · {_datetime(record.visit_date)}")
    story.append(panel(
        st,
        _patient_pairs(profile),
        [("Doctor", record.doctor_name), ("Department", record.department), ("Visit date", _datetime(record.visit_date))],
        "Patient", "Consultation",
    ))

    story += section(st, "Diagnosis")
    story.append(text_block(st, record.diagnosis))

    vitals = list(HealthMetric.objects.filter(profile=profile, recorded_at=record.visit_date).order_by("metric_type"))
    if vitals:
        story += section(st, "Vitals")
        rows = []
        for m in vitals:
            value = f"{m.value:g}/{m.secondary_value:g}" if m.secondary_value is not None else f"{m.value:g}"
            rows.append([m.get_metric_type_display(), value, m.unit or ""])
        story.append(data_table(st, ["Measure", "Reading", "Unit"], rows, [3, 2, 2]))

    story += section(st, "Tests performed or ordered")
    story.append(text_block(st, record.tests_performed))

    labs = list(LabTestResult.objects.filter(visit_record=record).order_by("test_name"))
    if labs:
        story += section(st, "Lab results from this visit")
        story.append(_lab_table(st, labs))

    story += section(st, "Prescription")
    story.append(text_block(st, record.prescription))

    story += section(st, "Doctor's notes")
    story.append(text_block(st, record.doctor_notes))

    attachments = list(record.report_attachments.all())
    if attachments:
        story += section(st, "Attached reports")
        story.append(data_table(st, ["File", "Uploaded"], [[a.file_name, _datetime(a.uploaded_at)] for a in attachments], [4, 2]))

    story.append(signature(st, "Attending doctor", record.doctor_name or ""))
    return build_pdf(story, title="Visit record", reference=f"VR-{record.id:06d}" if isinstance(record.id, int) else str(record.id)[:8].upper())


# ── lab results ────────────────────────────────────────────────────


def _lab_flag(lab):
    try:
        value = float(lab.value)
    except (TypeError, ValueError):
        return "—", MUTED
    if lab.normal_min is not None and value < float(lab.normal_min):
        return "Low", AMBER
    if lab.normal_max is not None and value > float(lab.normal_max):
        return "High", RED
    if lab.normal_min is not None or lab.normal_max is not None:
        return "Normal", GREEN
    return "—", MUTED


def _lab_table(st, labs, with_date=False):
    from .layout import _style

    rows = []
    for lab in labs:
        flag, color = _lab_flag(lab)
        ref = "—"
        if lab.normal_min is not None and lab.normal_max is not None:
            ref = f"{lab.normal_min:g} – {lab.normal_max:g}"
        elif lab.normal_min is not None:
            ref = f"≥ {lab.normal_min:g}"
        elif lab.normal_max is not None:
            ref = f"≤ {lab.normal_max:g}"
        value = f"{lab.value:g}" if isinstance(lab.value, float) else str(lab.value)
        row = [lab.test_name, P(value, st.cell_right_bold), lab.unit or "", ref, P(flag, _style("flag", fontSize=8.8, fontName=f"{BASE}-Bold", textColor=color))]
        if with_date:
            row.append(_date(lab.tested_at))
        rows.append(row)
    head = ["Test", "Result", "Unit", "Reference range", "Flag"] + (["Tested"] if with_date else [])
    widths = [4, 1.6, 1.4, 2.4, 1.4] + ([1.8] if with_date else [])
    return data_table(st, head, rows, widths, right=(1,))


def lab_report_pdf(profile, labs, title="Lab results"):
    st = Styles()
    labs = list(labs)
    dates = sorted(l.tested_at for l in labs if l.tested_at)
    period = ""
    if dates:
        period = _date(dates[0]) if dates[0] == dates[-1] else f"{_date(dates[0])} – {_date(dates[-1])}"
    story = heading(st, title, period or None)
    story.append(fields(st, _patient_pairs(profile), cols=4))
    story += section(st, "Results")
    if labs:
        story.append(_lab_table(st, labs, with_date=len({l.tested_at for l in labs}) > 1))
        abnormal = [l.test_name for l in labs if _lab_flag(l)[0] in ("High", "Low")]
        story.append(Spacer(1, 4 * mm))
        if abnormal:
            story.append(callout(st, f"Outside the reference range: {', '.join(abnormal)}. Discuss these results with your doctor.", "warning"))
        else:
            story.append(callout(st, "All results with a reference range are within it."))
    else:
        story.append(text_block(st, ""))
    story.append(Spacer(1, 3 * mm))
    story.append(P("Reference ranges are those recorded with each result and may vary between laboratories.", st.small))
    ref = labs[0].test_name if len(labs) == 1 else f"{len(labs)} results"
    return build_pdf(story, title=title, reference=ref)


# ── prescription ───────────────────────────────────────────────────


def _qr_flowable(path, size):
    try:
        return Image(str(path), width=size, height=size)
    except Exception:
        return Spacer(size, size)


def prescription_pdf(prescription, language="en"):
    from prescriptions.translations import get_translation, translate_frequency, translate_instructions
    from prescriptions.views import _ensure_prescription_qr

    t = lambda key: get_translation(language, key)
    st = Styles()
    profile = prescription.patient
    doctor = prescription.doctor
    doctor_name = f"{doctor.get_first_name()} {doctor.get_last_name()}".strip() or doctor.email
    number = f"RX-{str(prescription.id)[:8].upper()}"

    story = heading(st, t("prescription"), f"{number} · {_date(prescription.created_at)}")

    dp = getattr(doctor, "doctor_profile", None)
    story.append(panel(
        st,
        [(t("patient_name"), profile.name), (t("patient_id"), profile.patient_id),
         (f"{t('age')} / {t('gender')}", f"{_age(profile)} · {(profile.gender or '').title() or '—'}")],
        [(t("doctor"), f"Dr. {doctor_name}"),
         ("Specialisation · Reg. no.", " · ".join(x for x in [getattr(dp, "specialization", ""), getattr(dp, "medical_license", "")] if x) or "—"),
         (t("date"), _date(prescription.created_at))],
        t("patient"), t("doctor"),
    ))

    story += section(st, t("medicines"))
    rows = []
    for i, med in enumerate(prescription.medicines.select_related("medicine").all(), 1):
        name = [P(med.medicine.name, st.cell_bold), P(med.medicine.generic_name, st.cell_muted)]
        rows.append([
            str(i), name, med.dosage, translate_frequency(med.frequency, language),
            f"{med.duration_days} {t('days')}", str(med.quantity),
            translate_instructions(med.special_instructions, language) or "—",
        ])
    story.append(data_table(
        st, ["#", t("medicines"), t("dosage"), t("frequency"), t("duration"), t("quantity"), t("instructions")],
        rows, [0.5, 3.2, 1.5, 2.2, 1.4, 1.1, 2.4], bold_first=False,
    ))

    # Verification QR + doctor signature side by side.
    qr = _qr_flowable(_ensure_prescription_qr(prescription), 30 * mm)
    verify_at = settings.FRONTEND_URL.split("://", 1)[-1] + "/prescription/verify"
    qr_text = [P(t("scan_to_verify"), st.cell_bold), Spacer(1, 1 * mm),
               P("Pharmacists scan this code to dispense. Anyone can check it is genuine at", st.small),
               P(verify_at, st.cell_muted)]
    sig = Table([[""], [P(t("signature"), st.small)], [P(f"Dr. {doctor_name}", st.cell_bold)]], colWidths=[58 * mm])
    sig.setStyle(TableStyle([("LINEABOVE", (0, 1), (0, 1), 0.7, INK), ("TOPPADDING", (0, 0), (0, 0), 16 * mm), ("LEFTPADDING", (0, 0), (-1, -1), 0)]))
    block = Table([[qr, qr_text, sig]], colWidths=[34 * mm, CONTENT_W - 34 * mm - 62 * mm, 62 * mm])
    block.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0)]))
    story += [Spacer(1, 8 * mm), KeepTogether(block)]
    return build_pdf(story, title="Prescription", reference=number)


# ── invoice ────────────────────────────────────────────────────────


def invoice_pdf(invoice):
    st = Styles()
    ph = invoice.pharmacy
    profile = invoice.patient
    doctor = invoice.prescription.doctor
    doctor_name = f"{doctor.get_first_name()} {doctor.get_last_name()}".strip() or doctor.email
    pharmacist = invoice.pharmacist
    pharmacist_name = f"{pharmacist.get_first_name()} {pharmacist.get_last_name()}".strip() or pharmacist.email
    title = "Tax invoice" if ph.gstin else "Invoice"

    story = heading(st, title, f"{invoice.invoice_number} · {_datetime(invoice.created_at)}")
    story.append(panel(
        st,
        [("Pharmacy", ph.name), ("Address", ", ".join(x for x in [ph.address, ph.district] if x)),
         ("Phone · email", f"{ph.phone} · {ph.email}"), ("Drug licence", ph.license_number), ("GSTIN", ph.gstin or "Not registered")],
        [("Patient", profile.name), ("Patient ID", profile.patient_id), ("Phone", profile.phone),
         ("Prescription", f"RX-{str(invoice.prescription_id)[:8].upper()}"), ("Prescribed by", f"Dr. {doctor_name}")],
        "Sold by", "Billed to",
    ))

    story += section(st, "Items")
    rows = []
    items = sorted(invoice.items.select_related("prescription_medicine__medicine"), key=lambda r: r.dispensed_at)
    for i, it in enumerate(items, 1):
        med = it.prescription_medicine.medicine
        rows.append([
            str(i),
            [P(med.name, st.cell_bold), P(it.prescription_medicine.dosage, st.cell_muted)],
            it.hsn_code or med.hsn_code,
            str(it.quantity_dispensed),
            _money(it.unit_price),
            f"{Decimal(it.gst_rate or 0).normalize():f}%",
            _money(it.taxable_value),
            _money(it.tax_amount),
            _money(it.amount),
        ])
    story.append(data_table(
        st, ["#", "Medicine", "HSN", "Qty", "Rate", "GST", "Taxable", "Tax", "Amount"],
        rows, [0.5, 3.4, 1.0, 0.7, 1.3, 0.8, 1.5, 1.2, 1.5], right=(3, 4, 5, 6, 7, 8), bold_first=False,
    ))

    # Totals on the right, amount in words on the left.
    tot_rows = [
        ("Items total (MRP)", _money(invoice.subtotal)),
        *([("Discount", f"− {_money(invoice.discount)}")] if invoice.discount else []),
        ("Taxable value", _money(invoice.taxable_value)),
        ("CGST", _money(invoice.cgst)),
        ("SGST", _money(invoice.sgst)),
    ]
    totals = Table(
        [[P(k, st.cell), P(v, st.cell_right)] for k, v in tot_rows]
        + [[P("Total", st.value), P(_money(invoice.total), st.value_right)]],
        colWidths=[34 * mm, 32 * mm],
    )
    totals.setStyle(TableStyle([
        ("LINEABOVE", (0, -1), (-1, -1), 1.2, INK),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 2.2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.2),
        ("TOPPADDING", (0, -1), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    left = [
        P("Amount in words", st.label), Spacer(1, 1 * mm), P(amount_in_words(invoice.total), st.cell_bold), Spacer(1, 4 * mm),
        P("Payment", st.label), Spacer(1, 1 * mm), P(f"Paid · {invoice.get_payment_method_display()}", st.cell_bold),
    ]
    summary = Table([[left, totals]], colWidths=[CONTENT_W - 70 * mm, 70 * mm])
    summary.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    story += [Spacer(1, 5 * mm), KeepTogether(summary)]

    story += [Spacer(1, 6 * mm), P(
        f"Prices are inclusive of GST. Tax shown is contained in the amounts above; intra-state supply, so GST is split equally into CGST and SGST. "
        f"Dispensed by {pharmacist_name}. Goods once sold are subject to the pharmacy's return policy.", st.small)]
    story.append(signature(st, "Authorised signatory", ph.name))
    return build_pdf(story, title=title, reference=invoice.invoice_number, footer_note="This is a computer-generated invoice.")


# ── health card ────────────────────────────────────────────────────

CARD_W, CARD_H = 85.6 * mm, 54 * mm  # ISO/IEC 7810 ID-1, the size of a bank card


class _HealthCard(Flowable):
    """Front and back of the health card at real size with cut guides."""

    def __init__(self, profile, card, allergies, conditions):
        super().__init__()
        self.profile, self.card = profile, card
        self.allergies, self.conditions = allergies, conditions
        self.gap = CONTENT_W - 2 * CARD_W
        self.width, self.height = CONTENT_W, CARD_H + 8 * mm

    def wrap(self, *args):
        return self.width, self.height

    def _cut_guides(self, c, x, y):
        c.saveState()
        c.setStrokeColor(colors.HexColor("#9aa9a7"))
        c.setDash(2, 2)
        c.setLineWidth(0.5)
        c.roundRect(x - 1.5 * mm, y - 1.5 * mm, CARD_W + 3 * mm, CARD_H + 3 * mm, 4 * mm, stroke=1, fill=0)
        c.restoreState()

    def _text(self, c, x, y, text, size, bold=False, color=INK):
        # Latin-only fields (names can be in any script, so go through markup).
        from reportlab.platypus import Paragraph
        from .layout import _style

        style = _style("card", fontSize=size, leading=size * 1.2, fontName=f"{BASE}-Bold" if bold else BASE, textColor=color)
        p = Paragraph(markup(text), style)
        w, h = p.wrap(CARD_W - 8 * mm, 20 * mm)
        p.drawOn(c, x, y - h + size * 0.25)

    def _front(self, c, x, y):
        p = self.profile
        c.saveState()
        c.setFillColor(TEAL_DARK)
        c.roundRect(x, y, CARD_W, CARD_H, 3.2 * mm, stroke=0, fill=1)
        # Soft light accent top-right.
        c.setFillColor(colors.Color(1, 1, 1, alpha=0.06))
        c.circle(x + CARD_W - 6 * mm, y + CARD_H + 4 * mm, 26 * mm, stroke=0, fill=1)
        _draw_mark(c, x + 4 * mm, y + CARD_H - 10 * mm, 6 * mm)
        c.setFillColor(colors.white)
        c.setFont(f"{BASE}-Bold", 8.5)
        c.drawString(x + 11.5 * mm, y + CARD_H - 6.4 * mm, "ArogyaTrack")
        c.setFont(BASE, 5.5)
        c.setFillColor(colors.HexColor("#9fd9cc"))
        c.drawString(x + 11.5 * mm, y + CARD_H - 9.2 * mm, "HEALTH CARD")

        # QR on a white tile, right side.
        qs = 24 * mm
        qx, qy = x + CARD_W - qs - 4.5 * mm, y + 5 * mm
        c.setFillColor(colors.white)
        c.roundRect(qx - 1.2 * mm, qy - 1.2 * mm, qs + 2.4 * mm, qs + 2.4 * mm, 1.6 * mm, stroke=0, fill=1)
        try:
            c.drawImage(ImageReader(self.card.qr_code_path), qx, qy, qs, qs)
        except Exception:
            pass

        # Blood group badge top-right.
        c.setFillColor(colors.HexColor("#c0392b"))
        c.roundRect(x + CARD_W - 16 * mm, y + CARD_H - 10 * mm, 11.5 * mm, 5.6 * mm, 1.4 * mm, stroke=0, fill=1)
        c.setFillColor(colors.white)
        c.setFont(f"{BASE}-Bold", 7.5)
        c.drawCentredString(x + CARD_W - 10.25 * mm, y + CARD_H - 8.3 * mm, p.blood_group or "—")

        self._text(c, x + 4.5 * mm, y + CARD_H - 15.5 * mm, p.name, 10.5, bold=True, color=colors.white)
        c.setFont(f"{BASE}-Bold", 8)
        c.setFillColor(colors.HexColor("#9fd9cc"))
        c.drawString(x + 4.5 * mm, y + CARD_H - 23 * mm, p.patient_id or "")
        rows = [("DOB", _date(p.date_of_birth) if p.date_of_birth else _age(p)), ("Gender", (p.gender or "—").title()), ("District", p.district or "—")]
        yy = y + CARD_H - 30 * mm
        for label, value in rows:
            c.setFont(BASE, 5.5)
            c.setFillColor(colors.HexColor("#9fd9cc"))
            c.drawString(x + 4.5 * mm, yy, label.upper())
            c.setFont(f"{BASE}-Bold", 7.5)
            c.setFillColor(colors.white)
            c.drawString(x + 17 * mm, yy, str(value)[:26])
            yy -= 4.6 * mm
        c.restoreState()

    def _back(self, c, x, y):
        p = self.profile
        c.saveState()
        c.setFillColor(colors.white)
        c.setStrokeColor(RULE)
        c.setLineWidth(0.8)
        c.roundRect(x, y, CARD_W, CARD_H, 3.2 * mm, stroke=1, fill=1)
        c.setFillColor(colors.HexColor("#c0392b"))
        c.rect(x, y + CARD_H - 8 * mm, CARD_W, 8 * mm - 3.2 * mm, stroke=0, fill=1)
        c.roundRect(x, y + CARD_H - 8 * mm, CARD_W, 8 * mm, 3.2 * mm, stroke=0, fill=1)
        c.setFillColor(colors.white)
        c.setFont(f"{BASE}-Bold", 7)
        c.drawString(x + 4 * mm, y + CARD_H - 5.2 * mm, "EMERGENCY INFORMATION")
        c.setFont(f"{BASE}-Bold", 7)
        c.drawRightString(x + CARD_W - 4 * mm, y + CARD_H - 5.2 * mm, f"Blood group {p.blood_group or '—'}")

        def block(label, value, yy):
            c.setFont(BASE, 5.5)
            c.setFillColor(MUTED)
            c.drawString(x + 4 * mm, yy, label.upper())
            self._text(c, x + 4 * mm, yy - 1.2 * mm, value, 7.2, bold=True)

        allergies = ", ".join(self.allergies) or "None recorded"
        conditions = ", ".join(self.conditions) or "None recorded"
        block("Allergies", allergies[:90], y + CARD_H - 13 * mm)
        block("Conditions", conditions[:90], y + CARD_H - 22 * mm)
        c.setStrokeColor(RULE)
        c.line(x + 4 * mm, y + 15 * mm, x + CARD_W - 4 * mm, y + 15 * mm)
        issued, expires = _date(self.card.created_at), _date(self.card.expires_at)
        for i, (label, value) in enumerate([("Issued", issued), ("Valid until", expires), ("Contact", p.phone or "—")]):
            cx = x + 4 * mm + i * (CARD_W - 8 * mm) / 3
            c.setFont(BASE, 5.3)
            c.setFillColor(MUTED)
            c.drawString(cx, y + 10.5 * mm, label.upper())
            c.setFont(f"{BASE}-Bold", 6.8)
            c.setFillColor(INK)
            c.drawString(cx, y + 7 * mm, value)
        c.setFont(BASE, 5)
        c.setFillColor(MUTED)
        c.drawString(x + 4 * mm, y + 3 * mm, "If found, please return to the holder. Scanning is logged.")
        c.restoreState()

    def draw(self):
        c = self.canv
        y = 4 * mm
        self._cut_guides(c, 0, y)
        self._front(c, 0, y)
        bx = CARD_W + self.gap
        self._cut_guides(c, bx, y)
        self._back(c, bx, y)


def health_card_pdf(profile, card):
    from medical.models import Allergy, ChronicCondition

    st = Styles()
    allergies = list(Allergy.objects.filter(profile=profile).values_list("allergen", flat=True))
    conditions = list(ChronicCondition.objects.filter(profile=profile, is_active=True).values_list("disease_name", flat=True))
    story = heading(st, "Health card", f"{profile.name} · {profile.patient_id}")
    story.append(_HealthCard(profile, card, allergies, conditions))
    story.append(Table([[P("Front", st.small), P("Back", st.small)]], colWidths=[CARD_W + (CONTENT_W - 2 * CARD_W), CARD_W]))
    story += section(st, "How to use your card")
    for line in [
        "Print this page at 100% scale (no fit-to-page). Cut out both sides along the dashed lines and glue them back to back, or keep the card on your phone.",
        "A verified doctor scans the QR during your visit to get 24 hours of logged access to your records. Pharmacists scan it to find your prescriptions.",
        "If the card is lost, reissue it from Health card in your ArogyaTrack account. The old QR stops working immediately and all doctor access ends.",
    ]:
        story.append(P(f"•  {line}", st.body))
        story.append(Spacer(1, 1.5 * mm))
    story.append(Spacer(1, 3 * mm))
    story.append(fields(st, [("Issued", _date(card.created_at)), ("Valid until", _date(card.expires_at)), ("Card status", "Active" if not card.revoked_at else "Revoked")], cols=3))
    return build_pdf(story, title="Health card", reference=profile.patient_id or "")
