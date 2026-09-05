"""
qr_decoder.py — OpenCV QR decode + UPI parameter extraction.

Accepts raw image bytes, decodes any QR code, and parses UPI deep-link params.
Generic (non-UPI) URL payloads are auto-flagged High Risk.
"""
from __future__ import annotations

import logging
from urllib.parse import parse_qs, urlparse

logger = logging.getLogger(__name__)


def decode_qr(image_bytes: bytes) -> dict:
    """
    Decode a QR code from raw image bytes.

    Returns:
        {
            decoded_text: str | None,
            is_upi: bool,
            upi_params: {pa, pn, am, tn, ...} | None,
            severity: "safe" | "suspicious" | "high",
            reasons: list[str],
        }
    """
    decoded_text: str | None = None

    try:
        import cv2
        import numpy as np

        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return _error_result("Could not decode image file")

        detector = cv2.QRCodeDetector()
        data, _, _ = detector.detectAndDecode(img)

        if data:
            decoded_text = data
        else:
            return _error_result("No QR code detected in image")

    except ImportError:
        return _error_result("OpenCV not installed — QR decode unavailable")
    except Exception as exc:
        logger.error("QR decode error: %s", exc)
        return _error_result(str(exc))

    return _analyse_payload(decoded_text)


def _analyse_payload(text: str) -> dict:
    reasons: list[str] = []
    upi_params: dict | None = None
    severity = "safe"

    # ── UPI deep-link ────────────────────────────────────────────
    if text.lower().startswith("upi://pay"):
        parsed = urlparse(text)
        qs = parse_qs(parsed.query)

        pa = qs.get("pa", [None])[0]    # payee UPI ID
        pn = qs.get("pn", [None])[0]    # payee name
        am = qs.get("am", [None])[0]    # amount
        tn = qs.get("tn", [None])[0]    # transaction note
        cu = qs.get("cu", ["INR"])[0]   # currency

        upi_params = {"pa": pa, "pn": pn, "am": am, "tn": tn, "cu": cu}

        # Amount = 0 or ₹1 test transaction (common collect scam hook)
        if am is not None:
            try:
                amount_f = float(am)
                if amount_f <= 1:
                    severity = "suspicious"
                    reasons.append("Re₹1 test transaction — common scam hook; scanning auto-debits your account")
            except ValueError:
                pass

        # Missing payee name
        if not pn:
            reasons.append("No payee name (pn) in QR — unverified merchant")
            if severity == "safe":
                severity = "suspicious"

        # Suspicious payee name keywords
        if pn:
            pn_lower = pn.lower()
            for kw in ["cashback", "prize", "reward", "receive", "earn", "kyc", "verify"]:
                if kw in pn_lower:
                    severity = "high"
                    reasons.append(f"Payee name contains suspicious keyword: '{kw}'")
                    break

        if not reasons:
            reasons.append("Legitimate UPI payment QR — verify payee before paying")

        return {
            "decoded_text": text,
            "is_upi": True,
            "upi_params": upi_params,
            "severity": severity,
            "reasons": reasons,
        }

    # ── Non-UPI URL payload ──────────────────────────────────────
    if text.startswith("http") or text.startswith("www."):
        severity = "high"
        reasons.append("QR code contains a plain URL instead of UPI payment link — High Risk")
        reasons.append("Legitimate payment QRs always use upi://pay scheme")
        return {
            "decoded_text": text,
            "is_upi": False,
            "upi_params": None,
            "severity": severity,
            "reasons": reasons,
        }

    # ── Plain text payload ───────────────────────────────────────
    return {
        "decoded_text": text,
        "is_upi": False,
        "upi_params": None,
        "severity": "suspicious",
        "reasons": ["QR code contains plain text — unusual for payment QRs"],
    }


def _error_result(message: str) -> dict:
    return {
        "decoded_text": None,
        "is_upi": False,
        "upi_params": None,
        "severity": "safe",
        "reasons": [f"QR decode skipped: {message}"],
    }
