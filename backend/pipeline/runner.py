"""
runner.py — Async pipeline orchestrator.

Runs all steps in order, yielding SSE-ready dicts per step.
Never hangs: every step has its own try/except.
"""
from __future__ import annotations

import asyncio
import logging
from typing import AsyncGenerator

from backend.pipeline.extractor import extract_entities
from backend.pipeline.url_checker import check_url
from backend.pipeline.message_classifier import classify_message
from backend.pipeline.qr_decoder import decode_qr
from backend.pipeline.upi_checker import check_upi_handle
from backend.pipeline.fuser import fuse_and_explain

logger = logging.getLogger(__name__)


async def run_pipeline(payload: dict) -> AsyncGenerator[dict, None]:
    """
    Async generator that yields pipeline step events.

    Payload fields (all optional except at least one must be set):
        text: str           — raw message / transaction description
        url: str            — URL to analyse
        qr_image: bytes     — raw QR image bytes
        upi_id: str         — UPI ID to validate
    """
    text: str = payload.get("text", "")
    url: str = payload.get("url", "")
    qr_image: bytes = payload.get("qr_image", b"")
    upi_id: str = payload.get("upi_id", "")

    all_outputs: dict = {}

    # ── Step 1: Entity Extraction ─────────────────────────────────
    yield {"step": "extract_entities", "status": "running"}
    try:
        combined_text = f"{text} {url} {upi_id}".strip()
        entities = extract_entities(combined_text)
        all_outputs["extractor"] = entities
        yield {"step": "extract_entities", "status": "done", "result": entities}
    except Exception as exc:
        logger.error("Extractor failed: %s", exc)
        all_outputs["extractor"] = {}
        yield {"step": "extract_entities", "status": "error", "result": {"error": str(exc)}}

    # ── Step 2: URL Check ─────────────────────────────────────────
    # Use URL from payload, OR first URL found by extractor
    effective_url = url or (all_outputs.get("extractor", {}).get("urls") or [""])[0]
    if effective_url:
        yield {"step": "url_checker", "status": "running"}
        try:
            url_result = await asyncio.get_event_loop().run_in_executor(
                None, check_url, effective_url
            )
            all_outputs["url_checker"] = url_result
            yield {"step": "url_checker", "status": "done", "result": url_result}
        except Exception as exc:
            logger.error("URL checker failed: %s", exc)
            all_outputs["url_checker"] = {"severity": "safe", "score": 0, "reasons": []}
            yield {"step": "url_checker", "status": "error", "result": {"error": str(exc)}}
    else:
        all_outputs["url_checker"] = {"severity": "safe", "score": 0, "reasons": []}
        yield {"step": "url_checker", "status": "skipped", "result": {"reasons": ["No URL provided"]}}

    # ── Step 3: Message Classification ───────────────────────────
    if text:
        yield {"step": "message_classifier", "status": "running"}
        try:
            msg_result = await classify_message(text, all_outputs.get("extractor", {}))
            all_outputs["message_classifier"] = msg_result
            yield {"step": "message_classifier", "status": "done", "result": msg_result}
        except Exception as exc:
            logger.error("Message classifier failed: %s", exc)
            all_outputs["message_classifier"] = {"label": "Safe", "risk_category": "Unknown", "matched_signals": []}
            yield {"step": "message_classifier", "status": "error", "result": {"error": str(exc)}}
    else:
        all_outputs["message_classifier"] = {"label": "Safe", "risk_category": "N/A", "matched_signals": []}
        yield {"step": "message_classifier", "status": "skipped", "result": {"reasons": ["No message text provided"]}}

    # ── Step 4: QR Decode ─────────────────────────────────────────
    if qr_image:
        yield {"step": "qr_decoder", "status": "running"}
        try:
            qr_result = await asyncio.get_event_loop().run_in_executor(
                None, decode_qr, qr_image
            )
            all_outputs["qr_decoder"] = qr_result
            # If QR contains UPI ID, pass it forward
            upi_params = qr_result.get("upi_params") or {}
            if upi_params.get("pa"):
                upi_id = upi_id or upi_params["pa"]
            yield {"step": "qr_decoder", "status": "done", "result": qr_result}
        except Exception as exc:
            logger.error("QR decoder failed: %s", exc)
            all_outputs["qr_decoder"] = {"severity": "safe", "reasons": []}
            yield {"step": "qr_decoder", "status": "error", "result": {"error": str(exc)}}
    else:
        all_outputs["qr_decoder"] = {"severity": "safe", "reasons": []}
        yield {"step": "qr_decoder", "status": "skipped", "result": {"reasons": ["No QR image provided"]}}

    # ── Step 5: UPI Handle Check ──────────────────────────────────
    # Also check any UPI IDs extracted from message
    effective_upi = upi_id or (all_outputs.get("extractor", {}).get("upi_ids") or [""])[0]
    if effective_upi:
        yield {"step": "upi_checker", "status": "running"}
        try:
            upi_result = await asyncio.get_event_loop().run_in_executor(
                None, check_upi_handle, effective_upi
            )
            all_outputs["upi_checker"] = upi_result
            yield {"step": "upi_checker", "status": "done", "result": upi_result}
        except Exception as exc:
            logger.error("UPI checker failed: %s", exc)
            all_outputs["upi_checker"] = {"severity": "safe", "reasons": []}
            yield {"step": "upi_checker", "status": "error", "result": {"error": str(exc)}}
    else:
        all_outputs["upi_checker"] = {"severity": "safe", "reasons": []}
        yield {"step": "upi_checker", "status": "skipped", "result": {"reasons": ["No UPI ID found"]}}

    # ── Final: Fuse & Explain ─────────────────────────────────────
    yield {"step": "fuser", "status": "running"}
    try:
        final = await fuse_and_explain(all_outputs)
        yield {
            "step": "final",
            "verdict": final["verdict"],
            "explanation": final["explanation"],
            "signals": final["signals"],
            "severity_breakdown": final["severity_breakdown"],
        }
    except Exception as exc:
        logger.error("Fuser failed: %s", exc)
        yield {
            "step": "final",
            "verdict": "Suspicious",
            "explanation": "Analysis completed with errors — treat as suspicious.",
            "signals": [],
            "severity_breakdown": {},
        }
