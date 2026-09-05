// ============================================================
//  UPI Scam Detection – Data & Risk Engine  (data.js)
// ============================================================

// ── Scam Pattern Library ─────────────────────────────────────
const SCAM_PATTERNS = [
  {
    id: "SP001",
    name: "Fake KYC Update",
    category: "Phishing",
    severity: "critical",
    description:
      "Fraudsters pose as bank representatives and ask users to 'update KYC' via a UPI link. Victims are tricked into sending money or revealing OTPs.",
    indicators: ["kyc", "update", "expire", "block", "verify"],
    avgLoss: 12500,
    frequency: 3840,
    icon: "🪪",
    tips: [
      "Banks never ask for UPI PIN via calls.",
      "Never click unsolicited KYC links.",
      "Report to cybercrime.gov.in immediately.",
    ],
  },
  {
    id: "SP002",
    name: "QR Code Scam",
    category: "Social Engineering",
    severity: "high",
    description:
      "Scammers send 'collect' QR codes claiming the victim will receive money. Scanning causes money to be debited instead of credited.",
    indicators: ["qr", "scan", "collect", "receive money", "prize"],
    avgLoss: 8200,
    frequency: 5120,
    icon: "📷",
    tips: [
      "QR codes are used to PAY, not to receive money.",
      "Never scan codes sent by strangers.",
      "UPI collect requests debit your account.",
    ],
  },
  {
    id: "SP003",
    name: "OLX / Marketplace Scam",
    category: "Marketplace Fraud",
    severity: "high",
    description:
      "Fake buyers on OLX/Quikr send partial payment links and ask sellers to 'accept' remaining payment, which actually charges the seller.",
    indicators: ["olx", "quikr", "buyer", "advance", "army", "soldier"],
    avgLoss: 15000,
    frequency: 4290,
    icon: "🛒",
    tips: [
      "Never pay 'advance' to strangers online.",
      "Verify buyer identity before sharing UPI ID.",
      "Meet in person for high-value transactions.",
    ],
  },
  {
    id: "SP004",
    name: "Lottery / Prize Scam",
    category: "Lottery Fraud",
    severity: "medium",
    description:
      "Victims receive calls/messages claiming they won a lottery. A 'processing fee' is demanded via UPI to release the prize.",
    indicators: ["lottery", "prize", "winner", "crore", "lakh", "congratulations", "lucky"],
    avgLoss: 6800,
    frequency: 2940,
    icon: "🎰",
    tips: [
      "No legitimate lottery requires advance payment.",
      "Verify any prize claim independently.",
      "Block and report such numbers.",
    ],
  },
  {
    id: "SP005",
    name: "Customer Care Impersonation",
    category: "Impersonation",
    severity: "critical",
    description:
      "Fraudsters create fake customer care numbers on Google for banks/wallets. Victims share screen/OTP and lose money.",
    indicators: ["helpline", "customer care", "support", "refund", "complaint"],
    avgLoss: 22000,
    frequency: 6710,
    icon: "☎️",
    tips: [
      "Use only official bank websites for helpline numbers.",
      "Never share OTP/PIN with anyone.",
      "Banks will never ask for remote access.",
    ],
  },
  {
    id: "SP006",
    name: "Investment / Crypto Scam",
    category: "Investment Fraud",
    severity: "critical",
    description:
      "Promise of high returns on crypto/stock investments. Victims deposit via UPI and platform disappears after initial fake profits.",
    indicators: ["investment", "return", "profit", "crypto", "bitcoin", "double", "guaranteed"],
    avgLoss: 58000,
    frequency: 1820,
    icon: "📈",
    tips: [
      "No investment guarantees returns.",
      "Verify SEBI/RBI registration.",
      "Be wary of Telegram/WhatsApp investment groups.",
    ],
  },
  {
    id: "SP007",
    name: "Romance / Sextortion Scam",
    category: "Social Engineering",
    severity: "high",
    description:
      "Online relationships that eventually lead to financial requests. Sextortion variants threaten to share intimate content.",
    indicators: ["love", "meet", "visa", "emergency", "hospital", "stuck"],
    avgLoss: 34000,
    frequency: 1250,
    icon: "💔",
    tips: [
      "Never send money to people you haven't met.",
      "Report to cybercrime portal if threatened.",
      "Reverse image-search profile pictures.",
    ],
  },
  {
    id: "SP008",
    name: "UPI Spoofed ID",
    category: "Phishing",
    severity: "medium",
    description:
      "UPI IDs that closely mimic legitimate entities (e.g., paytm-care@upi vs official ID) to deceive users into paying wrong accounts.",
    indicators: ["paytm", "phonepe", "gpay", "care", "help", "official"],
    avgLoss: 4500,
    frequency: 7800,
    icon: "🎭",
    tips: [
      "Always verify merchant name on payment screen.",
      "Look for official verification badges.",
      "Double-check UPI ID spelling before sending.",
    ],
  },
];

// ── High-Risk UPI ID Fragments ────────────────────────────────
const HIGH_RISK_FRAGMENTS = [
  "scam", "fraud", "hack", "fake", "care", "help", "support",
  "refund", "official", "bank", "kyc", "update", "verify",
  "lottery", "prize", "winner", "income", "tax", "govt",
];

const SUSPICIOUS_VPA_HANDLES = [
  "@ybl", "@axl", "@idfcbank",   // common in fake IDs
];

// ── Risk Factor Weights ───────────────────────────────────────
const RISK_WEIGHTS = {
  highRiskKeywordInVPA: 25,
  suspiciousHandle: 15,
  newRegistration: 10,         // simulated
  highAmount: 20,
  roundAmount: 8,
  nightTimeTransaction: 12,
  frequentSmallTx: 10,
  mismatchedName: 18,
  urlInRemarks: 30,
  pressureIndicator: 22,
};

// ── Mock Transaction History ──────────────────────────────────
const MOCK_TRANSACTIONS = [
  { id: "TXN001", upiId: "rajeev.sharma@okaxis",  name: "Rajeev Sharma",   amount: 5000,  time: "09:42", risk: 12, category: "legitimate", status: "safe" },
  { id: "TXN002", upiId: "kyc.update99@ybl",      name: "KYC Services",    amount: 1,     time: "10:15", risk: 94, category: "Phishing",   status: "blocked" },
  { id: "TXN003", upiId: "priya.mehta@paytm",     name: "Priya Mehta",     amount: 2500,  time: "11:00", risk: 8,  category: "legitimate", status: "safe" },
  { id: "TXN004", upiId: "lottery.win@oksbi",     name: "Lucky Draw",      amount: 500,   time: "11:33", risk: 88, category: "Lottery",    status: "blocked" },
  { id: "TXN005", upiId: "amit.kumar@okicici",    name: "Amit Kumar",      amount: 18000, time: "12:05", risk: 22, category: "legitimate", status: "safe" },
  { id: "TXN006", upiId: "support.helpline@upi",  name: "Bank Support",    amount: 10,    time: "13:45", risk: 97, category: "Phishing",   status: "blocked" },
  { id: "TXN007", upiId: "sunita.devi@okhdfcbank",name: "Sunita Devi",     amount: 750,   time: "14:20", risk: 15, category: "legitimate", status: "safe" },
  { id: "TXN008", upiId: "invest.double@ybl",     name: "Invest Hub",      amount: 25000, time: "14:55", risk: 92, category: "Investment", status: "blocked" },
  { id: "TXN009", upiId: "mohan.gupta@paytm",     name: "Mohan Gupta",     amount: 3200,  time: "15:30", risk: 11, category: "legitimate", status: "safe" },
  { id: "TXN010", upiId: "olx.buyer.army@oksbi",  name: "Army Personnel",  amount: 100,   time: "16:10", risk: 85, category: "Marketplace",status: "blocked" },
  { id: "TXN011", upiId: "ananya.singh@okaxis",   name: "Ananya Singh",    amount: 12000, time: "16:45", risk: 18, category: "legitimate", status: "safe" },
  { id: "TXN012", upiId: "refund.process@ybl",    name: "Refund Dept",     amount: 1,     time: "17:20", risk: 96, category: "Phishing",   status: "blocked" },
  { id: "TXN013", upiId: "deepak.nair@okhdfcbank",name: "Deepak Nair",     amount: 6500,  time: "18:00", risk: 9,  category: "legitimate", status: "safe" },
  { id: "TXN014", upiId: "crypto.profit99@paytm", name: "Crypto Returns",  amount: 50000, time: "18:45", risk: 98, category: "Investment", status: "blocked" },
  { id: "TXN015", upiId: "rekha.iyer@okaxis",     name: "Rekha Iyer",      amount: 450,   time: "19:15", risk: 6,  category: "legitimate", status: "safe" },
];

// ── Scam Trend Data (last 7 days) ────────────────────────────
const TREND_DATA = {
  labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  phishing:    [142, 189, 167, 211, 198, 243, 178],
  marketplace: [89,  102, 115, 98,  134, 156, 121],
  investment:  [34,  45,  52,  61,  48,  72,  58],
  lottery:     [67,  78,  83,  91,  105, 88,  97],
  other:       [23,  31,  28,  35,  42,  39,  44],
};

// ── Category Distribution ─────────────────────────────────────
const CATEGORY_DATA = {
  labels: ["Phishing", "Marketplace", "Investment", "Lottery", "Impersonation", "Romance", "Other"],
  values: [38, 22, 14, 11, 8, 4, 3],
  colors: [
    "#ff4d6d", "#ff8c42", "#ffd166", "#06d6a0",
    "#118ab2", "#a855f7", "#6b7280"
  ],
};

// ── Amount Range Distribution ─────────────────────────────────
const AMOUNT_RANGE_DATA = {
  labels: ["₹1–500", "₹501–2K", "₹2K–10K", "₹10K–50K", "₹50K+"],
  counts: [4820, 3240, 2180, 890, 340],
};

// ── Live Feed Mock Events ─────────────────────────────────────
const LIVE_FEED_POOL = [
  { upiId: "kyc.urgent99@ybl",      name: "KYC Help",       amount: 1,      risk: 96, type: "Phishing",    location: "Mumbai" },
  { upiId: "lottery.india@oksbi",   name: "Lucky India",    amount: 500,    risk: 91, type: "Lottery",     location: "Delhi" },
  { upiId: "army.buyer@paytm",      name: "Col. Sharma",    amount: 100,    risk: 87, type: "Marketplace", location: "Jaipur" },
  { upiId: "refund.amazon@ybl",     name: "Amazon Help",    amount: 1,      risk: 94, type: "Impersonation",location: "Bengaluru" },
  { upiId: "invest.btc@okicici",    name: "Crypto Hub",     amount: 10000,  risk: 98, type: "Investment",  location: "Hyderabad" },
  { upiId: "support.hdfc@oksbi",    name: "HDFC Care",      amount: 1,      risk: 93, type: "Phishing",    location: "Chennai" },
  { upiId: "prize.winner@paytm",    name: "KBC Prize",      amount: 200,    risk: 89, type: "Lottery",     location: "Pune" },
  { upiId: "verify.upi@ybl",        name: "UPI Verify",     amount: 1,      risk: 92, type: "Phishing",    location: "Kolkata" },
  { upiId: "double.money@oksbi",    name: "Invest2x",       amount: 5000,   risk: 97, type: "Investment",  location: "Ahmedabad" },
  { upiId: "olx.seller99@paytm",    name: "OLX Buyer",      amount: 50,     risk: 84, type: "Marketplace", location: "Lucknow" },
  { upiId: "free.iphone@ybl",       name: "Apple Offer",    amount: 299,    risk: 88, type: "Phishing",    location: "Surat" },
  { upiId: "tax.refund@okaxis",     name: "Income Tax Dept",amount: 1,      risk: 95, type: "Impersonation",location: "Noida" },
];

// ── Core Risk Scoring Engine ──────────────────────────────────
function calculateRiskScore(payload) {
  const { upiId = "", name = "", amount = 0, remarks = "" } = payload;
  let score = 0;
  let flags = [];

  const upiLower = upiId.toLowerCase();
  const nameLower = name.toLowerCase();
  const remarksLower = remarks.toLowerCase();

  // 1. High-risk keyword in VPA
  for (const kw of HIGH_RISK_FRAGMENTS) {
    if (upiLower.includes(kw)) {
      score += RISK_WEIGHTS.highRiskKeywordInVPA;
      flags.push({ type: "warning", message: `UPI ID contains suspicious keyword: "${kw}"` });
      break;
    }
  }

  // 2. URL in remarks
  if (/https?:\/\//i.test(remarksLower) || remarksLower.includes("www.") || remarksLower.includes("bit.ly")) {
    score += RISK_WEIGHTS.urlInRemarks;
    flags.push({ type: "critical", message: "Remarks contain a suspicious URL link" });
  }

  // 3. Amount analysis
  if (amount === 1 || amount === 0) {
    score += 20;
    flags.push({ type: "warning", message: "Re₹1 / ₹0 test transaction — common scam hook" });
  } else if (amount > 50000) {
    score += RISK_WEIGHTS.highAmount;
    flags.push({ type: "info", message: "High-value transaction — exercise caution" });
  } else if (amount % 1000 === 0 && amount > 5000) {
    score += RISK_WEIGHTS.roundAmount;
    flags.push({ type: "info", message: "Round-number amount — verify payee" });
  }

  // 4. Name mismatch check (simple heuristic)
  if (nameLower.includes("care") || nameLower.includes("support") || nameLower.includes("helpline") ||
      nameLower.includes("bank") || nameLower.includes("dept") || nameLower.includes("official")) {
    score += RISK_WEIGHTS.mismatchedName;
    flags.push({ type: "critical", message: "Payee name impersonates an institution" });
  }

  // 5. Pressure indicators in remarks
  const pressureWords = ["urgent", "immediately", "today only", "last chance", "expire", "block", "freeze"];
  for (const pw of pressureWords) {
    if (remarksLower.includes(pw)) {
      score += RISK_WEIGHTS.pressureIndicator;
      flags.push({ type: "critical", message: `Pressure tactic detected: "${pw}"` });
      break;
    }
  }

  // 6. Scam pattern matching
  let matchedPattern = null;
  let highestMatch = 0;
  for (const pattern of SCAM_PATTERNS) {
    let matches = 0;
    for (const indicator of pattern.indicators) {
      if (upiLower.includes(indicator) || nameLower.includes(indicator) || remarksLower.includes(indicator)) {
        matches++;
      }
    }
    if (matches > highestMatch) {
      highestMatch = matches;
      matchedPattern = pattern;
    }
  }

  if (matchedPattern && highestMatch >= 1) {
    const boost = Math.min(30, highestMatch * 12);
    score += boost;
    flags.push({
      type: "critical",
      message: `Matches known scam pattern: ${matchedPattern.name}`,
      patternId: matchedPattern.id,
    });
  }

  // 7. Time of day (simulated)
  const hour = new Date().getHours();
  if (hour >= 22 || hour <= 5) {
    score += RISK_WEIGHTS.nightTimeTransaction;
    flags.push({ type: "info", message: "Late-night transaction — higher scam activity period" });
  }

  // Cap score at 100
  score = Math.min(100, Math.max(0, score));

  // Deduplicate flags
  const seen = new Set();
  flags = flags.filter((f) => {
    if (seen.has(f.message)) return false;
    seen.add(f.message);
    return true;
  });

  // Risk level
  let level, color, recommendation;
  if (score >= 80) {
    level = "CRITICAL";
    color = "#ff4d6d";
    recommendation = "DO NOT proceed with this transaction. This shows multiple red flags of a known scam. Report immediately.";
  } else if (score >= 55) {
    level = "HIGH";
    color = "#ff8c42";
    recommendation = "Exercise extreme caution. Verify payee identity through official channels before sending money.";
  } else if (score >= 30) {
    level = "MEDIUM";
    color = "#ffd166";
    recommendation = "Some risk indicators detected. Verify the payee name matches and confirm via a trusted channel.";
  } else {
    level = "LOW";
    color = "#06d6a0";
    recommendation = "This transaction appears relatively safe. Standard precautions apply.";
  }

  return {
    score,
    level,
    color,
    flags,
    matchedPattern,
    recommendation,
  };
}

// ── Statistics Summary ────────────────────────────────────────
const SYSTEM_STATS = {
  totalScanned:     "2.4M+",
  scamsBlocked:     "18,492",
  amountSaved:      "₹84.3Cr",
  accuracyRate:     "98.7%",
};
