"use client";

import React, { forwardRef, useId, useState } from 'react';
import { Trophy } from 'lucide-react';
import styles from './WinnerReveal.module.css';
import type { RevealPerson } from './WinnerReveal';

/*
 * Casino-style prize wheel, drawn as SVG in a 1000x1000 box so it stays sharp
 * at projector sizes. The face (slices, names, photos, pegs) rotates; the gold
 * rim, bulbs, hub and pointer stay still. The parent drives rotation and the
 * pointer flap through refs so the 60fps animation never re-renders React.
 *
 * Slice i covers wheel angles [i*s, (i+1)*s], measured clockwise from 3
 * o'clock, where the pointer sits. Names run outward along each slice, so the
 * slice that stops at the pointer reads left to right.
 */

const C = 500; // centre
const FACE_R = 448; // rotating face radius
const RIM_INNER = 452;
const RIM_OUTER = 496;
const BULB_R = 474;
const BULB_COUNT = 36;
const PHOTO_CENTER = 370;
const NAME_START = 114; // just outside the hub

// Rich, high-contrast slice colours that read well on a projector.
export const SLICE_COLORS = ['#e63946', '#1d4ed8', '#f59e0b', '#059669', '#7c3aed', '#db2777', '#0891b2', '#ea580c'];

export interface WheelSlice {
  person: RevealPerson;
  color: string;
}

const polar = (r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return { x: C + r * Math.cos(rad), y: C + r * Math.sin(rad) };
};

const initialsFor = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

/**
 * Fit a name into the space along the slice so it stays readable from the back
 * of the room: shrink a little, then fall back to "First L.", then truncate.
 */
const fitName = (name: string, maxWidth: number, baseSize: number) => {
  const charWidth = 0.56; // average glyph width / font size for bold PT Sans
  const minSize = Math.max(18, baseSize * 0.6);
  const sizeFor = (text: string) => Math.min(baseSize, maxWidth / Math.max(1, text.length * charWidth));

  const parts = name.trim().split(/\s+/);
  const short = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : name;
  for (const text of [name, short]) {
    const size = sizeFor(text);
    if (size >= minSize) return { text, size };
  }
  const maxChars = Math.max(3, Math.floor(maxWidth / (minSize * charWidth)));
  return { text: short.length > maxChars ? `${short.slice(0, maxChars - 1).trimEnd()}…` : short, size: minSize };
};

function SlicePhoto({ person, r, clipId }: { person: RevealPerson; r: number; clipId: string }) {
  const [failed, setFailed] = useState(false);
  const cx = C + PHOTO_CENTER;
  return (
    <g>
      <circle cx={cx} cy={C} r={r + 5} fill="rgba(255,255,255,0.9)" />
      <circle cx={cx} cy={C} r={r} fill="rgba(0,0,0,0.25)" />
      <text
        x={cx}
        y={C}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fff"
        fontWeight={800}
        fontSize={r * 0.72}
      >
        {initialsFor(person.name)}
      </text>
      {person.profilePictureUrl && !failed && (
        <image
          href={person.profilePictureUrl}
          x={cx - r}
          y={C - r}
          width={r * 2}
          height={r * 2}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
          onError={() => setFailed(true)}
        />
      )}
    </g>
  );
}

/** The rotating face. Memoised: it only re-renders when slices or the highlight change. */
export const WheelFace = React.memo(function WheelFace({
  slices,
  highlightIndex,
}: {
  slices: WheelSlice[];
  highlightIndex: number | null;
}) {
  const uid = useId().replace(/:/g, '');
  const n = slices.length;
  const s = 360 / n;
  const half = s / 2;
  const a = polar(FACE_R, -half);
  const b = polar(FACE_R, half);
  const slicePath = `M ${C} ${C} L ${a.x} ${a.y} A ${FACE_R} ${FACE_R} 0 0 1 ${b.x} ${b.y} Z`;

  const photoR = Math.min(56, PHOTO_CENTER * Math.sin((half * Math.PI) / 180) * 0.72);
  const nameEnd = PHOTO_CENTER - photoR - 16;
  const arcAtMid = 2 * 250 * Math.sin((half * Math.PI) / 180);
  const baseFont = Math.max(20, Math.min(44, arcAtMid * 0.5));
  const clipId = `${uid}-photo`;
  const peg = polar(FACE_R - 14, -half);

  return (
    <svg viewBox="0 0 1000 1000" className="h-full w-full" aria-hidden>
      <defs>
        <clipPath id={clipId}>
          <circle cx={C + PHOTO_CENTER} cy={C} r={photoR} />
        </clipPath>
        <radialGradient id={`${uid}-shade`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000" stopOpacity="0.35" />
          <stop offset="35%" stopColor="#000" stopOpacity="0.08" />
          <stop offset="88%" stopColor="#fff" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.3" />
        </radialGradient>
      </defs>

      {slices.map((slice, i) => {
        const { text, size } = fitName(slice.person.name, nameEnd - NAME_START, baseFont);
        const dim = highlightIndex !== null && highlightIndex !== i;
        return (
          <g key={i} transform={`rotate(${i * s + half} ${C} ${C})`}>
            <path d={slicePath} fill={slice.color} stroke="#f7c948" strokeWidth={3} strokeOpacity={0.85} />
            <text
              x={C + nameEnd}
              y={C}
              textAnchor="end"
              dominantBaseline="central"
              fill="#fff"
              fontWeight={700}
              fontSize={size}
              style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.35)', strokeWidth: size * 0.12 }}
            >
              {text}
            </text>
            <SlicePhoto person={slice.person} r={photoR} clipId={clipId} />
            <circle cx={peg.x} cy={peg.y} r={8} fill="#ffe08a" stroke="#8a5a00" strokeWidth={2} />
            {dim && <path d={slicePath} fill="#000" opacity={0.6} />}
          </g>
        );
      })}

      <circle cx={C} cy={C} r={FACE_R} fill={`url(#${uid}-shade)`} pointerEvents="none" />

      {highlightIndex !== null && (
        <g transform={`rotate(${highlightIndex * s + half} ${C} ${C})`}>
          <path d={slicePath} fill="none" stroke="#fff6c7" strokeWidth={10} className={styles.sliceGlow} />
        </g>
      )}
    </svg>
  );
});

/** Static gold rim with marquee bulbs. */
export function WheelRim({ mode }: { mode: 'spin' | 'slow' | 'win' }) {
  const uid = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 1000 1000" className={`${styles.rim} pointer-events-none absolute inset-0 h-full w-full`} data-mode={mode} aria-hidden>
      <defs>
        <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff1b8" />
          <stop offset="30%" stopColor="#f7c948" />
          <stop offset="60%" stopColor="#b7791f" />
          <stop offset="100%" stopColor="#f7c948" />
        </linearGradient>
      </defs>
      <circle
        cx={C}
        cy={C}
        r={(RIM_INNER + RIM_OUTER) / 2}
        fill="none"
        stroke={`url(#${uid}-gold)`}
        strokeWidth={RIM_OUTER - RIM_INNER}
      />
      <circle cx={C} cy={C} r={RIM_INNER} fill="none" stroke="#5c3d00" strokeWidth={3} />
      <circle cx={C} cy={C} r={RIM_OUTER} fill="none" stroke="#5c3d00" strokeWidth={3} />
      {Array.from({ length: BULB_COUNT }, (_, i) => {
        const p = polar(BULB_R, (360 / BULB_COUNT) * i);
        return (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={10}
            className={i % 2 === 0 ? styles.bulbA : styles.bulbB}
          />
        );
      })}
    </svg>
  );
}

/** Static hub in the middle of the wheel. */
export function WheelHub() {
  return (
    <div
      className={`${styles.hub} pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full`}
      style={{ width: '21%', height: '21%' }}
      aria-hidden
    >
      <Trophy className="h-[45%] w-[45%] text-[#7a4d00]" strokeWidth={2.2} />
    </div>
  );
}

/** Gold pointer at 3 o'clock. It pivots on its right end; the parent sets its rotation. */
export const WheelPointer = forwardRef<HTMLDivElement>(function WheelPointer(_, ref) {
  const uid = useId().replace(/:/g, '');
  return (
    <div
      ref={ref}
      className="pointer-events-none absolute top-1/2"
      style={{ left: '93%', width: '15%', height: '12%', marginTop: '-6%', transformOrigin: '78% 50%', zIndex: 2 }}
      aria-hidden
    >
      <svg viewBox="0 0 140 100" className="h-full w-full overflow-visible" style={{ filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.55))' }}>
        <defs>
          <linearGradient id={`${uid}-pg`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff1b8" />
            <stop offset="45%" stopColor="#f7c948" />
            <stop offset="100%" stopColor="#a16207" />
          </linearGradient>
        </defs>
        <path d="M 4 50 L 98 18 A 34 34 0 1 1 98 82 Z" fill={`url(#${uid}-pg)`} stroke="#5c3d00" strokeWidth={3} strokeLinejoin="round" />
        <circle cx={109} cy={50} r={15} fill="#e63946" stroke="#5c3d00" strokeWidth={3} />
        <circle cx={104} cy={45} r={5} fill="#fff" opacity={0.6} />
      </svg>
    </div>
  );
});
