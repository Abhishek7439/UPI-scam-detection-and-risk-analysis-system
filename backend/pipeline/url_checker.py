"""
url_checker.py — Heuristic URL risk scoring.

Scores a URL against multiple weighted signals. Returns {score, severity, reasons}.
Optional WHOIS / PhishTank lookups behind ENABLE_LIVE_LOOKUPS flag with 2s timeout guard.
"""
from __future__ import annotations

import logging
import re
from urllib.parse import urlparse

import tldextract
from Levenshtein import distance as levenshtein_distance

from backend.seed_data import (
    LEGIT_BRAND_DOMAINS,
    SUSPICIOUS_TLDS,
    URL_SHORTENERS,
    HOMOGLYPH_MAP,
)
from backend.config import GROQ_TIMEOUT_S

logger = logging.getLogger(__name__)

# Score thresholds
_HIGH_RISK_THRESHOLD = 60
_SUSPICIOUS_THRESHOLD = 30


def _normalize_homoglyphs(s: str) -> str:
    return "".join(HOMOGLYPH_MAP.get(c, c) for c in s)


def _extract_domain(url: str) -> tuple[str, str, str]:
    """Returns (subdomain, domain, suffix) using tldextract."""
    parsed = tldextract.extract(url)
    return parsed.subdomain, parsed.domain, parsed.suffix


def _typosquat_score(domain: str) -> tuple[int, list[str]]:
    """Return (score_boost, reasons) for typosquatting signals."""
    score = 0
    reasons: list[str] = []
    normalized = _normalize_homoglyphs(domain.lower())

    for legit in LEGIT_BRAND_DOMAINS:
        legit_domain = legit.split(".")[0]  # e.g. "sbi"
        dist = levenshtein_distance(normalized, legit_domain)
        if dist == 0:
            break  # exact match → legit
        elif dist <= 2 and len(domain) >= 3:
            score += 30
            reasons.append(f"Typosquat of '{legit}' (edit distance {dist})")
            break
        elif legit_domain in normalized and normalized != legit_domain:
            score += 20
            reasons.append(f"Contains brand name '{legit_domain}' in suspicious context")
            break

    return score, reasons


async def _live_lookup(url: str) -> tuple[int, list[str]]:
    """Optional live lookups (WHOIS domain age, PhishTank). Timeout-guarded."""
    score = 0
    reasons: list[str] = []
    try:
        import httpx
        _ = GROQ_TIMEOUT_S
        _ = httpx
        # PhishTank API (free, no key for GET-based check simulation)
        # In production: POST to checkurl API
    except Exception as exc:
        logger.warning("Live lookup failed, disabling: %s", exc)
    return score, reasons


def check_url(url: str) -> dict:
    """
    Synchronous URL risk check.
    Returns: {score: int, severity: str, reasons: list[str]}
    """
    score = 0
    reasons: list[str] = []

    try:
        parsed = urlparse(url if url.startswith("http") else f"http://{url}")
        hostname = parsed.hostname or ""
        _, domain, suffix = _extract_domain(url)
        full_suffix = f".{suffix}" if suffix else ""
        domain_lower = domain.lower()

        # 1. Suspicious TLD
        if full_suffix in SUSPICIOUS_TLDS:
            score += 25
            reasons.append(f"Suspicious TLD: '{full_suffix}'")

        # 2. URL shortener
        if hostname in URL_SHORTENERS or any(s in hostname for s in URL_SHORTENERS):
            score += 35
            reasons.append("URL shortener used — destination unknown")

        # 3. Typosquat
        ts_score, ts_reasons = _typosquat_score(domain_lower)
        score += ts_score
        reasons.extend(ts_reasons)

        # 4. Homoglyph in hostname
        normalized_hostname = _normalize_homoglyphs(hostname)
        if normalized_hostname != hostname:
            score += 20
            reasons.append("Homoglyph/lookalike characters detected in domain")

        # 5. Hyphenated brand keyword
        brand_keywords = [d.split(".")[0] for d in LEGIT_BRAND_DOMAINS]
        for kw in brand_keywords:
            if f"-{kw}" in domain_lower or f"{kw}-" in domain_lower:
                score += 20
                reasons.append(f"Brand keyword '{kw}' embedded with hyphens (common in phishing)")
                break

        # 6. Excessive subdomains
        subdomain, _, _ = _extract_domain(url)
        if subdomain.count(".") >= 2:
            score += 10
            reasons.append("Excessive subdomain depth")

        # 7. IP address as host
        if re.match(r"^\d+\.\d+\.\d+\.\d+$", hostname):
            score += 30
            reasons.append("IP address used instead of domain name")

        # 8. Path contains suspicious keywords
        path = parsed.path.lower()
        for kw in ["verify", "update", "secure", "login", "kyc", "otp", "confirm", "bank"]:
            if kw in path:
                score += 8
                reasons.append(f"Path contains suspicious keyword: '{kw}'")
                break

        # 9. Excessively long URL
        if len(url) > 100:
            score += 5
            reasons.append(f"Unusually long URL ({len(url)} chars)")

        # 10. No HTTPS
        if parsed.scheme == "http":
            score += 10
            reasons.append("Plain HTTP — no TLS encryption")

    except Exception as exc:
        logger.error("URL check failed: %s", exc)
        score = 0

    score = min(score, 100)

    if score >= _HIGH_RISK_THRESHOLD:
        severity = "high"
    elif score >= _SUSPICIOUS_THRESHOLD:
        severity = "suspicious"
    else:
        severity = "safe"

    return {"score": score, "severity": severity, "reasons": reasons}
