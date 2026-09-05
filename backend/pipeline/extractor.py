"""
extractor.py — Pure regex entity extraction. No LLM calls.

Returns a dict with all extracted entities from raw text input.
"""
import re
from backend.seed_data import URGENCY_PHRASES, AUTHORITY_PHRASES, UNSOLICITED_PAYMENT_PHRASES


# ---------------------------------------------------------------------------
# Compiled patterns
# ---------------------------------------------------------------------------
_URL_RE = re.compile(
    r"https?://[^\s]+"
    r"|www\.[a-zA-Z0-9\-]+\.[a-zA-Z]{2,}[^\s]*",
    re.IGNORECASE,
)
_UPI_RE = re.compile(r"[\w.\-]+@[\w]+", re.IGNORECASE)
_PHONE_RE = re.compile(r"(?:\+91[-\s]?)?[6-9]\d{9}")
_AMOUNT_RE = re.compile(r"(?:₹|rs\.?\s*)(\d[\d,]*(?:\.\d{1,2})?)", re.IGNORECASE)
_OTP_RE = re.compile(r"\b\d{4,8}\b")

_URGENCY_RES = [re.compile(p, re.IGNORECASE) for p in URGENCY_PHRASES]
_AUTHORITY_RES = [re.compile(p, re.IGNORECASE) for p in AUTHORITY_PHRASES]
_PAYMENT_RES = [re.compile(p, re.IGNORECASE) for p in UNSOLICITED_PAYMENT_PHRASES]


def extract_entities(text: str) -> dict:
    """Extract all structured entities from raw text."""
    urls = _URL_RE.findall(text)
    upi_ids = _UPI_RE.findall(text)
    phones = _PHONE_RE.findall(text)
    amount_strs = _AMOUNT_RE.findall(text)
    amounts = [float(a.replace(",", "")) for a in amount_strs]

    # Matched phrases
    urgency_matches = [
        p for p, rx in zip(URGENCY_PHRASES, _URGENCY_RES)
        if rx.search(text)
    ]
    authority_matches = [
        p for p, rx in zip(AUTHORITY_PHRASES, _AUTHORITY_RES)
        if rx.search(text)
    ]
    payment_matches = [
        p for p, rx in zip(UNSOLICITED_PAYMENT_PHRASES, _PAYMENT_RES)
        if rx.search(text)
    ]

    # Looks like an OTP SMS (not suspicious by itself)
    has_otp_pattern = bool(re.search(
        r"otp\s+(is|for|:)\s*\d{4,8}|one[- ]time\s+pass", text, re.IGNORECASE
    ))

    return {
        "urls": urls,
        "upi_ids": upi_ids,
        "phone_numbers": phones,
        "amounts": amounts,
        "urgency_phrases": urgency_matches,
        "authority_phrases": authority_matches,
        "unsolicited_payment_phrases": payment_matches,
        "has_otp_pattern": has_otp_pattern,
        "entity_count": len(urls) + len(upi_ids) + len(phones),
    }
