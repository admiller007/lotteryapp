"use client";

import React, { forwardRef, useEffect, useId, useRef, useState } from 'react';
import { Trophy } from 'lucide-react';
import styles from './WinnerReveal.module.css';
import {
  easeInQuad,
  easeOutQuart,
  mod,
  shuffle,
  type DrawAnimationProps,
  type RevealPerson,
} from './drawShared';

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

/* ---------------- Wheel draw ---------------- */

// Wheel timing. The wheel winds back slightly, spins up, cruises until the
// winner is known (and at least MIN_SPIN_MS has passed), then slows to a stop.
const WINDUP_MS = 380;
const WINDUP_DEG = 14;
const SPIN_UP_MS = 900;
const MIN_SPIN_MS = 2600;
const CRUISE_DEG_PER_SEC = 540; // 1.5 turns a second
const LANDING_MS = 7500; // target length of the slow-down
const MIN_SLICES = 8;
const MAX_SLICES = 24;
const MAX_FLAP_DEG = 24;
const FLAP_ZONE = 0.3; // fraction of a slice over which a peg pushes the pointer
const READOUT_SLICES_PER_SEC = 5; // show the name under the pointer below this speed

/** Pick and colour the wheel's slices. Small groups repeat so it still looks like a wheel. */
const buildSlices = (candidates: RevealPerson[], winner?: RevealPerson | null): WheelSlice[] => {
  const unique = new Map<string, RevealPerson>();
  candidates.forEach((person) => {
    if (person?.id && !unique.has(person.id)) unique.set(person.id, person);
  });
  let people = shuffle(Array.from(unique.values()));
  if (winner) {
    people = shuffle([winner, ...people.filter((p) => p.id !== winner.id).slice(0, MAX_SLICES - 1)]);
  } else {
    people = people.slice(0, MAX_SLICES);
  }
  if (people.length === 0) people = [{ id: '?', name: '?' }];
  const base = people;
  while (people.length < MIN_SLICES) people = [...people, ...base];

  const n = people.length;
  const p = SLICE_COLORS.length;
  return people.map((person, i) => {
    // Keep the last slice from matching the first one's colour where they meet.
    const colorIndex = i === n - 1 && n % p === 1 ? 2 : i % p;
    return { person, color: SLICE_COLORS[colorIndex] };
  });
};

/** The full wheel draw: prize details, the wheel, and the name under the pointer. */
export function WheelDraw({
  prize,
  candidates,
  initialWinner,
  winnerRef,
  entrantCount,
  landscape,
  reducedMotion,
  sounds,
  onLanded,
}: DrawAnimationProps) {
  const [slices, setSlices] = useState<WheelSlice[]>(() => buildSlices(candidates, initialWinner));
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [readout, setReadout] = useState<string | null>(null);
  const [landed, setLanded] = useState(false);

  const wheelRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<HTMLDivElement>(null);
  const slicesRef = useRef(slices);
  const onLandedRef = useRef(onLanded);
  const soundsRef = useRef(sounds);
  onLandedRef.current = onLanded;
  soundsRef.current = sounds;

  useEffect(() => {
    const n = slicesRef.current.length;
    const s = 360 / n;
    const minSpin = reducedMotion ? 800 : MIN_SPIN_MS;
    const landingMs = reducedMotion ? 2000 : LANDING_MS;

    let theta = 0; // wheel rotation, degrees clockwise
    let velocity = 0; // degrees per second
    let pointerAngle = 0;
    let lastSlice = -1;
    let lastTickAt = 0;
    let showingReadout = false;
    let landing: { from: number; distance: number; start: number; duration: number; index: number } | null = null;
    let frame = 0;
    const start = performance.now();
    let last = start;

    if (pointerRef.current) pointerRef.current.style.transition = '';

    const planLanding = (now: number, w: RevealPerson) => {
      let current = slicesRef.current;
      const matches = current.map((slice, i) => (slice.person.id === w.id ? i : -1)).filter((i) => i >= 0);
      let index: number;
      if (matches.length > 0) {
        index = matches[Math.floor(Math.random() * matches.length)];
      } else {
        // Winner wasn't on the wheel (it was built before the draw). Put them
        // on the slice furthest from the pointer, where nobody is looking,
        // while the wheel is still a blur.
        index = 0;
        let best = Infinity;
        current.forEach((_, i) => {
          const screenAngle = mod((i + 0.5) * s + theta, 360);
          const away = Math.abs(screenAngle - 180);
          if (away < best) {
            best = away;
            index = i;
          }
        });
        current = current.map((slice, i) => (i === index ? { ...slice, person: w } : slice));
        slicesRef.current = current;
        setSlices(current);
      }

      // Stop somewhere inside the slice (not dead centre), clear of the pegs.
      const targetAngle = (index + 0.35 + Math.random() * 0.4) * s;
      const angleUnderPointer = mod(-theta, 360);
      const toTarget = mod(angleUnderPointer - targetAngle, 360);
      // Quartic ease-out starts at 4x its average speed; pick the number of
      // extra turns that keeps the hand-off from cruising smooth.
      const natural = (velocity * (landingMs / 1000)) / 4;
      const turns = Math.max(1, Math.round((natural - toTarget) / 360));
      const distance = toTarget + 360 * turns;
      const duration = Math.min(landingMs * 1.35, Math.max(landingMs * 0.7, ((4 * distance) / velocity) * 1000));
      landing = { from: theta, distance, start: now, duration, index };
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const elapsed = now - start;

      if (!landing) {
        if (elapsed < WINDUP_MS) {
          theta = -WINDUP_DEG * Math.sin((Math.PI / 2) * (elapsed / WINDUP_MS));
          velocity = 0;
        } else {
          velocity = CRUISE_DEG_PER_SEC * easeInQuad(Math.min(1, (elapsed - WINDUP_MS) / SPIN_UP_MS));
          theta += velocity * dt;
        }
        const w = winnerRef.current;
        if (w && elapsed >= minSpin && velocity >= CRUISE_DEG_PER_SEC * 0.99) planLanding(now, w);
      } else {
        const t = Math.min(1, (now - landing.start) / landing.duration);
        theta = landing.from + landing.distance * easeOutQuart(t);
        velocity = (4 * landing.distance * Math.pow(1 - t, 3)) / (landing.duration / 1000);
        if (t >= 1) {
          if (wheelRef.current) wheelRef.current.style.transform = `rotate(${theta}deg)`;
          if (pointerRef.current) {
            pointerRef.current.style.transition = 'transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1)';
            pointerRef.current.style.transform = 'rotate(0deg)';
          }
          setReadout(slicesRef.current[landing.index].person.name);
          setHighlightIndex(landing.index);
          setLanded(true);
          onLandedRef.current();
          return;
        }
      }

      if (wheelRef.current) wheelRef.current.style.transform = `rotate(${theta}deg)`;

      // Which slice is under the pointer, and how far into it we are.
      const position = mod(-theta, 360) / s;
      const slice = Math.floor(position) % n;
      const frac = position - Math.floor(position);
      const slicesPerSec = velocity / s;

      // Pointer flap: the next peg pushes the pointer as it approaches, then
      // slips past and the pointer springs back.
      const amplitude = slicesPerSec > 12 ? MAX_FLAP_DEG * 0.45 : MAX_FLAP_DEG;
      const push = velocity > 0 && frac < FLAP_ZONE ? amplitude * (1 - frac / FLAP_ZONE) : 0;
      pointerAngle = push > pointerAngle ? push : pointerAngle + (push - pointerAngle) * Math.min(1, dt * 24);
      if (pointerRef.current) pointerRef.current.style.transform = `rotate(${-pointerAngle}deg)`;

      if (slice !== lastSlice) {
        lastSlice = slice;
        if (now - lastTickAt > 40) {
          lastTickAt = now;
          soundsRef.current.tick(slicesPerSec < 8);
        }
        if (landing && slicesPerSec < READOUT_SLICES_PER_SEC) showingReadout = true;
        if (showingReadout) setReadout(slicesRef.current[slice].person.name);
      }

      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
    // The loop reads the winner through a ref; restarting it would reset the wheel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  const isLanded = landed;
  const rimMode = isLanded ? 'win' : readout ? 'slow' : 'spin';
  const wheelSize = landscape ? 'min(84vh, 52vw)' : 'min(86vw, 56vh)';

  const prizeImage = prize.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={prize.imageUrl}
      alt=""
      className="rounded-3xl bg-white object-contain shadow-2xl"
      style={landscape ? { width: '17vh', height: '17vh', padding: '1.2vh' } : { width: 72, height: 72, padding: 6 }}
    />
  ) : null;

  const tierChip = prize.tierName ? (
    <span
      className="inline-flex items-center gap-2 rounded-full bg-white/10 px-[0.9em] py-[0.35em] font-semibold"
      style={{ fontSize: landscape ? 'clamp(0.8rem, 1.1vw, 1.5rem)' : '0.75rem' }}
    >
      <span className="h-[0.6em] w-[0.6em] rounded-full" style={{ backgroundColor: prize.tierColor || '#f7c948' }} />
      {prize.tierName}
    </span>
  ) : null;

  const readoutBlock = (
    <div
      className={`flex flex-col justify-center ${landscape ? 'items-start' : 'items-center text-center'}`}
      style={{ minHeight: landscape ? '18vh' : 88 }}
      aria-live="polite"
    >
      {isLanded ? (
        <>
          <span className="font-semibold uppercase tracking-[0.3em] text-[#f7c948]" style={{ fontSize: landscape ? 'clamp(0.9rem, 1.3vw, 1.8rem)' : '0.8rem' }}>
            The winner is
          </span>
          <span className={`${styles.winnerName} ${styles.riseIn}`} style={{ fontSize: landscape ? 'clamp(2rem, 4.2vw, 6.5rem)' : '2.25rem' }}>
            {readout}
          </span>
        </>
      ) : readout ? (
        <span
          key={readout}
          className={`${styles.readoutPop} font-extrabold leading-tight text-white`}
          style={{ fontSize: landscape ? 'clamp(1.75rem, 3.4vw, 5rem)' : '1.75rem' }}
        >
          {readout}
        </span>
      ) : (
        <span className={`${styles.dots} font-semibold text-white/70`} style={{ fontSize: landscape ? 'clamp(1.25rem, 2.2vw, 3rem)' : '1.25rem' }}>
          Spinning
        </span>
      )}
    </div>
  );

  const wheel = (
    <div className="relative shrink-0" style={{ width: wheelSize, height: wheelSize }}>
      <div className="absolute inset-[0.5%] rounded-full shadow-[0_30px_80px_rgba(0,0,0,0.65),0_0_120px_rgba(247,201,72,0.18)]" />
      <div ref={wheelRef} className="absolute inset-0" style={{ willChange: 'transform' }}>
        <WheelFace slices={slices} highlightIndex={highlightIndex} />
      </div>
      <WheelRim mode={rimMode} />
      <WheelHub />
      <WheelPointer ref={pointerRef} />
    </div>
  );

  return (
        landscape ? (
          /* ---------- Draw, landscape (projector): prize on the left, wheel on the right ---------- */
          <div className="relative z-[3] flex flex-1 items-center justify-center gap-[5vw] px-[4vw] pb-[4vh]">
            <div className="flex min-w-0 max-w-[36vw] flex-1 flex-col items-start gap-[2.2vh]">
              {prizeImage}
              {tierChip}
              <h2 className="font-extrabold leading-[1.05]" style={{ fontSize: 'clamp(2rem, 4.4vw, 6.5rem)' }}>
                {prize.name}
              </h2>
              <p className="text-white/60" style={{ fontSize: 'clamp(1rem, 1.4vw, 2rem)' }}>
                {entrantCount} {entrantCount === 1 ? 'entrant' : 'entrants'}
              </p>
              <div className="h-px w-[60%] bg-gradient-to-r from-[#f7c948]/70 to-transparent" />
              {readoutBlock}
            </div>
            <div className="pr-[3vw]">{wheel}</div>
          </div>
        ) : (
          /* ---------- Draw, portrait (phone): stacked ---------- */
          <div className="relative z-[3] flex flex-1 flex-col items-center justify-center gap-5 px-4 pb-6">
            <div className="flex flex-col items-center gap-2 text-center">
              {prizeImage}
              {tierChip}
              <h2 className="text-3xl font-extrabold leading-tight">{prize.name}</h2>
              <p className="text-sm text-white/60">
                {entrantCount} {entrantCount === 1 ? 'entrant' : 'entrants'}
              </p>
            </div>
            <div className="pr-[5vw]">{wheel}</div>
            {readoutBlock}
          </div>
        )
  );
}
