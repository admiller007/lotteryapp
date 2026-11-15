"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trophy, Volume2, VolumeX, X } from 'lucide-react';
import styles from './WinnerReveal.module.css';
import { SLICE_COLORS, WheelFace, WheelHub, WheelPointer, WheelRim, type WheelSlice } from './PrizeWheel';

export interface RevealPerson {
  id: string;
  name: string;
  profilePictureUrl?: string;
  facilityName?: string;
}

export interface RevealPrize {
  name: string;
  imageUrl?: string;
  tierName?: string;
  tierColor?: string;
}

interface WinnerRevealProps {
  prize: RevealPrize;
  /** People shown on the reel (usually the prize's entrants). */
  candidates: RevealPerson[];
  /** The drawn winner. May arrive after the reel has started spinning. */
  winner?: RevealPerson | null;
  /** Called when the reveal is dismissed, auto-advances, or gives up waiting. */
  onComplete: () => void;
  /** Auto-dismiss this long after the winner is revealed. Omit to wait for a click. */
  autoAdvanceMs?: number;
  /** Give up if no winner has arrived after this long. */
  waitTimeoutMs?: number;
  /** Shown on the reveal, e.g. "3 more winners to announce". */
  remainingCount?: number;
}

type Phase = 'spinning' | 'landing' | 'landed' | 'revealed';

// Wheel timing. The wheel winds back slightly, spins up, cruises until the
// winner is known (and at least MIN_SPIN_MS has passed), then slows to a stop.
const WINDUP_MS = 380;
const WINDUP_DEG = 14;
const SPIN_UP_MS = 900;
const MIN_SPIN_MS = 2600;
const CRUISE_DEG_PER_SEC = 540; // 1.5 turns a second
const LANDING_MS = 7500; // target length of the slow-down
const LANDED_HOLD_MS = 2200;
const MIN_SLICES = 8;
const MAX_SLICES = 24;
const MAX_FLAP_DEG = 24;
const FLAP_ZONE = 0.3; // fraction of a slice over which a peg pushes the pointer
const READOUT_SLICES_PER_SEC = 5; // show the name under the pointer below this speed
const MUTE_KEY = 'winnerRevealMuted';

const easeInQuad = (t: number) => t * t;
// Quartic ease-out: starts at 4x the average speed, so landing distance is
// chosen as v * duration / 4 to keep the hand-off from cruising seamless.
const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
const mod = (n: number, m: number) => ((n % m) + m) % m;

const shuffle = <T,>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const AVATAR_COLORS = ['#ff6b6b', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const initialsFor = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

const colorFor = (key: string) => {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

/** Photo with an initials fallback underneath, so a card is never blank while an image loads. */
export function PersonAvatar({ person, size, className = '' }: { person: RevealPerson; size: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const showImage = !!person.profilePictureUrl && !failed;
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full ${className}`}
      style={{ width: size, height: size, backgroundColor: colorFor(person.id || person.name) }}
    >
      <span
        className="absolute inset-0 flex items-center justify-center font-bold text-white select-none"
        style={{ fontSize: size * 0.36 }}
        aria-hidden={showImage}
      >
        {initialsFor(person.name)}
      </span>
      {showImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={person.profilePictureUrl}
          alt={person.name}
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

/* ---------------- Confetti ---------------- */

interface Particle {
  x: number; y: number; vx: number; vy: number;
  w: number; h: number; rot: number; vr: number;
  color: string; tilt: number; vt: number;
}

const CONFETTI_COLORS = ['#f7c948', '#ffe08a', '#ff6b6b', '#ffffff', '#5eead4', '#a78bfa', '#60a5fa'];

function Confetti({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: Particle[] = [];
    const spawn = (x: number, y: number, angle: number, spread: number, count: number, speed: number) => {
      for (let i = 0; i < count; i++) {
        const a = angle + (Math.random() - 0.5) * spread;
        const s = speed * (0.55 + Math.random() * 0.6);
        particles.push({
          x, y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          w: 6 + Math.random() * 6,
          h: 10 + Math.random() * 8,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.3,
          color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
          tilt: Math.random() * Math.PI,
          vt: 0.05 + Math.random() * 0.1,
        });
      }
    };

    const w = () => window.innerWidth;
    const h = () => window.innerHeight;
    const scale = Math.min(1, w() / 900);
    const narrow = w() < 640;
    // Two cannons from the bottom corners (steeper on phones so they don't
    // meet in the middle), then a few waves of rain from the top.
    const tilt = narrow ? 0.28 : Math.PI / 6;
    const count = Math.round(140 * scale) + 40;
    spawn(0, h(), -Math.PI / 2 + tilt, narrow ? 0.4 : 0.7, count, narrow ? 19 : 22);
    spawn(w(), h(), -Math.PI / 2 - tilt, narrow ? 0.4 : 0.7, count, narrow ? 19 : 22);
    const rain = window.setInterval(() => {
      for (let i = 0; i < 6; i++) spawn(Math.random() * w(), -20, Math.PI / 2, 0.6, 4, 4);
    }, 220);
    const stopRain = window.setTimeout(() => window.clearInterval(rain), 3200);

    let frame = 0;
    const draw = () => {
      ctx.clearRect(0, 0, w(), h());
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.vy += 0.32;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.tilt += p.vt;
        if (p.y > h() + 40) {
          particles.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.cos(p.tilt));
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(rain);
      window.clearTimeout(stopRain);
      window.removeEventListener('resize', resize);
    };
  }, [active]);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[2] h-full w-full" aria-hidden />;
}

/* ---------------- Main component ---------------- */

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

export default function WinnerReveal({
  prize,
  candidates,
  winner,
  onComplete,
  autoAdvanceMs,
  waitTimeoutMs = 15000,
  remainingCount = 0,
}: WinnerRevealProps) {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>('spinning');
  const [slices, setSlices] = useState<WheelSlice[]>(() => buildSlices(candidates, winner));
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [readout, setReadout] = useState<string | null>(null);
  const [landscape, setLandscape] = useState(true);
  const [muted, setMuted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const wheelRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<HTMLDivElement>(null);
  const slicesRef = useRef(slices);
  const winnerRef = useRef<RevealPerson | null | undefined>(winner);
  const onCompleteRef = useRef(onComplete);
  const mutedRef = useRef(muted);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const completedRef = useRef(false);

  winnerRef.current = winner;
  onCompleteRef.current = onComplete;
  mutedRef.current = muted;

  const entrantCount = useMemo(() => new Set(candidates.map((person) => person.id)).size, [candidates]);

  const complete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onCompleteRef.current();
  }, []);

  /* ----- audio ----- */

  const getAudioCtx = useCallback(() => {
    if (typeof window === 'undefined') return null;
    if (!audioCtxRef.current) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      try {
        audioCtxRef.current = new Ctor();
      } catch {
        return null;
      }
    }
    return audioCtxRef.current;
  }, []);

  const unlockAudio = useCallback(() => {
    const ctx = getAudioCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }, [getAudioCtx]);

  /** A short wooden "clack" as a peg passes the pointer. */
  const playTick = useCallback((slow: boolean) => {
    if (mutedRef.current) return;
    const ctx = getAudioCtx();
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(slow ? 1150 : 1600, t);
    osc.frequency.exponentialRampToValueAtTime(slow ? 600 : 900, t + 0.04);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(slow ? 0.32 : 0.16, t + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.07);
  }, [getAudioCtx]);

  const playFanfare = useCallback(() => {
    if (mutedRef.current) return;
    try {
      const audio = new Audio('/sounds/winning_slot.wav');
      audio.volume = 0.85;
      audio.play().catch(() => {});
    } catch {
      /* audio unavailable */
    }
  }, []);

  /* ----- setup ----- */

  useEffect(() => {
    setMounted(true);
    try {
      setMuted(localStorage.getItem(MUTE_KEY) === 'true');
    } catch {
      /* storage unavailable */
    }
    setReducedMotion(!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

    const measure = () => setLandscape(window.innerWidth / window.innerHeight > 1.15);
    measure();
    window.addEventListener('resize', measure);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    getAudioCtx(); // may start suspended until the first click

    return () => {
      window.removeEventListener('resize', measure);
      document.body.style.overflow = previousOverflow;
      audioCtxRef.current?.close().catch(() => {});
    };
  }, [getAudioCtx]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    unlockAudio();
    try {
      localStorage.setItem(MUTE_KEY, String(next));
    } catch {
      /* storage unavailable */
    }
  };

  /* ----- wheel animation ----- */

  useEffect(() => {
    if (!mounted) return;
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
      setPhase('landing');
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
          setPhase('landed');
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
          playTick(slicesPerSec < 8);
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
  }, [mounted, reducedMotion]);

  // Landed: celebrate on the wheel, then go to the full reveal.
  useEffect(() => {
    if (phase !== 'landed') return;
    playFanfare();
    const timer = window.setTimeout(() => setPhase('revealed'), reducedMotion ? 600 : LANDED_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [phase, playFanfare, reducedMotion]);

  // Auto-advance after the reveal.
  useEffect(() => {
    if (phase !== 'revealed' || !autoAdvanceMs) return;
    const timer = window.setTimeout(complete, autoAdvanceMs);
    return () => window.clearTimeout(timer);
  }, [phase, autoAdvanceMs, complete]);

  // Give up if the winner never arrives (e.g. no eligible entrants, or a conflict).
  useEffect(() => {
    if (winner) return;
    const timer = window.setTimeout(complete, waitTimeoutMs);
    return () => window.clearTimeout(timer);
  }, [winner, waitTimeoutMs, complete]);

  // Keyboard: Esc closes any time; Enter/Space continues after the reveal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') complete();
      if (phase === 'revealed' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        complete();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, complete]);

  // Warm the cache for the winner's photo before the wheel stops.
  useEffect(() => {
    if (winner?.profilePictureUrl) {
      const img = new Image();
      img.src = winner.profilePictureUrl;
    }
  }, [winner?.profilePictureUrl]);

  /* ----- render ----- */

  const showReveal = phase === 'revealed' && !!winner;
  const isLanded = phase === 'landed' || phase === 'revealed';
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

  const revealPortrait = typeof window !== 'undefined' ? Math.round(Math.max(140, Math.min(window.innerHeight * 0.3, window.innerWidth * 0.42, 440))) : 220;

  const content = (
    <div
      className={`${styles.stage} fixed inset-0 z-[100] flex flex-col overflow-hidden`}
      role="dialog"
      aria-modal="true"
      aria-label={`Winner drawing for ${prize.name}`}
      onPointerDown={unlockAudio}
    >
      {/* Top bar */}
      <div className="relative z-[3] flex items-center justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-5">
        <div
          className="flex items-center gap-2 font-semibold uppercase tracking-[0.25em] text-white/60"
          style={{ fontSize: 'clamp(0.75rem, 1vw, 1.25rem)' }}
        >
          <Trophy className="h-[1.2em] w-[1.2em] text-[#f7c948]" />
          {showReveal ? 'Winner' : 'Now drawing'}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMute}
            className="rounded-full bg-white/10 p-2.5 text-white/80 transition hover:bg-white/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7c948]"
            aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
            title={muted ? 'Turn sound on' : 'Turn sound off'}
          >
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={complete}
            className="rounded-full bg-white/10 p-2.5 text-white/80 transition hover:bg-white/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7c948]"
            aria-label="Close"
            title="Close (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {!showReveal ? (
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
      ) : (
        /* ---------- Reveal ---------- */
        <div className="relative z-[3] flex flex-1 flex-col items-center justify-center px-4 pb-[4vh] text-center">
          <div className={styles.rays} />
          <div className="relative flex flex-col items-center">
            <div className={styles.portraitRing}>
              <PersonAvatar person={winner!} size={revealPortrait} className="ring-4 ring-[#0b0f1f]" />
            </div>

            <p
              className={`${styles.riseIn} mt-[3vh] font-semibold uppercase tracking-[0.3em] text-[#f7c948]`}
              style={{ animationDelay: '250ms', fontSize: 'clamp(0.9rem, 1.6vw, 2rem)' }}
            >
              Congratulations
            </p>
            <h2 className={`${styles.riseIn} ${styles.winnerName} mt-[1vh] max-w-[20ch]`} style={{ animationDelay: '350ms' }} aria-live="assertive">
              {winner!.name}
            </h2>
            {winner!.facilityName && (
              <p className={`${styles.riseIn} mt-[1vh] text-white/60`} style={{ animationDelay: '450ms', fontSize: 'clamp(1rem, 1.8vw, 2.25rem)' }}>
                {winner!.facilityName}
              </p>
            )}

            <div
              className={`${styles.riseIn} mt-[3.5vh] flex items-center gap-[0.8em] rounded-[1.2em] border border-white/15 bg-white/10 py-[0.6em] pl-[0.6em] pr-[1.4em] backdrop-blur`}
              style={{ animationDelay: '600ms', fontSize: 'clamp(1rem, 1.5vw, 2rem)' }}
            >
              {prize.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={prize.imageUrl} alt="" className="h-[3.4em] w-[3.4em] rounded-[0.7em] bg-white object-contain p-[0.25em]" />
              ) : (
                <div className="flex h-[3.4em] w-[3.4em] items-center justify-center rounded-[0.7em] bg-[#f7c948]/20">
                  <Trophy className="h-[1.6em] w-[1.6em] text-[#f7c948]" />
                </div>
              )}
              <div className="text-left">
                <p className="text-[0.7em] uppercase tracking-wider text-white/60">Wins</p>
                <p className="text-[1.5em] font-bold leading-tight">{prize.name}</p>
              </div>
            </div>

            <div className={`${styles.riseIn} mt-[4vh] flex flex-col items-center gap-3`} style={{ animationDelay: '800ms' }}>
              <button
                type="button"
                onClick={complete}
                className="relative overflow-hidden rounded-full bg-[#f7c948] px-[2em] py-[0.75em] font-bold text-[#0b0f1f] shadow-lg transition hover:bg-[#ffe08a] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/60"
                style={{ fontSize: 'clamp(1rem, 1.3vw, 1.75rem)' }}
              >
                {remainingCount > 0 ? 'Next winner' : 'Continue'}
                {autoAdvanceMs && (
                  <span
                    className={`${styles.countdown} absolute bottom-0 left-0 h-1 w-full bg-[#0b0f1f]/30`}
                    style={{ animationDuration: `${autoAdvanceMs}ms` }}
                  />
                )}
              </button>
              {remainingCount > 0 && (
                <p className="text-white/60" style={{ fontSize: 'clamp(0.875rem, 1.1vw, 1.5rem)' }}>
                  {remainingCount} more {remainingCount === 1 ? 'winner' : 'winners'} to announce
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {!reducedMotion && <Confetti active={showReveal} />}
    </div>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
}
