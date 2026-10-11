export type UsageRingProps = {
  contextUsed?: number;
  contextWindow?: number;
  costAmount?: number;
  costCurrency?: string;
};

export function UsageRing({ contextUsed, contextWindow, costAmount, costCurrency }: UsageRingProps) {
  const hasData = typeof contextUsed === 'number' && typeof contextWindow === 'number' && contextWindow > 0;
  const pct = hasData ? Math.min(Math.max((contextUsed / contextWindow) * 100, 0), 100) : 0;

  // Circumference for r=7
  const radius = 7;
  const circumference = 2 * Math.PI * radius; // ~43.98
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  let strokeColor = '#3b82f6'; // default blue
  if (pct > 85) strokeColor = '#ef4444'; // red
  else if (pct > 65) strokeColor = '#f59e0b'; // amber

  const usedK = hasData ? (contextUsed / 1000).toFixed(1).replace(/\.0$/, '') : '0';
  const windowK = hasData ? (contextWindow / 1000).toFixed(0) : '200';
  const costStr = costAmount && costAmount > 0
    ? `${costCurrency === 'USD' ? '$' : costCurrency ? costCurrency + ' ' : '$'}${costAmount.toFixed(4)}`
    : '';

  const tooltip = hasData
    ? `Context usage: ${usedK}k / ${windowK}k tokens (${pct.toFixed(0)}%)${costStr ? ` • ${costStr}` : ''}`
    : 'Context usage: 0%';

  return (
    <div className="usage-ring-wrap" title={tooltip} aria-label={tooltip}>
      <svg className="usage-ring-svg" width="16" height="16" viewBox="0 0 18 18">
        <circle
          className="usage-ring-bg"
          cx="9"
          cy="9"
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.15)"
          strokeWidth="2"
        />
        {pct > 0 && (
          <circle
            className="usage-ring-fill"
            cx="9"
            cy="9"
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform="rotate(-90 9 9)"
          />
        )}
      </svg>
    </div>
  );
}
