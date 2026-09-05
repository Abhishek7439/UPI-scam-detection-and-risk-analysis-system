"""
message_classifier.py — Groq LLM few-shot classifier.

Falls back to rule-based classification if Groq is unavailable or times out.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re

from backend.config import GROQ_API_KEY, GROQ_MODEL, GROQ_TIMEOUT_S
from backend.seed_data import FEW_SHOT_EXAMPLES

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Rule-based fallback thresholds
# ---------------------------------------------------------------------------
_HIGH_RISK_THRESHOLD = 3   # ≥3 matched signals → High Risk
_SUSPICIOUS_THRESHOLD = 1  # ≥1 matched signal  → Suspicious


def _rule_based_classify(text: str, entities: dict) -> dict:
    """Fast deterministic fallback when Groq is unavailable."""
    signals: list[str] = []

    n_urgency = len(entities.get("urgency_phrases", []))
    n_authority = len(entities.get("authority_phrases", []))
    n_payment = len(entities.get("unsolicited_payment_phrases", []))
    has_url = len(entities.get("urls", [])) > 0
    has_upi = len(entities.get("upi_ids", [])) > 0
    has_otp = entities.get("has_otp_pattern", False)

    if n_urgency:
        signals.append(f"{n_urgency} urgency phrase(s) detected")
    if n_authority:
        signals.append(f"{n_authority} authority-impersonation phrase(s) detected")
    if n_payment:
        signals.append(f"{n_payment} unsolicited-payment phrase(s) detected")
    if has_url:
        signals.append("URL present in message")
    if has_upi:
        signals.append("UPI ID solicited in message")

    total = n_urgency + n_authority + n_payment + (1 if has_url else 0) + (1 if has_upi else 0)

    if has_otp and total <= 1:
        label = "Safe"
        category = "Legitimate OTP / Notification"
    elif total >= _HIGH_RISK_THRESHOLD:
        label = "High Risk"
        category = "Multiple scam signals"
    elif total >= _SUSPICIOUS_THRESHOLD:
        label = "Suspicious"
        category = "Some scam signals"
    else:
        label = "Safe"
        category = "No significant signals"

    return {
        "label": label,
        "risk_category": category,
        "matched_signals": signals,
        "source": "rule_based_fallback",
    }


def _build_system_prompt() -> str:
    examples_json = json.dumps(FEW_SHOT_EXAMPLES, indent=2, ensure_ascii=False)
    return f"""You are SentinelPay, an expert UPI scam detection AI.

Classify the user's message into one of: "Safe", "Suspicious", "High Risk".
Also provide:
- risk_category: short category name (e.g. "Phishing / KYC Scam")
- matched_signals: list of 1-4 concise signal strings

Respond ONLY with a JSON object matching this schema:
{{"label": "...", "risk_category": "...", "matched_signals": ["..."]}}

Here are labelled examples to guide you:
{examples_json}
"""


async def classify_message(text: str, entities: dict) -> dict:
    """
    Classify message text using Groq LLM.
    Falls back to rule-based on any error or timeout.
    """
    if not GROQ_API_KEY:
        logger.info("No GROQ_API_KEY — using rule-based fallback")
        return _rule_based_classify(text, entities)

    try:
        from groq import AsyncGroq

        client = AsyncGroq(api_key=GROQ_API_KEY)

        response = await asyncio.wait_for(
            client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[
                    {"role": "system", "content": _build_system_prompt()},
                    {"role": "user", "content": f"Message to classify:\n{text}"},
                ],
                max_tokens=200,
                temperature=0.1,
            ),
            timeout=GROQ_TIMEOUT_S,
        )

        content = response.choices[0].message.content or ""
        raw = content.strip()
        # Extract JSON even if wrapped in markdown code fences
        json_match = re.search(r"\{.*\}", raw, re.DOTALL)
        if json_match:
            parsed = json.loads(json_match.group())
            parsed["source"] = "groq"
            return parsed

        raise ValueError(f"No JSON in Groq response: {raw}")

    except asyncio.TimeoutError:
        logger.warning("Groq classify timed out — using rule-based fallback")
    except Exception as exc:
        logger.warning("Groq classify failed (%s) — using rule-based fallback", exc)

    return _rule_based_classify(text, entities)
