"""
upi_checker.py — UPI handle / VPA validation.

Validates UPI ID format and PSP suffix against the known-good list.
Also flags suspicious keywords embedded in the VPA local part.
"""
from __future__ import annotations

import re

from backend.seed_data import LEGIT_PSP_SUFFIXES

_UPI_FORMAT_RE = re.compile(r"^[\w.\-]+@[\w]+$", re.IGNORECASE)

_SUSPICIOUS_LOCAL_KEYWORDS = [
    "kyc", "update", "verify", "secure", "help", "care", "support",
    "refund", "cashback", "prize", "lottery", "official", "bank",
    "income", "tax", "govt", "rbi", "police", "cbi",
]


def check_upi_handle(upi_id: str) -> dict:
    """
    Validate a UPI ID and return risk signals.

    Returns:
        {
            valid_format: bool,
            valid_psp: bool,
            suspicious_keywords: list[str],
            severity: "safe" | "suspicious" | "high",
            reasons: list[str],
        }
    """
    reasons: list[str] = []
    suspicious_keywords: list[str] = []

    # 1. Format check
    valid_format = bool(_UPI_FORMAT_RE.match(upi_id.strip()))
    if not valid_format:
        return {
            "valid_format": False,
            "valid_psp": False,
            "suspicious_keywords": [],
            "severity": "suspicious",
            "reasons": ["Invalid UPI ID format"],
        }

    local_part, psp = upi_id.rsplit("@", 1)
    handle = f"@{psp.lower()}"

    # 2. PSP suffix check
    valid_psp = handle in LEGIT_PSP_SUFFIXES
    if not valid_psp:
        reasons.append(f"Unrecognised PSP handle: '{handle}' — not in known UPI provider list")

    # 3. Suspicious keywords in local part
    local_lower = local_part.lower()
    for kw in _SUSPICIOUS_LOCAL_KEYWORDS:
        if kw in local_lower:
            suspicious_keywords.append(kw)

    if suspicious_keywords:
        reasons.append(
            f"Local part contains suspicious keyword(s): {', '.join(suspicious_keywords)}"
        )

    # 4. Numeric-heavy local part (e.g. scam99999@ybl)
    digit_ratio = sum(c.isdigit() for c in local_part) / max(len(local_part), 1)
    if digit_ratio > 0.5 and len(local_part) > 4:
        reasons.append("Local part is mostly digits — potentially auto-generated scam ID")

    # Determine severity
    n_issues = (0 if valid_psp else 1) + len(suspicious_keywords)
    if n_issues >= 2:
        severity = "high"
    elif n_issues == 1:
        severity = "suspicious"
    else:
        severity = "safe"
        reasons.append("UPI ID format and PSP handle look legitimate")

    return {
        "valid_format": valid_format,
        "valid_psp": valid_psp,
        "suspicious_keywords": suspicious_keywords,
        "severity": severity,
        "reasons": reasons,
    }
