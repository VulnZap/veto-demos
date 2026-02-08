export function VetoLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className="inline-block">
      <circle cx="16" cy="16" r="16" fill="#0a0a0a" stroke="#1f1f1f" strokeWidth="1"/>
      <g transform="translate(16, 16)">
        <rect x="-6" y="-1.5" width="12" height="3" rx="1.5" fill="#f97316"/>
        <rect x="-1.5" y="-6" width="3" height="12" rx="1.5" fill="#f97316"/>
      </g>
    </svg>
  );
}
