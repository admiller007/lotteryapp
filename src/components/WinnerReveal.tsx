"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trophy, Volume2, VolumeX, X } from 'lucide-react';
import styles from './WinnerReveal.module.css';
import { WheelDraw } from './PrizeWheel';
import SlotMachineDraw from './SlotMachineDraw';
import { PersonAvatar, useDrawAudio, type DrawStyle, type RevealPerson, type RevealPrize } from './drawShared';

export { PersonAvatar };
export type { DrawStyle, RevealPerson, RevealPrize };

interface WinnerRevealProps {
  prize: RevealPrize;
  /** People shown on the slot reels / wheel (usually the prize's entrants). */
  candidates: RevealPerson[];
  /** The drawn winner. May arrive after the animation has started. */
  winner?: RevealPerson | null;
  /** Which draw animation to show. */
  drawStyle?: DrawStyle;
  /** Called when the reveal is dismissed, auto-advances, or gives up waiting. */
  onComplete: () => void;
  /** Auto-dismiss this long after the winner is revealed. Omit to wait for a click. */
  autoAdvanceMs?: number;
  /** Give up if no winner has arrived after this long. */
  waitTimeoutMs?: number;
  /** Shown on the reveal, e.g. "3 more winners to announce". */
  remainingCount?: number;
}

type Phase = 'drawing' | 'landed' | 'revealed';

// How long to celebrate on the slot machine / wheel before the full reveal.
const LANDED_HOLD_MS = 2400;
export const MUTE_KEY = 'winnerRevealMuted';

/* ---------------- Confetti ---------------- */

interface Particle {
  x: number; y: number; vx: number; vy: number;
  w: number; h: number; rot: number; vr: number;
  color: string; tilt: number; vt: number;
}

const CONFETTI_COLORS = ['#f7c948', '#ffe08a', '#ff6b6b', '#ffffff', '#5eead4', '#a78bfa', '#60a5fa'];

export function Confetti({ active }: { active: boolean }) {
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
  drawStyle = 'slot',
  onComplete,
  autoAdvanceMs,
  waitTimeoutMs = 15000,
  remainingCount = 0,
}: WinnerRevealProps) {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>('drawing');
  const [landscape, setLandscape] = useState(true);
  const [muted, setMuted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  // Fixed for the life of this reveal, so a settings change can't swap it mid-spin.
  const [style] = useState<DrawStyle>(drawStyle);
  const [initialWinner] = useState(winner);

  const winnerRef = useRef<RevealPerson | null | undefined>(winner);
  const onCompleteRef = useRef(onComplete);
  const completedRef = useRef(false);
  winnerRef.current = winner;
  onCompleteRef.current = onComplete;

  const audio = useDrawAudio(muted);
  const sounds = useMemo(() => ({ tick: audio.tick, clunk: audio.clunk }), [audio.tick, audio.clunk]);
  const entrantCount = useMemo(() => new Set(candidates.map((person) => person.id)).size, [candidates]);

  const complete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onCompleteRef.current();
  }, []);

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
    return () => {
      window.removeEventListener('resize', measure);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    audio.unlock();
    try {
      localStorage.setItem(MUTE_KEY, String(next));
    } catch {
      /* storage unavailable */
    }
  };

  const handleLanded = useCallback(() => {
    setPhase((current) => (current === 'drawing' ? 'landed' : current));
  }, []);

  // Landed: celebrate on the machine, then go to the full reveal.
  useEffect(() => {
    if (phase !== 'landed') return;
    audio.fanfare();
    const timer = window.setTimeout(() => setPhase('revealed'), reducedMotion ? 600 : LANDED_HOLD_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, reducedMotion]);

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

  // Warm the cache for the winner's photo before it lands.
  useEffect(() => {
    if (winner?.profilePictureUrl) {
      const img = new Image();
      img.src = winner.profilePictureUrl;
    }
  }, [winner?.profilePictureUrl]);

  /* ----- render ----- */

  const showReveal = phase === 'revealed' && !!winner;
  const revealPortrait = typeof window !== 'undefined' ? Math.round(Math.max(140, Math.min(window.innerHeight * 0.3, window.innerWidth * 0.42, 440))) : 220;

  const drawProps = {
    prize,
    candidates,
    initialWinner,
    winnerRef,
    entrantCount,
    landscape,
    reducedMotion,
    sounds,
    onLanded: handleLanded,
  };

  const content = (
    <div
      className={`${styles.stage} fixed inset-0 z-[100] flex flex-col overflow-hidden`}
      role="dialog"
      aria-modal="true"
      aria-label={`Winner drawing for ${prize.name}`}
      onPointerDown={audio.unlock}
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
        style === 'wheel' ? <WheelDraw {...drawProps} /> : <SlotMachineDraw {...drawProps} />
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
