"""GST for pharmacy invoices.

Retail medicine prices (MRP) are GST-inclusive, so tax is extracted rather
than added: a line worth ₹105 at 5% GST is ₹100 taxable value + ₹5 GST. An
invoice discount is shared across the lines in proportion to their value
before the tax is extracted, so the tax matches what the patient paid.
"""

from decimal import ROUND_HALF_UP, Decimal

PAISA = Decimal("0.01")


def _q(value):
    return Decimal(value).quantize(PAISA, rounding=ROUND_HALF_UP)


def allocate_gst(records, subtotal, total):
    """Set hsn_code, gst_rate, taxable_value and tax_amount on each record.

    `records` must have `amount` and `prescription_medicine.medicine`
    loaded. Returns (taxable_value, cgst, sgst) for the invoice; the line
    values always add up exactly to `total`.
    """
    records = list(records)
    ratio = (Decimal(total) / Decimal(subtotal)) if subtotal else Decimal("0")

    # Each line's share of the discounted total; the last line absorbs any
    # rounding paisa so the lines sum exactly to the invoice total.
    shares, running = [], Decimal("0")
    for i, r in enumerate(records):
        if i == len(records) - 1:
            share = _q(Decimal(total) - running)
        else:
            share = _q((r.amount or Decimal("0")) * ratio)
            running += share
        shares.append(share)

    taxable_sum = tax_sum = Decimal("0")
    for r, share in zip(records, shares):
        medicine = r.prescription_medicine.medicine
        rate = Decimal(medicine.gst_rate or 0)
        taxable = _q(share * 100 / (100 + rate))
        r.hsn_code = medicine.hsn_code or ""
        r.gst_rate = rate
        r.taxable_value = taxable
        r.tax_amount = share - taxable
        taxable_sum += taxable
        tax_sum += r.tax_amount

    cgst = _q(tax_sum / 2)
    return taxable_sum, cgst, tax_sum - cgst
