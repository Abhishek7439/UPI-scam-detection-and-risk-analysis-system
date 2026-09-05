"""Static seed data used across the pipeline."""

# ---------------------------------------------------------------------------
# Legitimate brand domains (for typosquat detection)
# ---------------------------------------------------------------------------
LEGIT_BRAND_DOMAINS = [
    "sbi.co.in", "hdfcbank.com", "icicibank.com", "axisbank.com",
    "kotak.com", "pnbindia.in", "bankofbaroda.in", "canarabank.in",
    "paytm.com", "phonepe.com", "googlepay.com", "bhimupi.org.in",
    "amazon.in", "flipkart.com", "npci.org.in", "rbi.org.in",
    "incometax.gov.in", "uidai.gov.in", "irctc.co.in", "epfindia.gov.in",
]

# ---------------------------------------------------------------------------
# Valid UPI PSP handle suffixes
# ---------------------------------------------------------------------------
LEGIT_PSP_SUFFIXES = {
    "@okaxis", "@okhdfcbank", "@okicici", "@oksbi",
    "@ybl", "@ibl", "@axl", "@paytm", "@apl",
    "@jupiteraxis", "@fam", "@sbi", "@upi",
    "@icici", "@hdfc", "@kotak", "@aubank",
    "@indus", "@idbi", "@barodampay", "@cnrb",
    "@pnb", "@federal", "@kvb", "@scb",
    "@airtel", "@jio",
}

# ---------------------------------------------------------------------------
# Suspicious TLDs
# ---------------------------------------------------------------------------
SUSPICIOUS_TLDS = {
    ".xyz", ".tk", ".ml", ".ga", ".cf", ".gq",
    ".top", ".club", ".site", ".online", ".live",
    ".info", ".biz", ".ws", ".cc", ".pw",
    ".icu", ".fun", ".shop", ".store",
}

# ---------------------------------------------------------------------------
# Homoglyph / confusable character map (unicode → ascii)
# ---------------------------------------------------------------------------
HOMOGLYPH_MAP: dict[str, str] = {
    "а": "a", "е": "e", "о": "o", "р": "p", "с": "c",
    "і": "i", "ԁ": "d", "ʜ": "h", "ʟ": "l", "ɡ": "g",
    "0": "o", "1": "l", "5": "s", "3": "e", "4": "a",
    "|": "l",
}

# ---------------------------------------------------------------------------
# Known URL shortener domains
# ---------------------------------------------------------------------------
URL_SHORTENERS = {
    "bit.ly", "tinyurl.com", "t.co", "ow.ly", "goo.gl",
    "short.io", "rebrand.ly", "cutt.ly", "buff.ly", "tiny.cc",
    "is.gd", "su.pr", "tr.im", "twurl.nl", "snipurl.com",
}

# ---------------------------------------------------------------------------
# Urgency / pressure phrase patterns (regex)
# ---------------------------------------------------------------------------
URGENCY_PHRASES = [
    r"act\s+now",
    r"immediately",
    r"urgent",
    r"account\s+(will\s+be\s+)?(blocked|suspended|frozen|closed)",
    r"last\s+chance",
    r"expire[sd]?\s+in",
    r"within\s+\d+\s+hour",
    r"do\s+not\s+ignore",
    r"failure\s+to\s+comply",
    r"limited\s+time",
    r"only\s+today",
    r"kyc\s+(update|verification|expire)",
    r"your\s+otp",
    r"share\s+your\s+(pin|otp|password)",
    r"click\s+here\s+to\s+(verify|update|claim)",
    r"congratulations.*won",
    r"prize\s+(money|amount)",
    r"cashback\s+offer",
    r"free\s+(gift|reward|recharge)",
    r"refund\s+initiated",
    r"payment\s+pending.*approve",
    r"send\s+₹\s*\d+.*get\s+₹",
]

# ---------------------------------------------------------------------------
# Authority-impersonation phrases
# ---------------------------------------------------------------------------
AUTHORITY_PHRASES = [
    r"rbi\s+governor",
    r"income\s+tax\s+department",
    r"cyber\s+crime",
    r"cbi\s+officer",
    r"police\s+department",
    r"supreme\s+court",
    r"trai\s+",
    r"your\s+bank\s+manager",
    r"(sbi|hdfc|icici|axis)\s+bank\s+official",
    r"government\s+of\s+india",
    r"pm\s+relief\s+fund",
    r"uidai\s+",
]

# ---------------------------------------------------------------------------
# Unsolicited payment / collect request patterns
# ---------------------------------------------------------------------------
UNSOLICITED_PAYMENT_PHRASES = [
    r"send\s+(rs\.?|₹)\s*\d+",
    r"pay\s+(rs\.?|₹)\s*\d+.*receive",
    r"transfer\s+(rs\.?|₹)\s*\d+",
    r"scan\s+this\s+qr",
    r"accept\s+the\s+collect\s+request",
    r"approve\s+the\s+payment",
    r"double\s+your\s+money",
    r"guaranteed\s+(return|profit|income)",
]

# ---------------------------------------------------------------------------
# Few-shot examples for Groq message classification prompt
# ---------------------------------------------------------------------------
FEW_SHOT_EXAMPLES = [
    {
        "message": "Your SBI account will be blocked in 24 hours. Update KYC immediately: sbi-kyc-update.xyz/verify",
        "label": "High Risk",
        "category": "Phishing / KYC Scam",
        "signals": ["urgency", "account-block threat", "suspicious URL", "KYC impersonation"],
    },
    {
        "message": "Dear customer, your OTP for UPI transaction is 847291. Do not share with anyone.",
        "label": "Safe",
        "category": "Legitimate OTP SMS",
        "signals": ["standard OTP format", "do-not-share warning"],
    },
    {
        "message": "Congrats! You have won ₹25 Lakh in Lucky Draw. Send ₹500 processing fee to collect@ybl to claim.",
        "label": "High Risk",
        "category": "Lottery / Advance Fee Scam",
        "signals": ["prize bait", "advance fee demand", "urgency"],
    },
    {
        "message": "Scan this QR to receive ₹5000 cashback on your recent order. Limited time offer!",
        "label": "Suspicious",
        "category": "QR Cashback Scam",
        "signals": ["QR scan request", "money-receive pretext", "urgency"],
    },
    {
        "message": "Rahul sent you ₹2,000 via PhonePe. Check your bank account.",
        "label": "Safe",
        "category": "Legitimate Payment Notification",
        "signals": ["standard payment notification"],
    },
    {
        "message": "Army officer wants to buy your OLX item. Will send extra ₹2000 for delivery. Share UPI ID.",
        "label": "Suspicious",
        "category": "OLX / Marketplace Scam",
        "signals": ["authority identity", "excess payment offer", "UPI ID solicitation"],
    },
    {
        "message": "Your HDFC account has suspicious activity. Call our helpline 9876543210 for immediate assistance.",
        "label": "High Risk",
        "category": "Customer Care Impersonation",
        "signals": ["fake helpline", "bank impersonation", "urgency"],
    },
    {
        "message": "Invest ₹10,000 today in our crypto fund and get ₹50,000 in 7 days. Guaranteed returns!",
        "label": "High Risk",
        "category": "Investment Scam",
        "signals": ["guaranteed returns", "high ROI claim", "crypto bait"],
    },
    {
        "message": "Your electricity bill of ₹1,245 is due. Pay now at BESCOM official portal.",
        "label": "Safe",
        "category": "Utility Bill Reminder",
        "signals": ["specific amount", "official portal reference"],
    },
    {
        "message": "TRAI will disconnect your mobile number in 2 hours due to illegal activity. Press 1 to speak with officer.",
        "label": "High Risk",
        "category": "TRAI / Authority Impersonation Scam",
        "signals": ["authority impersonation", "disconnection threat", "urgency", "IVR trick"],
    },
    {
        "message": "Hi, I'm interested in your product listed on Quikr. Can you share your UPI ID for advance payment?",
        "label": "Suspicious",
        "category": "Marketplace Pre-Payment Scam",
        "signals": ["advance payment request", "unsolicited UPI ID ask"],
    },
    {
        "message": "RBI Governor has approved ₹9,50,000 for you under PM relief scheme. Pay ₹1,500 tax to release funds.",
        "label": "High Risk",
        "category": "Government Impersonation / Advance Fee Scam",
        "signals": ["RBI/PM impersonation", "advance fee", "large reward bait"],
    },
]
