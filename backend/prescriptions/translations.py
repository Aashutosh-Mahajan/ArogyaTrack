"""
Multi-language translations for prescriptions.
Supports: English, Hindi, Marathi, Tamil, Telugu, Bengali
"""

TRANSLATIONS = {
    "en": {
        "prescription": "Prescription",
        "patient_name": "Patient Name",
        "age": "Age",
        "gender": "Gender",
        "doctor": "Doctor",
        "date": "Date",
        "medicines": "Medicines",
        "dosage": "Dosage",
        "frequency": "Frequency",
        "duration": "Duration",
        "days": "days",
        "special_instructions": "Special Instructions",
        "signature": "Doctor's Signature",
        "times_daily": "times daily",
        "after_meals": "after meals",
        "before_meals": "before meals",
        "with_meals": "with meals",
        "at_bedtime": "at bedtime",
        "as_needed": "as needed",
    },
    "hi": {  # Hindi
        "prescription": "पर्चा",
        "patient_name": "रोगी का नाम",
        "age": "आयु",
        "gender": "लिंग",
        "doctor": "डॉक्टर",
        "date": "तारीख",
        "medicines": "दवाइयाँ",
        "dosage": "खुराक",
        "frequency": "आवृत्ति",
        "duration": "अवधि",
        "days": "दिन",
        "special_instructions": "विशेष निर्देश",
        "signature": "डॉक्टर के हस्ताक्षर",
        "times_daily": "बार प्रतिदिन",
        "after_meals": "भोजन के बाद",
        "before_meals": "भोजन से पहले",
        "with_meals": "भोजन के साथ",
        "at_bedtime": "सोते समय",
        "as_needed": "आवश्यकतानुसार",
    },
    "mr": {  # Marathi
        "prescription": "प्रिस्क्रिप्शन",
        "patient_name": "रुग्णाचे नाव",
        "age": "वय",
        "gender": "लिंग",
        "doctor": "डॉक्टर",
        "date": "तारीख",
        "medicines": "औषधे",
        "dosage": "डोस",
        "frequency": "वारंवारता",
        "duration": "कालावधी",
        "days": "दिवस",
        "special_instructions": "विशेष सूचना",
        "signature": "डॉक्टरांची स्वाक्षरी",
        "times_daily": "वेळा दररोज",
        "after_meals": "जेवणानंतर",
        "before_meals": "जेवणापूर्वी",
        "with_meals": "जेवणासोबत",
        "at_bedtime": "झोपताना",
        "as_needed": "आवश्यकतेनुसार",
    },
    "ta": {  # Tamil
        "prescription": "மருந்துச்சீட்டு",
        "patient_name": "நோயாளியின் பெயர்",
        "age": "வயது",
        "gender": "பாலினம்",
        "doctor": "மருத்துவர்",
        "date": "தேதி",
        "medicines": "மருந்துகள்",
        "dosage": "அளவு",
        "frequency": "அடிக்கடி",
        "duration": "காலம்",
        "days": "நாட்கள்",
        "special_instructions": "சிறப்பு வழிமுறைகள்",
        "signature": "மருத்துவர் கையொப்பம்",
        "times_daily": "முறை தினசரி",
        "after_meals": "உணவுக்குப் பிறகு",
        "before_meals": "உணவுக்கு முன்",
        "with_meals": "உணவுடன்",
        "at_bedtime": "படுக்கும் நேரத்தில்",
        "as_needed": "தேவைக்கேற்ப",
    },
    "te": {  # Telugu
        "prescription": "ప్రిస్క్రిప్షన్",
        "patient_name": "రోగి పేరు",
        "age": "వయస్సు",
        "gender": "లింగం",
        "doctor": "వైద్యుడు",
        "date": "తేదీ",
        "medicines": "మందులు",
        "dosage": "మోతాదు",
        "frequency": "ఫ్రీక్వెన్సీ",
        "duration": "వ్యవధి",
        "days": "రోజులు",
        "special_instructions": "ప్రత్యేక సూచనలు",
        "signature": "వైద్యుని సంతకం",
        "times_daily": "సార్లు రోజువారీ",
        "after_meals": "భోజనం తర్వాత",
        "before_meals": "భోజనానికి ముందు",
        "with_meals": "భోజనంతో",
        "at_bedtime": "నిద్రించే సమయంలో",
        "as_needed": "అవసరమైనప్పుడు",
    },
    "bn": {  # Bengali
        "prescription": "প্রেসক্রিপশন",
        "patient_name": "রোগীর নাম",
        "age": "বয়স",
        "gender": "লিঙ্গ",
        "doctor": "ডাক্তার",
        "date": "তারিখ",
        "medicines": "ওষুধ",
        "dosage": "ডোজ",
        "frequency": "ফ্রিকোয়েন্সি",
        "duration": "সময়কাল",
        "days": "দিন",
        "special_instructions": "বিশেষ নির্দেশাবলী",
        "signature": "ডাক্তারের স্বাক্ষর",
        "times_daily": "বার দৈনিক",
        "after_meals": "খাবারের পরে",
        "before_meals": "খাবারের আগে",
        "with_meals": "খাবারের সাথে",
        "at_bedtime": "ঘুমানোর সময়",
        "as_needed": "প্রয়োজন অনুযায়ী",
    },
}


def get_translation(language: str, key: str) -> str:
    """Get translation for a key in specified language."""
    if language not in TRANSLATIONS:
        language = "en"  # Default to English

    return TRANSLATIONS[language].get(key, TRANSLATIONS["en"].get(key, key))


def translate_prescription_data(prescription, language: str = "en") -> dict:
    """Translate prescription data to specified language."""
    t = lambda key: get_translation(language, key)

    translated_data = {
        "title": t("prescription"),
        "patient_name_label": t("patient_name"),
        "patient_name": prescription.patient.name,
        "age_label": t("age"),
        "age": prescription.patient.age,
        "gender_label": t("gender"),
        "gender": prescription.patient.gender,
        "doctor_label": t("doctor"),
        "doctor": prescription.doctor.email,
        "date_label": t("date"),
        "date": prescription.created_at.strftime("%Y-%m-%d"),
        "medicines_label": t("medicines"),
        "medicines": [],
        "signature_label": t("signature"),
    }

    # Translate medicine instructions
    for med in prescription.medicines.all():
        translated_med = {
            "name": med.medicine.name,  # Keep medicine name in English
            "generic": med.medicine.generic_name,  # Keep generic name in English
            "dosage_label": t("dosage"),
            "dosage": med.dosage,
            "frequency_label": t("frequency"),
            "frequency": translate_frequency(med.frequency, language),
            "duration_label": t("duration"),
            "duration": f"{med.duration_days} {t('days')}",
            "special_instructions_label": t("special_instructions"),
            "special_instructions": translate_instructions(med.special_instructions, language),
        }
        translated_data["medicines"].append(translated_med)

    return translated_data


def translate_frequency(frequency: str, language: str) -> str:
    """Translate frequency text."""
    # Simple translation of common patterns
    freq_lower = frequency.lower()

    if "daily" in freq_lower or "times" in freq_lower:
        # Extract number if present
        import re

        match = re.search(r"(\d+)", frequency)
        if match:
            num = match.group(1)
            return f"{num} {get_translation(language, 'times_daily')}"

    return frequency  # Return original if no pattern matches


def translate_instructions(instructions: str, language: str) -> str:
    """Translate special instructions."""
    if not instructions:
        return ""

    inst_lower = instructions.lower()
    t = lambda key: get_translation(language, key)

    # Replace common phrases
    translations = {
        "after meals": t("after_meals"),
        "before meals": t("before_meals"),
        "with meals": t("with_meals"),
        "at bedtime": t("at_bedtime"),
        "as needed": t("as_needed"),
    }

    translated = instructions
    for eng, trans in translations.items():
        if eng in inst_lower:
            translated = translated.replace(eng, trans)
            translated = translated.replace(eng.title(), trans)

    return translated
