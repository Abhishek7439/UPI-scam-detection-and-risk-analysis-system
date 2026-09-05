const STEP_META = {
  extract_entities:   { label: 'Entity Extraction',      icon: '🔍' },
  url_checker:        { label: 'URL Risk Analysis',       icon: '🌐' },
  message_classifier: { label: 'AI Classification',       icon: '🤖' },
  qr_decoder:         { label: 'QR Code Decoder',         icon: '📷' },
  upi_checker:        { label: 'UPI Handle Validator',    icon: '💳' },
  fuser:              { label: 'Verdict Fusion',          icon: '⚡' },
};

function summarise(step, result) {
  if (!result) return null;
  switch (step) {
    case 'extract_entities': {
      const parts = [
        result.urls?.length       && `${result.urls.length} URL(s)`,
        result.upi_ids?.length    && `${result.upi_ids.length} UPI ID(s)`,
        result.urgency_phrases?.length && `${result.urgency_phrases.length} urgency phrase(s)`,
        result.authority_phrases?.length && `${result.authority_phrases.length} authority phrase(s)`,
      ].filter(Boolean);
      return parts.length ? parts.join(' · ') : 'No entities extracted';
    }
    case 'url_checker':
      return result.reasons?.slice(0,2).join(' · ') || `Score: ${result.score ?? '—'}`;
    case 'message_classifier':
      return `${result.label ?? '—'} — ${result.risk_category ?? ''} [${result.source ?? ''}]`;
    case 'qr_decoder':
      return result.reasons?.slice(0,2).join(' · ') || 'Decoded';
    case 'upi_checker':
      return result.reasons?.slice(0,2).join(' · ') || 'Checked';
    default:
      return result.reasons?.[0] ?? null;
  }
}

export default function PipelineTrace({ steps }) {
  if (!steps?.length) return null;

  return (
    <div className="trace-wrap">
      <div className="trace-heading">
        ⚙️ Analysis Pipeline
        <span style={{ marginLeft:'auto', fontSize:12, color:'var(--text-muted)', fontWeight:400 }}>
          {steps.length} step{steps.length !== 1 ? 's' : ''} processed
        </span>
      </div>
      <div className="trace-steps">
        {steps.map((s, i) => {
          const meta = STEP_META[s.step] ?? { label: s.step, icon: '◉' };
          const detail = s.result ? summarise(s.step, s.result) : null;
          const statusIcon = s.status === 'done' ? '✅' : s.status === 'skipped' ? '⏭' : s.status === 'error' ? '❌' : null;
          return (
            <div key={`${s.step}-${i}`} className={`step-card ${s.status}`} style={{ animationDelay: `${i * 40}ms` }}>
              <div className="step-icon-wrap">
                {s.status === 'running' ? <span className="spinner" /> : <span>{meta.icon}</span>}
              </div>
              <div className="step-info">
                <div className="step-name">{meta.label}</div>
                <div className="step-detail">
                  {statusIcon && <span style={{ marginRight:4 }}>{statusIcon}</span>}
                  {s.status === 'running' && 'Processing…'}
                  {s.status === 'done'    && (detail || 'Complete')}
                  {s.status === 'skipped' && (s.result?.reasons?.[0] ?? 'Skipped — no input')}
                  {s.status === 'error'   && (s.result?.error ?? 'Error occurred')}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
