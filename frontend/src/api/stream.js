/**
 * stream.js — SSE streaming client for /analyze
 *
 * Uses fetch() + ReadableStream to consume the SSE stream.
 * Handles partial chunks correctly with an internal buffer.
 *
 * Usage:
 *   analyzeStream(payload, onStep, onFinal, onError)
 */

const API_BASE = "http://localhost:8000";

/**
 * @param {Object}   payload  — { text, url, qr_image (base64), upi_id }
 * @param {Function} onStep   — called with each step event object
 * @param {Function} onFinal  — called once with the final verdict object
 * @param {Function} onError  — called on fetch / parse errors
 */
export async function analyzeStream(payload, onStep, onFinal, onError) {
  try {
    const url = `${API_BASE}/analyze`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by double newlines
      const parts = buffer.split("\n\n");
      buffer = parts.pop(); // keep incomplete trailing chunk

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data:")) continue;
        const jsonStr = line.slice(5).trim();
        try {
          const event = JSON.parse(jsonStr);
          if (event.step === "final") {
            onFinal(event);
          } else {
            onStep(event);
          }
        } catch (parseErr) {
          console.warn("Failed to parse SSE event:", jsonStr, parseErr);
        }
      }
    }
  } catch (err) {
    console.error("Stream error:", err);
    onError(err.message || "Connection failed");
  }
}

/**
 * Demo mode — hits ?demo=true for a canned response when backend offline.
 */
export async function analyzeDemo(onStep, onFinal, onError) {
  try {
    const res = await fetch(`${API_BASE}/analyze?demo=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "demo" }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop();
      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data:")) continue;
        try {
          const event = JSON.parse(line.slice(5).trim());
          if (event.step === "final") onFinal(event);
          else onStep(event);
        } catch {}
      }
    }
  } catch (err) {
    onError(err.message || "Demo failed");
  }
}
