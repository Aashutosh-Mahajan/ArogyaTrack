"""
prescriptions/agent_service.py
───────────────────────────────────────────────────────
Calls the configured LLM (AI_MODEL, default gpt-5.1) with the assembled patient/medicine context and returns
a structured safety report.

Fail-open by design: if the API is unreachable or returns something
unparseable, this returns overall_status="warning" with
agent_unavailable=True rather than raising — a prescribing doctor is
never physically blocked from prescribing by a third-party API outage.
The frontend (create-prescription / create-consultation pages) reads
agent_unavailable and renders an explicit "AI validation unavailable"
banner, so the doctor makes the call manually instead of the check
silently no-op'ing. Do not change this to fail-closed without checking
with product/clinical stakeholders — blocking prescriptions on an
external API outage is a worse patient-safety outcome in most cases,
particularly urgent ones.
"""
import json
import logging

from config.ai import ai_chat, ai_configured

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a clinical prescription safety assistant integrated into a healthcare platform.

You have deep knowledge of:
- Pharmacology and drug mechanisms
- Drug-drug interactions (including CYP enzyme interactions)
- Dosage guidelines for adults and children (weight-based and age-based)
- Allergy cross-reactivity between drug classes
- Active ingredients, excipients, and chemical composition of medicines
- Renal and hepatic dose adjustments
- Drug availability at the selected pharmacy

RULES:
1. Be CONSERVATIVE — when in doubt, warn rather than approve.
2. **ALLERGY & INGREDIENT CHECK (CRITICAL):**
   - Check the patient's allergy list against EVERY prescribed medicine's known allergens list.
   - Also check for cross-reactivity: if a patient is allergic to penicillin, flag ALL beta-lactam antibiotics.
   - Check the generic name, drug class, and therapeutic category for allergy matches.
   - If the allergen field lists ingredients (e.g. "aspirin", "ibuprofen", "sulfa"), match them against the medicine's generic name, drug class, and known composition.
   - Even if there is no explicit allergen match in the data, use your pharmacological knowledge to identify potential cross-reactive allergens and ingredient conflicts.
   - Set allergy_conflict=true and explain in allergy_detail for any match or suspected cross-reactivity.
3. Cross-check interactions with BOTH the new medicines AND existing active prescriptions.
4. Evaluate dosage against standard ranges, adjusting for age, weight, kidney function (creatinine), and liver function (ALT).
5. Flag stock availability issues only when a pharmacy is selected (pharmacy_stock entries have pharmacy_selected=true). If no pharmacy is selected, do not comment on availability anywhere, including the summary; stock is reported separately from inventory data.
   Keep medicines[] in the same order as the prescribed medicines.
6. overall_status must be "blocked" if ANY contraindicated allergy or contraindicated interaction exists.
   "warning" if moderate interactions, dosage concerns, or low stock exist.
   "safe" if everything checks out.
7. ALWAYS respond with ONLY valid JSON matching the schema below. No extra text.

RESPONSE SCHEMA:
{
  "overall_status": "safe | warning | blocked",
  "medicines": [
    {
      "medicine_name": "",
      "allergy_conflict": true/false,
      "allergy_detail": "",
      "dosage_status": "appropriate | too_high | too_low",
      "dosage_detail": "",
      "stock_status": "in_stock | low_stock | out_of_stock",
      "stock_detail": "",
      "recommendation": ""
    }
  ],
  "drug_interactions": [
    {
      "medicine_a": "",
      "medicine_b": "",
      "severity": "minor | moderate | major | contraindicated",
      "detail": ""
    }
  ],
  "alternatives": [
    {
      "replaces": "",
      "suggested_alternative": "",
      "reason": ""
    }
  ],
  "summary": ""
}"""


def run_safety_agent(context: dict) -> dict:
    """
    Send context to the configured LLM and return structured safety report.

    Returns a dict matching the schema above.  On any failure returns a
    fallback report with overall_status="warning" so the doctor can proceed.
    """
    if not ai_configured():
        logger.error("AI_API_KEY not configured")
        return _fallback_report("AI validation unavailable — AI_API_KEY is not configured.")

    try:

        user_message = json.dumps(context, indent=2, default=str)

        content = ai_chat(
            [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            default_model="gpt-5.1",
            temperature=0.1,
            max_tokens=8000,
            timeout=60,
        ).strip()

        # Strip markdown code fences if present
        if content.startswith("```"):
            content = content.split("\n", 1)[1] if "\n" in content else content[3:]
        if content.endswith("```"):
            content = content[:-3].rstrip()
        if content.startswith("json"):
            content = content[4:].lstrip()

        report = json.loads(content)

        # Basic sanity check
        if "overall_status" not in report:
            raise ValueError("Missing overall_status in agent response")

        return report

    except json.JSONDecodeError as e:
        logger.error("Agent returned invalid JSON: %s", e)
        return _fallback_report("AI validation returned an unparseable response. Please review manually.")
    except Exception as e:
        logger.error("Agent service error: %s", e)
        return _fallback_report(f"AI validation unavailable — {type(e).__name__}. Please review manually.")


def _fallback_report(reason: str) -> dict:
    """Return a safe-to-proceed fallback when the agent is unavailable."""
    return {
        "overall_status": "warning",
        "medicines": [],
        "drug_interactions": [],
        "alternatives": [],
        "summary": reason,
        "agent_unavailable": True,
    }
