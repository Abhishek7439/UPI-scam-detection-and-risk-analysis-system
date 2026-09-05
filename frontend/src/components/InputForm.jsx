import { useState, useRef } from 'react';

export default function InputForm({ onStep, onFinal, onError, loading, setLoading }) {
  const [text,      setText]      = useState('');
  const [url,       setUrl]       = useState('');
  const [upiId,     setUpiId]     = useState('');
  const [qrFile,    setQrFile]    = useState(null);
  const [qrPreview, setQrPreview] = useState(null);
  const [qrBase64,  setQrBase64]  = useState('');
  const fileRef = useRef(null);

  function handleQrChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setQrFile(file);
    const reader = new FileReader();
    reader.onload = ev => {
      setQrPreview(ev.target.result);
      setQrBase64(ev.target.result.split(',')[1] || '');
    };
    reader.readAsDataURL(file);
  }

  function clearQr() {
    setQrFile(null); setQrPreview(null); setQrBase64('');
    if (fileRef.current) fileRef.current.value = '';
  }

  const hasInput = () => text.trim() || url.trim() || upiId.trim() || qrBase64;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!hasInput()) { onError('Please fill in at least one field.'); return; }
    setLoading(true);
    const { analyzeStream } = await import('../api/stream.js');
    await analyzeStream(
      { text: text.trim(), url: url.trim(), upi_id: upiId.trim(), qr_image: qrBase64 },
      onStep, onFinal, onError,
    );
    setLoading(false);
  }

  async function handleDemo(e) {
    e.preventDefault();
    setLoading(true);
    const { analyzeDemo } = await import('../api/stream.js');
    await analyzeDemo(onStep, onFinal, err => { onError(err); setLoading(false); });
    setLoading(false);
  }

  function handleClear() {
    setText(''); setUrl(''); setUpiId(''); clearQr();
  }

  return (
    <form onSubmit={handleSubmit} id="analyze-form">
      {/* Message */}
      <div className="form-grid">
        <div className="form-full">
          <label className="field-label" htmlFor="msg-input">Suspicious Message / Description</label>
          <textarea
            id="msg-input"
            className="field-textarea"
            placeholder="Paste the suspicious SMS, WhatsApp message, or transaction description here…"
            value={text}
            onChange={e => setText(e.target.value)}
          />
        </div>

        {/* URL */}
        <div>
          <label className="field-label" htmlFor="url-input">Suspicious URL</label>
          <input
            id="url-input"
            type="text"
            className="field-input"
            placeholder="https://sbi-kyc-verify.xyz/..."
            value={url}
            onChange={e => setUrl(e.target.value)}
          />
        </div>

        {/* UPI ID */}
        <div>
          <label className="field-label" htmlFor="upi-input">UPI ID / VPA</label>
          <input
            id="upi-input"
            type="text"
            className="field-input"
            placeholder="suspicious.id@ybl"
            value={upiId}
            onChange={e => setUpiId(e.target.value)}
          />
        </div>

        {/* QR Upload */}
        <div className="form-full">
          <label className="field-label">QR Code Image (optional)</label>
          {!qrPreview ? (
            <label className="qr-zone" htmlFor="qr-file-input">
              <input
                id="qr-file-input"
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleQrChange}
              />
              <span className="qr-zone-icon">📷</span>
              <span className="qr-zone-text">
                <strong>Click or drag</strong> a QR code image to decode &amp; analyse
              </span>
            </label>
          ) : (
            <div className="qr-preview-box">
              <img src={qrPreview} alt="QR preview" />
              <div>
                <div className="qr-preview-name">✓ {qrFile?.name}</div>
                <div className="qr-preview-size">{(qrFile?.size / 1024).toFixed(1)} KB — ready to decode</div>
              </div>
              <button type="button" className="btn-qr-rm" onClick={clearQr} aria-label="Remove">✕</button>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="form-actions">
        <button id="btn-analyze" type="submit" className="btn-primary" disabled={loading || !hasInput()}>
          {loading
            ? <><span className="spinner" style={{borderTopColor:'#fff',borderColor:'rgba(255,255,255,0.2)'}} /> Analysing…</>
            : <><span>🛡️</span> Analyse Now</>
          }
        </button>
        <button id="btn-demo" type="button" className="btn-demo" onClick={handleDemo} disabled={loading}>
          ⚡ Run Demo
        </button>
        <button id="btn-clear" type="button" className="btn-ghost" onClick={handleClear} disabled={loading}>
          Clear
        </button>
      </div>
    </form>
  );
}
