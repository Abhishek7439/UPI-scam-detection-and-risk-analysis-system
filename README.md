# SentinelPay — UPI Scam Detection & Risk Analysis System

Real-time UPI scam detection pipeline with live agent-trace UI. Accepts suspicious messages, URLs, QR codes, and transaction descriptions — streams a step-by-step analysis and returns a **Safe / Suspicious / High Risk** verdict.

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- A free [Groq API key](https://console.groq.com) *(optional — rule-based fallback activates automatically)*

### 1. Clone & configure
```bash
cp .env.example .env
# Edit .env and paste your GROQ_API_KEY
```

### 2. Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

---

## Architecture
```
Browser ──POST /analyze──► FastAPI ──SSE stream──► Browser
                              │
                    ┌─────────┼──────────┐
                    ▼         ▼          ▼
               Extractor  URLChecker  MsgClassifier (Groq)
                    │         │          │
                    └─────────┼──────────┘
                              ▼
                           Fuser (Groq polish, optional)
                              │
                         Final verdict SSE
```

## Pipeline Steps
| Step | Module | Description |
|------|--------|-------------|
| 1 | `extractor` | Regex entity extraction (URLs, UPI IDs, amounts, urgency) |
| 2 | `url_checker` | Domain heuristics, typosquat, TLD blocklist |
| 3 | `message_classifier` | Groq LLM few-shot classification |
| 4 | `qr_decoder` | OpenCV QR decode, UPI param extraction |
| 5 | `upi_checker` | PSP suffix validation |
| F | `fuser` | Max-severity verdict, Groq explanation polish |

## Test Scenarios
| # | Input | Expected |
|---|-------|----------|
| 1 | Safe OTP SMS | ✅ Safe |
| 2 | KYC message + `sbi-kyc-verify-update.xyz` | 🔴 High Risk |
| 3 | Cashback QR message, no URL | 🟡 Suspicious |
| 4 | QR: `upi://pay?pa=merchantstore@oksbi` | ✅ Safe |
| 5 | QR: plain shortened URL payload | 🔴 High Risk |
| 6 | URL: `paytm-cashback-reward123.info` | 🟡/🔴 High Risk |
