"""
fuser.py — Deterministic verdict fusion + optional Groq explanation polish.

Aggregates all pipeline step outputs, computes max-severity verdict,
assembles a structured signal list, and optionally polishes the explanation
with a second Groq call (2s timeout, falls back to template if it fails).
"""
from __future__ import annotations

import asyncio
import logging
import re

from backend.config import GROQ_API_KEY, GROQ_MODEL, GROQ_TIMEOUT_S

logger = logging.getLogger(__name__)

# Severity ordering
_SEVERITY_ORDER = {"safe": 0, "suspicious": 1, "high": 2}
_VERDICT_MAP = {"safe": "Safe", "suspicious": "Suspicious", "high": "High Risk"}

_VERDICT_TEMPLATES = {
    "Safe": (
        "✅ This input shows no significant scam indicators. "
        "Standard precautions still apply — always verify before sending money."
    ),
    "Suspicious": (
        "⚠️ Several suspicious patterns were detected. This could be a scam attempt. "
        "Do NOT send any money or share personal details until you independently verify the source."
    ),
    "High Risk": (
        "🛑 Multiple high-confidence scam signals were detected. "
        "This is very likely a fraudulent attempt. Do NOT engage. "
        "Report to cybercrime.gov.in and block the sender immediately."
    ),
}


def _max_severity(*severities: str) -> str:
    return max(severities, key=lambda s: _SEVERITY_ORDER.get(s, 0))


def _collect_signals(all_outputs: dict) -> list[dict]:
    """Build a flat signal list from all step results."""
    signals: list[dict] = []

    # Extractor signals
    ext = all_outputs.get("extractor", {})
    for phrase in ext.get("urgency_phrases", [])[:3]:
        signals.append({"source": "extractor", "signal": f"Urgency phrase: '{phrase[:60]}'", "severity": "suspicious"})
    for phrase in ext.get("authority_phrases", [])[:2]:
        signals.append({"source": "extractor", "signal": f"Authority impersonation: '{phrase[:60]}'", "severity": "high"})
    for phrase in ext.get("unsolicited_payment_phrases", [])[:2]:
        signals.append({"source": "extractor", "signal": f"Unsolicited payment request: '{phrase[:60]}'", "severity": "suspicious"})

    # URL checker signals
    url_res = all_outputs.get("url_checker", {})
    for reason in url_res.get("reasons", [])[:4]:
        signals.append({
            "source": "url_checker",
            "signal": reason,
            "severity": url_res.get("severity", "safe"),
        })

    # Message classifier signals
    msg = all_outputs.get("message_classifier", {})
    for signal in msg.get("matched_signals", [])[:4]:
        signals.append({
            "source": "message_classifier",
            "signal": signal,
            "severity": "high" if msg.get("label") == "High Risk" else "suspicious",
        })

    # QR decoder signals
    qr = all_outputs.get("qr_decoder", {})
    for reason in qr.get("reasons", [])[:3]:
        signals.append({
            "source": "qr_decoder",
            "signal": reason,
            "severity": qr.get("severity", "safe"),
        })

    # UPI checker signals
    upi = all_outputs.get("upi_checker", {})
    for reason in upi.get("reasons", [])[:3]:
        signals.append({
            "source": "upi_checker",
            "signal": reason,
            "severity": upi.get("severity", "safe"),
        })

    return signals


async def _groq_polish(verdict: str, signals: list[dict], template: str) -> str:
    """Ask Groq to write a concise, human-readable explanation. 2s timeout."""
    if not GROQ_API_KEY:
        return template

    signal_lines = "\n".join(f"- [{s['source']}] {s['signal']}" for s in signals[:6])
    prompt = (
        f"You are SentinelPay. Write a 2-3 sentence plain-English explanation "
        f"for a '{verdict}' verdict on a UPI transaction. "
        f"Be specific, cite 1-2 key signals. Do NOT use markdown.\n\n"
        f"Key signals detected:\n{signal_lines}"
    )

    try:
        from groq import AsyncGroq
        client = AsyncGroq(api_key=GROQ_API_KEY)
        response = await asyncio.wait_for(
            client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=150,
                temperature=0.3,
            ),
            timeout=GROQ_TIMEOUT_S,
        )
        polished = response.choices[0].message.content.strip()
        # Sanitise — remove any markdown leftovers
        polished = re.sub(r"\*+", "", polished)
        return polished if polished else template
    except Exception as exc:
        logger.warning("Groq polish failed (%s) — using template", exc)
        return template


async def fuse_and_explain(all_outputs: dict) -> dict:
    """
    Compute final verdict and explanation from all pipeline outputs.

    Returns:
        {
            verdict: "Safe" | "Suspicious" | "High Risk",
            explanation: str,
            signals: list[{source, signal, severity}],
            severity_breakdown: dict,
        }
    """
    # Collect per-step severities
    sev_ext = "safe"
    ext = all_outputs.get("extractor", {})
    total_flags = (
        len(ext.get("urgency_phrases", []))
        + len(ext.get("authority_phrases", []))
        + len(ext.get("unsolicited_payment_phrases", []))
    )
    if total_flags >= 3:
        sev_ext = "high"
    elif total_flags >= 1:
        sev_ext = "suspicious"

    sev_url = all_outputs.get("url_checker", {}).get("severity", "safe")
    sev_msg = {
        "Safe": "safe", "Suspicious": "suspicious", "High Risk": "high"
    }.get(all_outputs.get("message_classifier", {}).get("label", "Safe"), "safe")
    sev_qr  = all_outputs.get("qr_decoder", {}).get("severity", "safe")
    sev_upi = all_outputs.get("upi_checker", {}).get("severity", "safe")

    raw_severity = _max_severity(sev_ext, sev_url, sev_msg, sev_qr, sev_upi)
    verdict = _VERDICT_MAP[raw_severity]
    template = _VERDICT_TEMPLATES[verdict]

    signals = _collect_signals(all_outputs)

    # Polish with Groq (best-effort)
    explanation = await _groq_polish(verdict, signals, template)

    return {
        "verdict": verdict,
        "explanation": explanation,
        "signals": signals,
        "severity_breakdown": {
            "extractor": sev_ext,
            "url_checker": sev_url,
            "message_classifier": sev_msg,
            "qr_decoder": sev_qr,
            "upi_checker": sev_upi,
        },
    }
