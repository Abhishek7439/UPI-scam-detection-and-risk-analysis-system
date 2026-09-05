import { useState, useCallback } from 'react';
import InputForm from './components/InputForm';
import PipelineTrace from './components/PipelineTrace';
import VerdictBadge from './components/VerdictBadge';
import SignalList from './components/SignalList';
import './index.css';

const STATS = [
  { value: '2.4M+', label: 'Transactions Scanned' },
  { value: '18,492', label: 'Scams Blocked' },
  { value: '₹84.3Cr', label: 'Amount Protected' },
  { value: '98.7%', label: 'Accuracy Rate' },
];

const FEATURES = [
  { icon: '🔍', num: 'Step 01', title: 'Entity Extraction', desc: 'Regex scan for URLs, UPI IDs, amounts, urgency phrases, and authority cues in milliseconds.' },
  { icon: '🌐', num: 'Step 02', title: 'URL Risk Analysis', desc: 'Domain heuristics: typosquat detection, TLD blocklist, URL shorteners, homoglyph confusables.' },
  { icon: '🤖', num: 'Step 03', title: 'AI Classification', desc: 'Groq Llama-3.3 few-shot LLM classifier returns label and risk category with rule-based fallback.' },
  { icon: '📷', num: 'Step 04', title: 'QR Code Decode', desc: 'OpenCV QR decode with UPI deep-link parsing and collect-request scam detection.' },
  { icon: '💳', num: 'Step 05', title: 'UPI Handle Check', desc: 'PSP suffix validation, suspicious keyword scan, and format verification against known providers.' },
];

export default function App() {
  const [loading, setLoading]   = useState(false);
  const [steps,   setSteps]     = useState([]);
  const [final,   setFinal]     = useState(null);
  const [error,   setError]     = useState(null);
  const [hasRun,  setHasRun]    = useState(false);

  const handleStep = useCallback((ev) => {
    setSteps(prev => {
      const lastIdx = [...prev].map((s,i) => [s,i]).reverse()
        .find(([s]) => s.step === ev.step && s.status === 'running')?.[1];
      if (lastIdx !== undefined) {
        const next = [...prev]; next[lastIdx] = ev; return next;
      }
      return [...prev, ev];
    });
  }, []);

  const handleFinal = useCallback((ev) => setFinal(ev), []);
  const handleError = useCallback((msg) => { setError(msg); setLoading(false); }, []);

  function startRun() {
    setSteps([]); setFinal(null); setError(null); setHasRun(true);
  }

  function handleSetLoading(val) {
    if (val) startRun();
    setLoading(val);
  }

  function scrollToScan() {
    document.getElementById('scan-section')?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <div className="page">

      {/* ── Navbar ─────────────────────────────────────────── */}
      <nav className="navbar">
        <div className="nav-inner">
          <a className="nav-logo" href="#" onClick={e => { e.preventDefault(); window.scrollTo({top:0,behavior:'smooth'}); }}>
            <div className="nav-logo-icon">🛡️</div>
            <span className="nav-logo-text">SentinelPay</span>
          </a>
          <ul className="nav-links">
            {['Home','Features','How It Works','About'].map(l => (
              <li key={l}>
                <button className="nav-link" onClick={l === 'How It Works' ? scrollToScan : undefined}>{l}</button>
              </li>
            ))}
          </ul>
          <div className="nav-actions">
            <button className="btn-nav-outline">Login</button>
            <button className="btn-nav-fill" onClick={scrollToScan}>Scan Now</button>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="hero">
        <div className="hero-left">
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            AI-Powered UPI Protection
          </div>
          <h1 className="hero-title">
            Scan Your UPI,<br />
            <span>Detect Risk Instantly.</span>
          </h1>
          <p className="hero-sub">
            AI-powered scanner that analyses your UPI transactions in real time to uncover hidden threats, scams, and suspicious activity — before you lose money.
          </p>
          <div className="hero-actions">
            <button className="btn-hero-primary" onClick={scrollToScan}>
              🛡️ Scan Wallet Now
            </button>
            <button className="btn-hero-outline" onClick={scrollToScan}>
              ⚡ Watch Demo ›
            </button>
          </div>
        </div>
        <div className="hero-right">
          <div className="hero-device-wrap">
            <div className="hero-device-glow" />
            <img
              className="hero-device-img"
              src="/hero_device.png"
              alt="SentinelPay AI Scanner"
              onError={e => { e.target.style.opacity = '0.3'; }}
            />
          </div>
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────────────── */}
      <div className="stats-strip">
        <div className="stats-inner">
          {STATS.map((s, i) => (
            <>
              <div key={s.label} className="stat-item">
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
              {i < STATS.length - 1 && <div key={`d${i}`} className="stat-divider" />}
            </>
          ))}
        </div>
      </div>

      {/* ── Scan Section ───────────────────────────────────── */}
      <section className="scan-section" id="scan-section">
        <div className="section-eyebrow">Analyse Now</div>
        <h2 className="section-title">Detect UPI Scams in Real Time</h2>
        <p className="section-sub">
          Paste a suspicious message, URL, UPI ID or upload a QR code — our 5-step AI pipeline scans it instantly.
        </p>

        <div className="scan-card">
          <InputForm
            onStep={handleStep}
            onFinal={handleFinal}
            onError={handleError}
            loading={loading}
            setLoading={handleSetLoading}
          />
        </div>
      </section>

      {/* ── Results ────────────────────────────────────────── */}
      {(hasRun || error) && (
        <section className="results-section">
          {error && (
            <div className="error-bar" role="alert">⚠️ {error}</div>
          )}
          {hasRun && (
            <div className="scan-card">
              <PipelineTrace steps={steps} />
              {final && (
                <>
                  <div style={{ height: 24 }} />
                  <VerdictBadge verdict={final.verdict} explanation={final.explanation} />
                  <div style={{ height: 20 }} />
                  <SignalList signals={final.signals} />
                </>
              )}
              {loading && !final && steps.length === 0 && (
                <div style={{ textAlign:'center', padding:'32px', color:'var(--text-muted)' }}>
                  <span className="spinner" style={{ margin:'0 auto 14px', display:'block', width:24, height:24, borderWidth:3 }} />
                  Connecting to pipeline…
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Features ───────────────────────────────────────── */}
      {!hasRun && (
        <section className="features-section">
          <div className="features-inner">
            <div className="section-eyebrow">Pipeline</div>
            <h2 className="section-title">5-Step Detection Engine</h2>
            <p className="section-sub">Every input runs through the complete analysis chain automatically — no configuration needed.</p>
            <div className="features-grid">
              {FEATURES.map(f => (
                <div key={f.num} className="feature-card">
                  <div className="feature-icon">{f.icon}</div>
                  <div className="feature-num">{f.num}</div>
                  <div className="feature-title">{f.title}</div>
                  <p className="feature-desc">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="footer">
        © 2025 SentinelPay · UPI Scam Detection & Risk Analysis System · Built with FastAPI + React
      </footer>

    </div>
  );
}
