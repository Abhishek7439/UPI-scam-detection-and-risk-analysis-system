"""
routes/analyze.py — POST /analyze SSE endpoint.
"""
from __future__ import annotations

import base64
import json
import logging

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from backend.pipeline.runner import run_pipeline

router = APIRouter()
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Demo fallback — safe canned response when ?demo=true
# ---------------------------------------------------------------------------
_DEMO_EVENTS = [
    {"step": "extract_entities", "status": "running"},
    {"step": "extract_entities", "status": "done", "result": {
        "urls": ["sbi-kyc-verify-update.xyz"],
        "upi_ids": [],
        "phone_numbers": [],
        "amounts": [],
        "urgency_phrases": ["kyc (update|verification|expire)", "account (will be )?(blocked|suspended|frozen|closed)"],
        "authority_phrases": ["(sbi|hdfc|icici|axis) bank official"],
        "unsolicited_payment_phrases": [],
        "has_otp_pattern": False,
        "entity_count": 1,
    }},
    {"step": "url_checker", "status": "running"},
    {"step": "url_checker", "status": "done", "result": {
        "score": 85,
        "severity": "high",
        "reasons": [
            "Typosquat of 'sbi.co.in' (edit distance 1)",
            "Suspicious TLD: '.xyz'",
            "Path contains suspicious keyword: 'kyc'",
            "Path contains suspicious keyword: 'verify'",
        ],
    }},
    {"step": "message_classifier", "status": "running"},
    {"step": "message_classifier", "status": "done", "result": {
        "label": "High Risk",
        "risk_category": "Phishing / KYC Scam",
        "matched_signals": ["urgency", "account-block threat", "suspicious URL", "KYC impersonation"],
        "source": "groq",
    }},
    {"step": "qr_decoder", "status": "skipped", "result": {"reasons": ["No QR image provided"]}},
    {"step": "upi_checker", "status": "skipped", "result": {"reasons": ["No UPI ID found"]}},
    {"step": "fuser", "status": "running"},
    {"step": "final",
     "verdict": "High Risk",
     "explanation": (
         "This message is a classic KYC phishing scam. The URL 'sbi-kyc-verify-update.xyz' "
         "is a typosquat of sbi.co.in using a suspicious .xyz TLD, and the message creates "
         "urgency with an account-block threat to pressure you into clicking. "
         "Do NOT click the link or share any details — report to cybercrime.gov.in immediately."
     ),
     "signals": [
         {"source": "url_checker", "signal": "Typosquat of 'sbi.co.in'", "severity": "high"},
         {"source": "url_checker", "signal": "Suspicious TLD: '.xyz'", "severity": "high"},
         {"source": "extractor", "signal": "Urgency phrase: 'kyc (update|verification|expire)'", "severity": "suspicious"},
         {"source": "message_classifier", "signal": "account-block threat", "severity": "high"},
         {"source": "message_classifier", "signal": "KYC impersonation", "severity": "high"},
     ],
     "severity_breakdown": {
         "extractor": "suspicious",
         "url_checker": "high",
         "message_classifier": "high",
         "qr_decoder": "safe",
         "upi_checker": "safe",
     }},
]


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


async def _demo_stream():
    import asyncio
    for event in _DEMO_EVENTS:
        yield _sse(event)
        await asyncio.sleep(0.6)


async def _live_stream(payload: dict):
    async for event in run_pipeline(payload):
        yield _sse(event)


@router.post("/analyze")
async def analyze(request: Request):
    """
    Accepts JSON body:
        {
            text?: string,
            url?: string,
            qr_image?: string,   // base64-encoded image
            upi_id?: string,
        }
    Streams Server-Sent Events.
    """
    is_demo = request.query_params.get("demo", "").lower() == "true"

    if is_demo:
        return StreamingResponse(
            _demo_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
                "Access-Control-Allow-Origin": "*",
            },
        )

    try:
        body = await request.json()
    except Exception:
        body = {}

    text     = body.get("text", "").strip()
    url      = body.get("url", "").strip()
    upi_id   = body.get("upi_id", "").strip()
    qr_b64   = body.get("qr_image", "")

    # Decode base64 QR image if provided
    qr_image: bytes = b""
    if qr_b64:
        try:
            qr_image = base64.b64decode(qr_b64)
        except Exception:
            logger.warning("Invalid base64 QR image — ignoring")

    if not any([text, url, upi_id, qr_image]):
        async def _error():
            yield _sse({"step": "final", "verdict": "Error",
                        "explanation": "Please provide at least one input (message, URL, QR, or UPI ID).",
                        "signals": []})
        return StreamingResponse(_error(), media_type="text/event-stream")

    pipeline_payload = {"text": text, "url": url, "upi_id": upi_id, "qr_image": qr_image}

    return StreamingResponse(
        _live_stream(pipeline_payload),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )
