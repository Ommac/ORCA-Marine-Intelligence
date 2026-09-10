"""
Indian Language Script & Lexical Detector
-----------------------------------------
Identifies natural language in fisherman queries across major coastal Indian languages:
- Marathi (mr)
- Hindi (hi)
- Tamil (ta)
- Telugu (te)
- Gujarati (gu)
- Kannada (kn)
- Malayalam (ml)
- Bengali (bn)
- Odia (or)
- English (en)

Uses high-speed Unicode script block mapping with lexical marker disambiguation
for shared scripts (such as Devanagari for Marathi vs Hindi).
"""

from __future__ import annotations

import re
from typing import Dict, Optional, Tuple

# Common Marathi function words and verb suffixes
_MARATHI_MARKERS = {
    "आहे", "आहेत", "नाही", "नाहीत", "काय", "कसा", "कशी", "कसे", "कधी", "कुठे", "का",
    "मासेमारी", "मासे", "हवामान", "लाटा", "सुरक्षित", "उद्या", "आज", "जाणे", "जाणं",
    "होय", "शकतो", "शकते", "करणे", "करणं", "तुमचे", "आमचे", "मला", "तुम्हाला", "त्यांना",
    "बोट", "समुद्र", "वारा", "पाऊस", "धोका", "इशारा", "किनाऱ्यावर", "सांगा",
    "सांग", "करा", "होईल", "येईल", "जाऊ", "येऊ", "मिळेल", "कोणता", "दुसरा",
    "जवळचा", "क्षेत्र", "बघा", "दाखवा", "करायचे", "पाहिजे",
}

# Common Hindi function words and verb suffixes
_HINDI_MARKERS = {
    "है", "हैं", "नहीं", "क्या", "कैसे", "कैसा", "कैसी", "कब", "कहाँ", "कहा",
    "मछली", "मछुआरे", "मौसम", "लहरें", "सुरक्षित", "कल", "आज", "जाना",
    "सकता", "सकती", "सकते", "होगा", "होगी", "होंगे", "मुझे", "आपको", "करना",
    "नाव", "समुद्र", "हवा", "बारिश", "खतरा", "चेतावनी", "तट", "बताओ",
    "बताइए", "जाएं", "जाऊं", "मिलेगा", "कौनसा", "दूसरा", "नजदीकी", "दिखाओ", "चाहिए",
}


def detect_language(text: Optional[str], default_lang: str = "en") -> Tuple[str, float]:
    """
    Detects language code and confidence for input text.
    Returns (lang_code, confidence_score [0.0 - 1.0]).
    """
    if not text or not text.strip():
        return default_lang, 0.0

    cleaned = text.strip()
    words = set(re.findall(r"[\w']+", cleaned.lower()))

    # Script Counter
    script_counts: Dict[str, int] = {
        "Devanagari": 0,
        "Tamil": 0,
        "Telugu": 0,
        "Gujarati": 0,
        "Kannada": 0,
        "Malayalam": 0,
        "Bengali": 0,
        "Odia": 0,
        "Latin": 0,
    }

    for ch in cleaned:
        code = ord(ch)
        if 0x0900 <= code <= 0x097F:
            script_counts["Devanagari"] += 1
        elif 0x0B80 <= code <= 0x0BFF:
            script_counts["Tamil"] += 1
        elif 0x0C00 <= code <= 0x0C7F:
            script_counts["Telugu"] += 1
        elif 0x0A80 <= code <= 0x0AFF:
            script_counts["Gujarati"] += 1
        elif 0x0C80 <= code <= 0x0CFF:
            script_counts["Kannada"] += 1
        elif 0x0D00 <= code <= 0x0D7F:
            script_counts["Malayalam"] += 1
        elif 0x0980 <= code <= 0x09FF:
            script_counts["Bengali"] += 1
        elif 0x0B00 <= code <= 0x0B7F:
            script_counts["Odia"] += 1
        elif (0x0041 <= code <= 0x005A) or (0x0061 <= code <= 0x007A):
            script_counts["Latin"] += 1

    dominant_script, count = max(script_counts.items(), key=lambda item: item[1])
    total_alpha = sum(script_counts.values())

    if total_alpha == 0 or count == 0:
        return default_lang, 0.0

    confidence = round(count / total_alpha, 2)

    if dominant_script == "Tamil":
        return "ta", confidence
    if dominant_script == "Telugu":
        return "te", confidence
    if dominant_script == "Gujarati":
        return "gu", confidence
    if dominant_script == "Kannada":
        return "kn", confidence
    if dominant_script == "Malayalam":
        return "ml", confidence
    if dominant_script == "Bengali":
        return "bn", confidence
    if dominant_script == "Odia":
        return "or", confidence
    if dominant_script == "Latin":
        return "en", confidence

    # Disambiguate Devanagari between Marathi and Hindi
    if dominant_script == "Devanagari":
        # Check direct word matches and stemmed matches
        mr_matches = sum(
            1 for w in words if w in _MARATHI_MARKERS or any(w.startswith(m) for m in ["मासेमारी", "सुरक्षित", "जाण", "हवामान"])
        )
        hi_matches = sum(
            1 for w in words if w in _HINDI_MARKERS or any(w.startswith(m) for m in ["मछली", "सुरक्षित", "मौसम"])
        )

        if mr_matches > hi_matches:
            return "mr", min(1.0, 0.75 + (mr_matches * 0.08))
        elif hi_matches > mr_matches:
            return "hi", min(1.0, 0.75 + (hi_matches * 0.08))

        # Check for Marathi-specific character ळ (U+0933)
        if "ळ" in cleaned:
            return "mr", 0.95

        # Subtlety: default coastal region of ORCA deployment is Maharashtra (Palghar / Satpati)
        # Defaulting Devanagari with tied marker counts to Marathi
        return "mr", 0.75

    return default_lang, 0.5

