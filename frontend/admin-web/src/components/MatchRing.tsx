interface MatchRingProps {
  score: number; // 0-100
  size?: number;
  stroke?: number;
  label?: string;
}

// Signature element: an SVG gauge showing AI match score (solid band color, no gradient).
export default function MatchRing({
  score,
  size = 96,
  stroke = 9,
  label = '匹配度',
}: MatchRingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = c * (1 - clamped / 100);
  // 与评分胶囊一致：高=绿 / 中=蓝 / 低=琥珀
  const color = clamped >= 80 ? '#1f9d6b' : clamped >= 60 ? '#2563eb' : '#d9940f';

  return (
    <div className="match-ring" style={{ width: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#eef0f4"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text
          x="50%"
          y="48%"
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="'Sora', sans-serif"
          fontSize={size * 0.28}
          fontWeight={700}
          fill={color}
        >
          {clamped}
        </text>
        <text
          x="50%"
          y="68%"
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="'Plus Jakarta Sans', sans-serif"
          fontSize={size * 0.1}
          fill="#747b8a"
        >
          /100
        </text>
      </svg>
      {label && <div className="match-ring-label">{label}</div>}
    </div>
  );
}
