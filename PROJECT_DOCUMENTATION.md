# SentinelPay — UPI Scam Detection & Risk Analysis System
> **Comprehensive System Documentation & Technical Implementation Guide**

---

## 📋 Executive Summary

**SentinelPay** is an enterprise-grade, multi-modal AI and heuristic security engine designed to detect and mitigate **UPI (Unified Payments Interface) fraud**, phishing links, QR code collect scams, authority impersonation, and social engineering attacks in real time.

By combining computer vision, deep NLP/LLM classification (powered by Groq `llama-3.3-70b-versatile`), Levenshtein typosquatting algorithms, and heuristic VPA (Virtual Payment Address) rule engines, SentinelPay provides instant **Safe**, **Suspicious**, or **High Risk** verdicts within **<500ms**, complete with plain-English explanations and actionable threat breakdowns.

---

## 🏛️ System Architecture

```
                                  +---------------------------------------+
                                  |     SentinelPay Web Frontend         |
                                  |  (React 18 + Vite + Glassmorphism UI) |
                                  +-------------------+-------------------+
                                                      |
                                          HTTP POST / API Stream (SSE)
                                                      |
                                                      v
                                  +-------------------+-------------------+
                                  |       FastAPI Async API Gateway       |
                                  |         (backend/main.py)             |
                                  +-------------------+-------------------+
                                                      |
                                                      v
                                  +-------------------+-------------------+
                                  |    5-Stage Pipeline Orchestrator      |
                                  |        (backend/pipeline/runner.py)   |
                                  +--+---------+---------+---------+------+
                                     |         |         |         |      |
           +-------------------------+         |         |         |      +-------------------------+
           |                                   |         |         |                                |
           v                                   v         v         v                                v
+----------+----------+               +--------+--+   +--+--------+   +----------+----------+   +---------+--------+
| 1. Entity Extractor |               | 2. URL    |   | 3. Message|   | 4. QR Decoder   |   | 5. UPI Handle    |
| (Regex & NLP Patterns)|             |    Checker|   | Classifier|   | (OpenCV + PyZbar)|   |    Checker       |
+----------+----------+               +--------+--+   +--+--------+   +----------+----------+   +---------+--------+
           |                                   |         |         |                                |
           +-------------------------+         |         |         |      +-------------------------+
                                     |         |         |         |      |
                                     v         v         v         v      v
                                  +-------------------+-------------------+
                                  |    Verdict Fusion Engine & Explainer  |
                                  |         (backend/pipeline/fuser.py)   |
                                  +-------------------+-------------------+
                                                      |
                                                      v
                                  +-------------------+-------------------+
                                  | Real-Time SSE Stream back to Client   |
                                  +---------------------------------------+
```

---

## ⚡ Core Features & Capabilities

### 1. Multi-Input Scanning Interface
* **Raw Text & SMS Analysis**: Detects urgency, authority impersonation, fake lottery notifications, and unsolicited payment demands.
* **URL & Web Link Inspection**: Scans hyperlinks against 10 distinct threat dimensions.
* **QR Code Upload & Decode**: Extracts raw payload from images (`.jpg`, `.png`), decodes standard `upi://pay` deep-links and flags non-UPI phishing URLs inside QRs.
* **Direct UPI ID / VPA Lookup**: Checks Virtual Payment Addresses (e.g. `sbi-refund@okaxis`) against known legitimate PSP handles and scam keyword dictionaries.

### 2. Pre-Built Demo Scenarios
Included interactive test cases for live demonstrations:
1. **Safe OTP Message**: Standard bank transaction OTP notification (`Safe`).
2. **KYC Verification Phishing**: Urgent account blockage SMS with a suspicious `.xyz` link (`High Risk`).
3. **Cashback QR Collect Scam**: Fraudulent QR code requesting ₹1 test debit to "receive" ₹500 (`High Risk`).
4. **Fake Investment Scheme**: Telegram trading group solicitation promising 10x returns (`Suspicious`).
5. **Lottery/Winner SMS**: Unsolicited prize notification asking for fee payment (`High Risk`).

---

## 🛠️ Pipeline Technical Details

### Stage 1: Entity Extraction (`extractor.py`)
* **Technology**: Pure regex and compiled rule matchers.
* **Extracted Entities**:
  * URLs & Web Links
  * UPI IDs (`[\w.\-]+@[\w]+`)
  * Indian Phone Numbers (`+91` format)
  * Transaction Amounts (`₹` / `Rs.`)
  * Urgency Phrases (*"immediately"*, *"account blocked"*, *"within 24 hours"*)
  * Authority Impersonation Phrases (*"RBI notice"*, *"Cyber Cell"*, *"Bank Manager"*)
  * Unsolicited Payment Request Phrases (*"pay fee to receive"*, *"send ₹1 to claim"*)
  * Legitimate OTP Patterns

### Stage 2: Heuristic URL Checker (`url_checker.py`)
Scores URLs across 10 weighted threat signals:
1. **Suspicious TLD Check**: Flags `.top`, `.xyz`, `.club`, `.info`, `.work`, `.cn`, `.zip`, etc.
2. **URL Shortener Detection**: Identifies `bit.ly`, `tinyurl.com`, `t.co`, `is.gd`, etc.
3. **Typosquatting Engine**: Uses **Levenshtein Distance** against legitimate banking domains (`sbi.co.in`, `hdfcbank.com`, `icicibank.com`, `paytm.com`, `phonepe.com`).
4. **Homoglyph Detection**: Maps Unicode lookalike characters back to ASCII to catch visual deception.
5. **Brand Keyword Embedding**: Flags hyphenated keywords like `sbi-kyc-update.com`.
6. **Subdomain Depth**: Detects excessive subdomains (e.g., `login.bank.verify.scam.com`).
7. **Raw IP Host**: Flags direct IP addresses (e.g., `http://192.168.1.1/login`).
8. **Path Keywords**: Searches for sensitive path elements (`/kyc`, `/verify`, `/otp`, `/bank`).
9. **URL Length Anomaly**: Flags URLs exceeding 100 characters.
10. **TLS/HTTPS Check**: Rewards secure connections and flags plain `http://`.

### Stage 3: Message Classifier (`message_classifier.py`)
* **Primary Classifier**: Groq Cloud LLM (`llama-3.3-70b-versatile`) with structured JSON schema response requirement.
* **Timeout Guard**: Strictly guarded by a **2.0-second timeout**.
* **Deterministic Fallback**: If Groq API key is absent, network drops, or timeout triggers, automatically executes rule-based feature matrix scoring to ensure **zero downtime**.

### Stage 4: QR Code Decoder (`qr_decoder.py`)
* **Technology**: OpenCV (`cv2`) + PyZbar image processing.
* **UPI Deep-Link Parsing**: Decodes `upi://pay?pa=...&pn=...&am=...&tn=...&cu=INR`.
* **Risk Hooks**:
  * Flags **Re1 / ₹1 test transactions** (classic collect scam technique).
  * Flags missing Payee Names (`pn`).
  * Flags suspicious Payee Name keywords (*"Cashback"*, *"Reward"*, *"Prize"*, *"Verify"*).
  * Flags non-UPI URLs embedded inside QR images as **High Risk**.

### Stage 5: UPI Handle Checker (`upi_checker.py`)
* **VPA Syntax Validation**: Checks handle format compliance.
* **PSP Provider Check**: Validates suffix against 40+ recognized Indian PSP handles (`@okaxis`, `@ybl`, `@paytm`, `@sbi`, `@icici`, `@ibl`, `@axl`, etc.).
* **Scam Local-Part Analysis**: Inspects local-part for high-risk keywords (*"refund"*, *"kyc"*, *"support"*, *"care"*, *"govt"*, *"tax"*).
* **Digit Ratio Anomaly**: Identifies auto-generated scam handles with high digit proportions.

### Verdict Fusion & Explainer (`fuser.py`)
* Aggregates individual stage risk ratings into a unified verdict using a **Max-Severity Matrix**:
  * `Safe` (0) < `Suspicious` (1) < `High Risk` (2)
* Assembles a structured list of detected signals with source attribution.
* Generates a 2-sentence plain-English explanation using Groq (or fallback template).

---

## 📂 File & Directory Structure

```
UPI Scam Detection & Risk Analysis System/
│
├── backend/                        # FastAPI Backend Application
│   ├── pipeline/                   # 5-Stage Risk Analysis Engine
│   │   ├── __init__.py
│   │   ├── extractor.py            # Regex & NLP Entity Extraction
│   │   ├── url_checker.py          # Typosquatting & Heuristic URL Scoring
│   │   ├── message_classifier.py   # Groq LLM + Fallback Classifier
│   │   ├── qr_decoder.py           # OpenCV/PyZbar QR Payload Parser
│   │   ├── upi_checker.py          # VPA Format & PSP Handle Inspector
│   │   ├── fuser.py                # Verdict Fusion & Explanation Engine
│   │   └── runner.py               # Async Pipeline Stream Orchestrator
│   │
│   ├── routes/                     # API Route Controllers
│   │   ├── __init__.py
│   │   ├── analyze.py              # SSE Stream (/api/analyze/stream) & POST
│   │   └── health.py               # Healthcheck (/api/health)
│   │
│   ├── config.py                   # Environment Configuration & Constants
│   ├── seed_data.py                # Known Brands, TLDs, PSPs & Few-Shot Data
│   ├── main.py                     # FastAPI Application Initialization
│   └── requirements.txt            # Python Dependencies
│
├── frontend/                       # React 18 + Vite Frontend Application
│   ├── src/
│   │   ├── api/
│   │   │   └── stream.js           # SSE Reader & Stream Parser
│   │   ├── components/
│   │   │   ├── Header.jsx          # Glassmorphism Top Navigation & Logo
│   │   │   ├── InputForm.jsx       # Multi-Modal Input Tabs & Presets
│   │   │   ├── PipelineTrace.jsx   # Real-Time Stage Progress Bar & Cards
│   │   │   ├── VerdictBadge.jsx    # Verdict Result Banner & Gauge
│   │   │   ├── SignalList.jsx      # Threat Signal Badges & Attribution
│   │   │   ├── AnalyticsDashboard.jsx # Security Statistics & Charts
│   │   │   └── RecentScans.jsx     # Live History Console
│   │   ├── App.jsx                 # Master Layout & State Controller
│   │   └── index.css               # Design Tokens & Glassmorphism Styling
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── test_qr.py                      # Automated QR & Pipeline Verification Script
├── README.md                       # Repository Overview
└── PROJECT_DOCUMENTATION.md        # Complete Implementation Specification
```

---

## 🚀 API Endpoint Reference

### 1. Healthcheck Endpoint
* **GET** `/api/health`
* **Response**:
  ```json
  {
    "status": "healthy",
    "version": "1.0.0",
    "groq_enabled": true
  }
  ```

### 2. Real-Time Pipeline SSE Endpoint
* **POST / GET** `/api/analyze/stream`
* **Content-Type**: `multipart/form-data`
* **Form Parameters**:
  * `text` *(optional, string)*: SMS, message body, or description.
  * `url` *(optional, string)*: Suspicious hyperlink.
  * `upi_id` *(optional, string)*: Target VPA handle.
  * `qr_file` *(optional, file)*: Image upload (`.png`, `.jpg`).
* **Event Stream Output**:
  ```http
  data: {"step": "extract_entities", "status": "running"}
  data: {"step": "extract_entities", "status": "done", "result": {...}}
  data: {"step": "url_checker", "status": "running"}
  ...
  data: {"step": "final", "verdict": "High Risk", "explanation": "...", "signals": [...]}
  ```

---

## 💻 Tech Stack Summary

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend Core** | React 18, Vite, JavaScript (ESNext) |
| **Styling & UI** | Custom Vanilla CSS (Glassmorphism), Lucide React Icons |
| **Backend Framework** | FastAPI, Uvicorn (ASGI) |
| **AI / LLM Engine** | Groq Cloud API (`llama-3.3-70b-versatile`) |
| **Computer Vision** | OpenCV (`cv2`), PyZbar, Pillow (`PIL`) |
| **NLP & Matching** | Levenshtein Distance, `tldextract`, Regex Engine |
| **Streaming** | Server-Sent Events (SSE) via `EventSource` / `fetch` readable streams |

---

## 🛠️ Verification & Code Quality Metrics

- **Type Checker Status**: `mypy --explicit-package-bases backend` -> **0 errors (14 files passed)**
- **Linter Status**: `flake8 backend/pipeline` -> **0 errors**
- **Git Repository**: Pushed to `https://github.com/Abhishek7439/UPI-scam-detection-and-risk-analysis-system.git`

---

*Generated by SentinelPay Engineering Team — 2026*
