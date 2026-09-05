const VERDICT_CONFIG = {
  'Safe':      { emoji: '✅', cls: 'safe',      color: 'var(--green)' },
  'Suspicious':{ emoji: '⚠️', cls: 'suspicious', color: 'var(--amber)' },
  'High Risk': { emoji: '🛑', cls: 'high-risk',  color: 'var(--red)'   },
};

export default function VerdictBadge({ verdict, explanation }) {
  if (!verdict) return null;
  const cfg = VERDICT_CONFIG[verdict] ?? { emoji: '❓', cls: 'suspicious', color: 'var(--amber)' };
  return (
    <div className="verdict-wrap">
      <div className={`verdict-card ${cfg.cls}`}>
        <span className="verdict-emoji" role="img" aria-label={verdict}>{cfg.emoji}</span>
        <div className="verdict-label" style={{ color: cfg.color }}>{verdict}</div>
        {explanation && <p className="verdict-exp">{explanation}</p>}
      </div>
    </div>
  );
}
