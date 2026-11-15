"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trophy, Volume2, VolumeX, X } from 'lucide-react';
import styles from './WinnerReveal.module.css';

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

const SPIN_UP_MS = 700;
const MIN_SPIN_MS = 2200;
const LANDING_MS = 5600;
const LANDED_HOLD_MS = 1300;
const CARDS_PER_SECOND = 18;
const MAX_REEL_PEOPLE = 40;
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

export default function WinnerReveal({
  prize,
  candidates,
  winner,
  onComplete,
  autoAdvanceMs,
  waitTimeoutMs = 12000,
  remainingCount = 0,
}: WinnerRevealProps) {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>('spinning');
  const [offset, setOffset] = useState(0);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  const [viewportWidth, setViewportWidth] = useState(1024);
  const [muted, setMuted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const reelRef = useRef<HTMLDivElement>(null);
  const winnerRef = useRef<RevealPerson | null | undefined>(winner);
  const onCompleteRef = useRef(onComplete);
  const mutedRef = useRef(muted);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const completedRef = useRef(false);

  winnerRef.current = winner;
  onCompleteRef.current = onComplete;
  mutedRef.current = muted;

  // Card geometry is fixed at mount so the reel never jumps mid-spin.
  const [geometry] = useState(() => {
    const small = typeof window !== 'undefined' && window.innerWidth < 640;
    return small
      ? { step: 132, cardW: 116, cardH: 150, avatar: 72, font: 13, frameW: 128, frameH: 164 }
      : { step: 208, cardW: 184, cardH: 228, avatar: 120, font: 17, frameW: 200, frameH: 244 };
  });

  // The reel cycles through a shuffled, de-duplicated sample of entrants.
  const reelPeople = useMemo(() => {
    const unique = new Map<string, RevealPerson>();
    candidates.forEach((person) => {
      if (person?.id && !unique.has(person.id)) unique.set(person.id, person);
    });
    let people = shuffle(Array.from(unique.values())).slice(0, MAX_REEL_PEOPLE);
    if (people.length === 0 && winner) people = [winner];
    if (people.length === 0) people = [{ id: '?', name: '?' }];
    return people;
    // Sample once per reveal; later prop changes shouldn't reshuffle a spinning reel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const playTick = useCallback((pitch: number) => {
    if (mutedRef.current) return;
    const ctx = getAudioCtx();
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitch, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.06);
  }, [getAudioCtx]);

  const playFanfare = useCallback(() => {
    if (mutedRef.current) return;
    try {
      const audio = new Audio('/sounds/winning_slot.wav');
      audio.volume = 0.8;
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
    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    setReducedMotion(!!motionQuery?.matches);

    const measure = () => setViewportWidth(reelRef.current?.clientWidth || window.innerWidth);
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

  // Re-measure once the portal has rendered the reel.
  useEffect(() => {
    if (mounted && reelRef.current) setViewportWidth(reelRef.current.clientWidth);
  }, [mounted]);

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

  /* ----- reel animation ----- */

  useEffect(() => {
    if (!mounted) return;
    const { step } = geometry;
    const vMax = CARDS_PER_SECOND * step;
    const minSpin = reducedMotion ? 600 : MIN_SPIN_MS;
    const landingMs = reducedMotion ? 1500 : LANDING_MS;
    const halfVisible = Math.ceil(viewportWidth / 2 / step) + 1;

    let pos = 0;
    let velocity = 0;
    let lastIndex = 0;
    let lastTickAt = 0;
    let landing: { from: number; distance: number; start: number } | null = null;
    let frame = 0;
    const start = performance.now();
    let last = start;

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (!landing) {
        const elapsed = now - start;
        velocity = vMax * easeInQuad(Math.min(1, elapsed / SPIN_UP_MS));
        pos += velocity * dt;

        if (winnerRef.current && elapsed >= minSpin) {
          const naturalDistance = (velocity * (landingMs / 1000)) / 4;
          let target = Math.round((pos + naturalDistance) / step);
          // The winner card must be placed off-screen so the swap is never visible.
          const minTarget = Math.ceil(pos / step) + halfVisible + 4;
          if (target < minTarget) target = minTarget;
          landing = { from: pos, distance: target * step - pos, start: now };
          setTargetIndex(target);
          setPhase('landing');
        }
      } else {
        const t = Math.min(1, (now - landing.start) / landingMs);
        pos = landing.from + landing.distance * easeOutQuart(t);
        if (t >= 1) {
          setOffset(pos);
          setPhase('landed');
          return;
        }
      }

      const index = Math.round(pos / step);
      if (index !== lastIndex) {
        lastIndex = index;
        if (now - lastTickAt > 45) {
          lastTickAt = now;
          playTick(landing ? 1500 : 1800);
        }
      }

      setOffset(pos);
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
    // The loop reads the winner through a ref; restarting it would reset the reel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, reducedMotion]);

  // Landed: celebrate on the reel briefly, then go to the full reveal.
  useEffect(() => {
    if (phase !== 'landed') return;
    playFanfare();
    const timer = window.setTimeout(() => setPhase('revealed'), reducedMotion ? 400 : LANDED_HOLD_MS);
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

  // Warm the cache for the winner's photo before it reaches the frame.
  useEffect(() => {
    if (winner?.profilePictureUrl) {
      const img = new Image();
      img.src = winner.profilePictureUrl;
    }
  }, [winner?.profilePictureUrl]);

  /* ----- render ----- */

  const personAt = (i: number): RevealPerson => {
    const n = reelPeople.length;
    const w = winnerRef.current;
    if (targetIndex !== null && w) {
      if (i === targetIndex) return w;
      const p = reelPeople[mod(i, n)];
      // Don't show the winner right beside the stopping card; it reads as a mistake.
      if (n > 1 && p.id === w.id && Math.abs(i - targetIndex) <= 3) return reelPeople[mod(i + 1, n)];
      return p;
    }
    return reelPeople[mod(i, n)];
  };

  const { step } = geometry;
  const centerIndex = Math.round(offset / step);
  const halfVisible = Math.ceil(viewportWidth / 2 / step) + 1;
  const cards: Array<{ i: number; x: number; person: RevealPerson }> = [];
  for (let i = centerIndex - halfVisible; i <= centerIndex + halfVisible; i++) {
    cards.push({ i, x: i * step - offset, person: personAt(i) });
  }

  const showReveal = phase === 'revealed' && !!winner;
  const isLanded = phase === 'landed' || phase === 'revealed';

  const statusText =
    phase === 'spinning' ? 'Drawing a winner' : phase === 'landing' ? 'And the winner is' : '';

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
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/60 sm:text-sm">
          <Trophy className="h-4 w-4 text-[#f7c948]" />
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
        /* ---------- Draw: prize + reel ---------- */
        <div className="relative z-[3] flex flex-1 flex-col items-center justify-center gap-8 pb-10 sm:gap-12">
          <div className="flex flex-col items-center gap-4 px-4 text-center">
            {prize.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={prize.imageUrl}
                alt=""
                className="h-20 w-20 rounded-2xl bg-white object-contain p-1.5 shadow-xl sm:h-28 sm:w-28"
              />
            )}
            <div>
              {prize.tierName && (
                <span
                  className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold"
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: prize.tierColor || '#f7c948' }} />
                  {prize.tierName}
                </span>
              )}
              <h2 className="text-3xl font-extrabold leading-tight sm:text-5xl">{prize.name}</h2>
              <p className="mt-2 text-sm text-white/60 sm:text-base">
                {entrantCount} {entrantCount === 1 ? 'entrant' : 'entrants'}
              </p>
            </div>
          </div>

          <div
            ref={reelRef}
            className={styles.reel}
            style={{ height: geometry.frameH + 140 }}
            aria-hidden
          >
            {cards.map(({ i, x, person }) => {
              const isWinnerCard = isLanded && i === targetIndex;
              return (
                <div
                  key={i}
                  className={`${styles.card} ${isWinnerCard ? styles.cardWinner : ''}`}
                  style={{
                    width: geometry.cardW,
                    height: geometry.cardH,
                    transform: `translate(calc(-50% + ${x}px), -50%)`,
                    opacity: isLanded && !isWinnerCard ? 0.35 : 1,
                    transition: 'opacity 400ms ease',
                  }}
                >
                  <PersonAvatar person={person} size={geometry.avatar} className="ring-2 ring-white/20" />
                  <span className={styles.cardName} style={{ fontSize: geometry.font }}>
                    {person.name}
                  </span>
                </div>
              );
            })}
            <div className={styles.frame} style={{ width: geometry.frameW, height: geometry.frameH }}>
              <span className={styles.pointerTop} />
              <span className={styles.pointerBottom} />
            </div>
          </div>

          <p className="h-8 text-lg font-semibold text-white/80 sm:text-2xl" aria-live="polite">
            {statusText && <span className={styles.dots}>{statusText}</span>}
            {phase === 'landed' && winner && <span className="text-[#ffe08a]">{winner.name}!</span>}
          </p>
        </div>
      ) : (
        /* ---------- Reveal ---------- */
        <div className="relative z-[3] flex flex-1 flex-col items-center justify-center px-4 pb-8 text-center">
          <div className={styles.rays} />
          <div className="relative flex flex-col items-center">
            <div className={styles.portraitRing}>
              <PersonAvatar
                person={winner!}
                size={typeof window !== 'undefined' && window.innerWidth < 640 ? 150 : 220}
                className="ring-4 ring-[#0b0f1f]"
              />
            </div>

            <p className={`${styles.riseIn} mt-6 text-sm font-semibold uppercase tracking-[0.3em] text-[#f7c948] sm:text-base`} style={{ animationDelay: '250ms' }}>
              Congratulations
            </p>
            <h2 className={`${styles.riseIn} ${styles.winnerName} mt-2 max-w-[18ch]`} style={{ animationDelay: '350ms' }} aria-live="assertive">
              {winner!.name}
            </h2>
            {winner!.facilityName && (
              <p className={`${styles.riseIn} mt-2 text-base text-white/60 sm:text-xl`} style={{ animationDelay: '450ms' }}>
                {winner!.facilityName}
              </p>
            )}

            <div
              className={`${styles.riseIn} mt-6 flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 py-2.5 pl-2.5 pr-5 backdrop-blur sm:mt-8`}
              style={{ animationDelay: '600ms' }}
            >
              {prize.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={prize.imageUrl} alt="" className="h-12 w-12 rounded-xl bg-white object-contain p-1 sm:h-14 sm:w-14" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f7c948]/20 sm:h-14 sm:w-14">
                  <Trophy className="h-6 w-6 text-[#f7c948]" />
                </div>
              )}
              <div className="text-left">
                <p className="text-xs uppercase tracking-wider text-white/60">Wins</p>
                <p className="text-lg font-bold leading-tight sm:text-2xl">{prize.name}</p>
              </div>
            </div>

            <div className={`${styles.riseIn} mt-8 flex flex-col items-center gap-3`} style={{ animationDelay: '800ms' }}>
              <button
                type="button"
                onClick={complete}
                className="relative overflow-hidden rounded-full bg-[#f7c948] px-8 py-3 text-base font-bold text-[#0b0f1f] shadow-lg transition hover:bg-[#ffe08a] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/60"
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
                <p className="text-sm text-white/60">
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
