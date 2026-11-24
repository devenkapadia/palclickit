import { brand, content } from '@/lib/content';

/**
 * PAL wordmark with the camera tucked against the top-right of the lettering
 * (yellow offset shadow on PAL). Used everywhere the logo appears.
 */
export function Logo({ className = '', dark = false, size = 40 }: { className?: string; dark?: boolean; size?: number }) {
  const ink = dark ? '#FFFFFF' : '#171717';
  return (
    <span role="img" aria-label={brand} className={`inline-flex items-start ${className}`} style={{ height: size }}>
      <span
        aria-hidden="true"
        className="font-display font-extrabold"
        style={{ fontSize: size * 0.95, lineHeight: 1, letterSpacing: '-0.04em', color: ink, textShadow: `${size * 0.06}px ${size * 0.06}px 0 #FFDE59` }}
      >{content.brand.logoWord}</span>
      <svg aria-hidden="true" viewBox="128 11 62 54" style={{ height: size * 0.62, width: 'auto', marginLeft: size * 0.04, marginTop: size * 0.02 }}>
        <rect x="136" y="24" width="50" height="38" rx="8" fill="#FFDE59" />
        <rect x="132" y="20" width="50" height="38" rx="8" fill="#A4D7EB" stroke={ink} strokeWidth="3" />
        <rect x="144" y="14" width="14" height="8" rx="3" fill={ink} />
        <circle cx="157" cy="39" r="12" fill="#fff" stroke={ink} strokeWidth="3" />
        <circle cx="157" cy="39" r="6" fill="#171717" />
        <circle cx="153.5" cy="35.5" r="2" fill="#fff" />
        <circle cx="173" cy="28" r="2.4" fill="#E76F51" />
      </svg>
    </span>
  );
}

export function PhotoStrip({ className = '', tone = 0 }: { className?: string; tone?: number }) {
  const bg = ['#A4D7EB', '#FFDE59', '#FFF9E8', '#EAF6FC'];
  const fg = ['#F2A65A', '#A4D7EB', '#E76F51', '#3B8C69'];
  return (
    <svg viewBox="0 0 90 250" className={className} aria-hidden="true">
      <rect x="6" y="6" width="84" height="244" rx="8" fill="#171717" opacity=".15" />
      <rect x="2" y="2" width="84" height="244" rx="8" fill="#fff" stroke="#171717" strokeWidth="3" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x="10" y={10 + i * 70} width="68" height="62" rx="4" fill={bg[(i + tone) % 4]} stroke="#171717" strokeWidth="2.5" />
          <circle cx="32" cy={42 + i * 70} r="12" fill={fg[(i + tone) % 4]} stroke="#171717" strokeWidth="2.5" />
          <circle cx="56" cy={46 + i * 70} r="10" fill="#fff" stroke="#171717" strokeWidth="2.5" />
          <path d={`M24 ${66 + i * 70} q8 -16 16 0z`} fill={fg[(i + tone) % 4]} stroke="#171717" strokeWidth="2.5" />
          <path d={`M49 ${66 + i * 70} q7 -14 14 0z`} fill="#171717" />
        </g>
      ))}
      <text x="44" y="236" textAnchor="middle" fontSize="11" fontWeight="800" fill="#171717" fontFamily="Georgia,serif">{content.brand.stripCaption}</text>
    </svg>
  );
}

export function Sparkle({ className = '', color = '#FFDE59' }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <path d="M20 2 C21 14 26 19 38 20 C26 21 21 26 20 38 C19 26 14 21 2 20 C14 19 19 14 20 2Z" fill={color} stroke="#171717" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
