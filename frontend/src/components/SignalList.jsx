const SOURCE_LABELS = {
  extractor:          'Extractor',
  url_checker:        'URL Checker',
  message_classifier: 'AI Classifier',
  qr_decoder:         'QR Decoder',
  upi_checker:        'UPI Checker',
};

export default function SignalList({ signals }) {
  if (!signals) return null;
  if (signals.length === 0) {
    return (
      <div className="signals-wrap">
        <p style={{ textAlign:'center', color:'var(--text-muted)', fontSize:13, padding:'16px 0' }}>No risk signals detected.</p>
      </div>
    );
  }
  return (
    <div className="signals-wrap">
      <div className="signals-title">Risk Signals ({signals.length})</div>
      <div className="signals-list">
        {signals.map((sig, i) => (
          <div
            key={i}
            className={`signal-row ${sig.severity ?? 'safe'}`}
            style={{ animationDelay: `${i * 55}ms` }}
          >
            <span className="sig-dot" />
            <div className="sig-body">
              <span className="sig-source">{SOURCE_LABELS[sig.source] ?? sig.source}</span>
              <div className="sig-text">{sig.signal}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
