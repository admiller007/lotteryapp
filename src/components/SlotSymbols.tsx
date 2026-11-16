import React from 'react';

/* Classic slot-machine symbols, drawn as SVG so they stay sharp on a projector.
   Gradients live in <SlotSymbolDefs>, rendered once per machine with a unique
   id prefix, so the many symbol instances can share them. */

export const SLOT_SYMBOLS = ['seven', 'cherry', 'lemon', 'bar', 'bell', 'diamond'] as const;
export type SlotSymbolName = (typeof SLOT_SYMBOLS)[number];

export function SlotSymbolDefs({ id }: { id: string }) {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
      <defs>
        <linearGradient id={`${id}-seven`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffb347" />
          <stop offset="45%" stopColor="#ff5a1f" />
          <stop offset="100%" stopColor="#c8102e" />
        </linearGradient>
        <radialGradient id={`${id}-cherry`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ff8a8a" />
          <stop offset="45%" stopColor="#e11d2e" />
          <stop offset="100%" stopColor="#7f0d17" />
        </radialGradient>
        <radialGradient id={`${id}-lemon`} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#fff9c4" />
          <stop offset="50%" stopColor="#ffe03a" />
          <stop offset="100%" stopColor="#e0a800" />
        </radialGradient>
        <linearGradient id={`${id}-leaf`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#86efac" />
          <stop offset="100%" stopColor="#15803d" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff1b8" />
          <stop offset="40%" stopColor="#f7c948" />
          <stop offset="100%" stopColor="#a16207" />
        </linearGradient>
        <linearGradient id={`${id}-gem`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bae6fd" />
          <stop offset="50%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        {/* Vertical-only blur for spinning reels. */}
        <filter id={`${id}-blur1`} x="0" y="-10%" width="100%" height="120%">
          <feGaussianBlur stdDeviation="0 3" />
        </filter>
        <filter id={`${id}-blur2`} x="0" y="-10%" width="100%" height="120%">
          <feGaussianBlur stdDeviation="0 8" />
        </filter>
      </defs>
    </svg>
  );
}

const OUTLINE = { strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

export function SlotSymbol({ name, id, size }: { name: SlotSymbolName; id: string; size: number }) {
  const common = { width: size, height: size, viewBox: '0 0 100 100', 'aria-hidden': true };
  switch (name) {
    case 'seven':
      return (
        <svg {...common}>
          <path
            d="M16 12 H86 V29 C70 46 59 66 55 90 H31 C35 66 47 46 61 30 H16 Z"
            fill={`url(#${id}-seven)`}
            stroke="#4a0610"
            strokeWidth={5}
            {...OUTLINE}
          />
          <path d="M22 18 H79" stroke="#ffe3b0" strokeWidth={3.5} opacity={0.75} {...OUTLINE} />
        </svg>
      );
    case 'cherry':
      return (
        <svg {...common}>
          <path d="M33 56 C36 38 46 26 58 18 M65 58 C66 42 63 30 58 18" fill="none" stroke="#3f6212" strokeWidth={4.5} {...OUTLINE} />
          <path d="M58 18 C66 8 84 8 90 16 C80 24 66 24 58 18 Z" fill={`url(#${id}-leaf)`} stroke="#14532d" strokeWidth={2.5} {...OUTLINE} />
          <circle cx={33} cy={68} r={17} fill={`url(#${id}-cherry)`} stroke="#4a0610" strokeWidth={3} />
          <circle cx={66} cy={72} r={17} fill={`url(#${id}-cherry)`} stroke="#4a0610" strokeWidth={3} />
          <ellipse cx={27} cy={62} rx={4.5} ry={3} fill="#fff" opacity={0.75} />
          <ellipse cx={60} cy={66} rx={4.5} ry={3} fill="#fff" opacity={0.75} />
        </svg>
      );
    case 'lemon':
      return (
        <svg {...common}>
          <path
            d="M10 56 C14 30 40 22 58 26 C76 30 90 42 90 56 C88 76 62 86 42 84 C24 82 12 72 10 56 Z"
            fill={`url(#${id}-lemon)`}
            stroke="#7a5b00"
            strokeWidth={3.5}
            {...OUTLINE}
          />
          <ellipse cx={36} cy={46} rx={10} ry={5} fill="#fff" opacity={0.55} transform="rotate(-20 36 46)" />
          <path d="M56 26 C58 14 72 8 84 12 C80 24 68 28 56 26 Z" fill={`url(#${id}-leaf)`} stroke="#14532d" strokeWidth={2.5} {...OUTLINE} />
        </svg>
      );
    case 'bar':
      return (
        <svg {...common}>
          <rect x={6} y={24} width={88} height={4} rx={1} fill="#111" />
          <rect x={6} y={33} width={88} height={34} rx={5} fill="#111" />
          <rect x={6} y={72} width={88} height={4} rx={1} fill="#111" />
          <text
            x={50}
            y={51}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="Georgia, 'Times New Roman', serif"
            fontWeight={900}
            fontSize={27}
            letterSpacing={2}
            fill="#e11d2e"
            stroke="#fff"
            strokeWidth={0.8}
          >
            BAR
          </text>
        </svg>
      );
    case 'bell':
      return (
        <svg {...common}>
          <circle cx={50} cy={14} r={6} fill={`url(#${id}-gold)`} stroke="#5c3d00" strokeWidth={2.5} />
          <circle cx={50} cy={82} r={9} fill={`url(#${id}-gold)`} stroke="#5c3d00" strokeWidth={2.5} />
          <path
            d="M50 18 C31 18 27 36 27 52 C27 64 19 70 13 76 H87 C81 70 73 64 73 52 C73 36 69 18 50 18 Z"
            fill={`url(#${id}-gold)`}
            stroke="#5c3d00"
            strokeWidth={3.5}
            {...OUTLINE}
          />
          <path d="M38 30 C34 38 34 48 34 56" stroke="#fff" strokeWidth={4} opacity={0.6} fill="none" {...OUTLINE} />
        </svg>
      );
    case 'diamond':
    default:
      return (
        <svg {...common}>
          <path d="M50 90 L10 38 L27 16 H73 L90 38 Z" fill={`url(#${id}-gem)`} stroke="#1e3a8a" strokeWidth={3.5} {...OUTLINE} />
          <path d="M10 38 H90 M27 16 L38 38 L50 90 L62 38 L73 16 M38 38 L50 16 L62 38" fill="none" stroke="#1e3a8a" strokeWidth={2} opacity={0.7} {...OUTLINE} />
          <path d="M30 20 L36 34" stroke="#fff" strokeWidth={3} opacity={0.8} {...OUTLINE} />
        </svg>
      );
  }
}
