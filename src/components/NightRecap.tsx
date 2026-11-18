"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Crown, Gift, Pause, Play, Trophy, Volume2, VolumeX, X, Zap, ZapOff } from 'lucide-react';
import styles from './NightRecap.module.css';
import HoloCard, { HoloSeal } from './HoloCard';
import { Confetti, MUTE_KEY } from './WinnerReveal';
import { PersonAvatar, easeOutCubic, useDrawAudio } from './drawShared';
import { computeRecapStats, type FacilityRow, type RecapStats, type RecapWin } from '@/lib/recapStats';
import type { DirectoryUser, Prize } from '@/lib/types';

const UNDERDOG_KEY = 'recapShowUnderdog';
const DEFAULT_EVENT_NAME = process.env.NEXT_PUBLIC_EVENT_NAME || 'ACCO-LOTTERY';

const TICK_MS = 100;
const MONTAGE_PAGE_MS = 3200;
const CONTROLS_IDLE_MS = 2500;

type SlideId = 'opener' | 'numbers' | 'mostWanted' | 'underdog' | 'facilities' | 'montage' | 'closer';

interface Slide {
  id: SlideId;
  duration: number;
}

interface NightRecapProps {
  prizes: Prize[];
  winners: Record<string, string[]>;
  allUsers: Record<string, DirectoryUser>;
  eventName?: string;
  onClose: () => void;
}

const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);
const fmt = (n: number) => n.toLocaleString();

const readFlag = (key: string, fallback: boolean) => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === 'true';
  } catch {
    return fallback;
  }
};

const writeFlag = (key: string, value: boolean) => {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* storage unavailable */
  }
};

/** Counts from 0 to target once `start` is true. */
function useCountUp(target: number, durationMs: number, delayMs = 0, onStep?: () => void) {
  const [value, setValue] = useState(0);
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;

  useEffect(() => {
    if (target <= 0) {
      setValue(0);
      return;
    }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }
    let frame = 0;
    let last = -1;
    let lastTick = 0;
    const startAt = performance.now() + delayMs;
    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - startAt) / durationMs));
      const next = Math.round(easeOutCubic(t) * target);
      if (next !== last) {
        last = next;
        setValue(next);
        if (t > 0 && now - lastTick > 70) {
          lastTick = now;
          onStepRef.current?.();
        }
      }
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs, delayMs]);

  return value;
}

/* ---------------- Slides ---------------- */

function PrizeImage({ src, alt, className = '', style }: { src?: string; alt: string; className?: string; style?: React.CSSProperties }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-white/10 ${className}`} style={style}>
        <Gift className="h-1/2 w-1/2 text-[#f7c948]" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} style={style} draggable={false} onError={() => setFailed(true)} />;
}

function OpenerSlide({ eventName }: { eventName: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <p className={`${styles.kicker} ${styles.rise}`}>{eventName}</p>
      <h1 className={`${styles.giant} ${styles.pop} mt-[3vh]`} style={{ animationDelay: '200ms' }}>
        That&rsquo;s a wrap!
      </h1>
      <p className={`${styles.sub} ${styles.rise} mt-[4vh]`} style={{ animationDelay: '700ms' }}>
        Our night, recapped
      </p>
    </div>
  );
}

function Stat({ value, label, delay, onStep }: { value: number; label: string; delay: number; onStep: () => void }) {
  const shown = useCountUp(value, 1800, delay, onStep);
  return (
    <div className={`${styles.rise} flex flex-col items-center`} style={{ animationDelay: `${delay}ms` }}>
      <span className={styles.statNumber}>{fmt(shown)}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

function NumbersSlide({ stats, onStep }: { stats: RecapStats; onStep: () => void }) {
  return (
    <div className="flex w-full flex-col items-center text-center">
      <p className={`${styles.kicker} ${styles.rise}`}>The big numbers</p>
      <div className="mt-[6vh] grid w-full max-w-[90rem] grid-cols-1 gap-[5vh] sm:grid-cols-3 sm:gap-[3vw]">
        <Stat value={stats.totalTickets} label={plural(stats.totalTickets, 'ticket') + ' entered'} delay={200} onStep={onStep} />
        <Stat value={stats.participants} label={plural(stats.participants, 'person', 'people') + ' took part'} delay={900} onStep={onStep} />
        <Stat value={stats.prizesGiven} label={plural(stats.prizesGiven, 'prize') + ' given away'} delay={1600} onStep={onStep} />
      </div>
    </div>
  );
}

function MostWantedSlide({ data }: { data: NonNullable<RecapStats['mostWanted']> }) {
  const tickets = useCountUp(data.tickets, 2200, 700);
  return (
    <div className="flex w-full flex-col items-center gap-[4vh] text-center lg:flex-row lg:justify-center lg:gap-[5vw] lg:text-left">
      <div className={`${styles.pop} relative`}>
        <div className={styles.halo} />
        <PrizeImage
          src={data.prize.imageUrl}
          alt={data.prize.name}
          className={`${styles.prizePhoto} relative p-[1.2vmin]`}
          style={{ width: 'min(42vh, 70vw)', height: 'min(42vh, 70vw)' }}
        />
      </div>
      <div className="flex max-w-[40rem] flex-col items-center lg:items-start">
        <p className={`${styles.kicker} ${styles.rise}`} style={{ animationDelay: '200ms' }}>Most wanted</p>
        <h2 className={`${styles.headline} ${styles.rise} mt-[1.5vh]`} style={{ animationDelay: '350ms' }}>
          {data.prize.name}
        </h2>
        <p className={`${styles.sub} ${styles.rise} mt-[3vh]`} style={{ animationDelay: '600ms' }}>
          <span className="font-black text-[#f7c948]" style={{ fontSize: '1.8em' }}>{fmt(tickets)}</span>{' '}
          {plural(data.tickets, 'ticket')} chased this one
        </p>
      </div>
    </div>
  );
}

function UnderdogSlide({ win }: { win: RecapWin }) {
  const size = typeof window !== 'undefined' ? Math.round(Math.max(140, Math.min(window.innerHeight * 0.32, window.innerWidth * 0.45, 420))) : 240;
  return (
    <div className="flex flex-col items-center text-center">
      <p className={`${styles.kicker} ${styles.rise}`}>Underdog win</p>
      <div className={`${styles.pop} relative mt-[3vh]`} style={{ animationDelay: '200ms' }}>
        <div className={styles.halo} />
        <PersonAvatar person={win.winner} size={size} className="relative ring-4 ring-[#f7c948]" />
      </div>
      <h2 className={`${styles.headline} ${styles.rise} mt-[3vh]`} style={{ animationDelay: '500ms' }}>
        {win.winner.name}
      </h2>
      <p className={`${styles.sub} ${styles.rise} mt-[1.5vh]`} style={{ animationDelay: '700ms' }}>
        won <span className="font-bold text-white">{win.prize.name}</span> with just
      </p>
      <p className={`${styles.pop} mt-[1vh] font-black text-[#f7c948]`} style={{ animationDelay: '1300ms', fontSize: 'clamp(2.25rem, 6vw, 7rem)', lineHeight: 1 }}>
        {win.tickets} {plural(win.tickets, 'ticket')}!
      </p>
      <p className={`${styles.rise} mt-[2vh] text-white/55`} style={{ animationDelay: '1800ms', fontSize: 'clamp(0.9rem, 1.4vw, 1.75rem)' }}>
        out of {fmt(win.prizeTickets)} in the pot
      </p>
    </div>
  );
}

const BAR_COLORS = ['#f7c948', '#ff8a7a', '#a78bfa', '#5eead4', '#60a5fa', '#f0abfc'];

function BarRace({ title, rows, unit, delay }: { title: string; rows: FacilityRow[]; unit: (n: number) => string; delay: number }) {
  const [go, setGo] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setGo(true), delay);
    return () => window.clearTimeout(timer);
  }, [delay]);
  const top = rows.slice(0, 6);
  const max = Math.max(1, ...top.map((r) => r.value));
  return (
    <div className={`${styles.rise} ${styles.glass} w-full rounded-[1.5rem] p-[2.5vh]`} style={{ animationDelay: `${delay - 300}ms` }}>
      <p className="mb-[2vh] font-bold uppercase tracking-[0.2em] text-white/75" style={{ fontSize: 'clamp(0.8rem, 1.3vw, 1.5rem)' }}>
        {title}
      </p>
      <ol className="flex flex-col gap-[1.4vh]">
        {top.map((row, i) => (
          <li key={row.facility} className={styles.barTrack}>
            <div
              className={styles.bar}
              style={{
                width: go ? `${Math.max(6, (row.value / max) * 100)}%` : '0%',
                background: `linear-gradient(90deg, ${BAR_COLORS[i % BAR_COLORS.length]}cc, ${BAR_COLORS[i % BAR_COLORS.length]})`,
                transitionDelay: `${i * 120}ms`,
              }}
            />
            <div className={styles.barLabel}>
              <span className="flex min-w-0 items-center gap-2">
                {i === 0 && go && <Crown className={`${styles.pop} h-[1.1em] w-[1.1em] shrink-0 text-white`} style={{ animationDelay: '3000ms' }} />}
                <span className="truncate">{row.facility}</span>
              </span>
              <span className={`shrink-0 tabular-nums transition-opacity duration-700 ${go ? 'opacity-100' : 'opacity-0'}`} style={{ transitionDelay: '2200ms' }}>
                {fmt(row.value)} {unit(row.value)}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function FacilitiesSlide({ stats }: { stats: RecapStats }) {
  return (
    <div className="flex w-full max-w-[110rem] flex-col items-center text-center">
      <p className={`${styles.kicker} ${styles.rise}`}>Facility showdown</p>
      <div className="mt-[4vh] grid w-full grid-cols-1 gap-[3vh] text-left lg:grid-cols-2 lg:gap-[3vw]">
        <BarRace title="Most tickets in" rows={stats.ticketsByFacility} unit={(n) => plural(n, 'ticket')} delay={500} />
        {stats.winsByFacility.length > 0 && (
          <BarRace title="Most wins taken home" rows={stats.winsByFacility} unit={(n) => plural(n, 'win')} delay={1100} />
        )}
      </div>
    </div>
  );
}

function MontageCard({ win, index }: { win: RecapWin; index: number }) {
  return (
    <div className={styles.montageCard} style={{ animationDelay: `${index * 140}ms` }}>
      <HoloCard className="h-full" maxTilt={0}>
        <div className="relative flex h-full flex-col items-center overflow-hidden rounded-[inherit] bg-white p-[1.6vh] text-center text-slate-900">
          <HoloSeal className="absolute right-[0.6vh] top-[0.6vh] hidden origin-top-right scale-[0.7] sm:block" />
          <PersonAvatar person={win.winner} size={Math.round(typeof window !== 'undefined' ? Math.min(window.innerHeight * 0.12, 140) : 96)} className="ring-4 ring-amber-400" />
          <p className="mt-[1.2vh] w-full truncate font-extrabold leading-tight" style={{ fontSize: 'clamp(0.95rem, 1.5vw, 1.9rem)' }}>
            {win.winner.name}
          </p>
          {win.winner.facilityName && (
            <p className="w-full truncate text-slate-500" style={{ fontSize: 'clamp(0.75rem, 1vw, 1.25rem)' }}>
              {win.winner.facilityName}
            </p>
          )}
          <div className="mt-auto flex w-full items-center gap-[0.6em] rounded-xl bg-slate-100 p-[0.5em] pt-[0.5em]" style={{ fontSize: 'clamp(0.75rem, 1vw, 1.3rem)', marginTop: '1.2vh' }}>
            <PrizeImage src={win.prize.imageUrl} alt="" className="h-[2.6em] w-[2.6em] shrink-0 rounded-lg bg-white object-contain p-[0.15em]" />
            <span className="min-w-0 text-left font-semibold leading-tight line-clamp-2">{win.prize.name}</span>
          </div>
        </div>
      </HoloCard>
    </div>
  );
}

function MontageSlide({ wins, perPage, page }: { wins: RecapWin[]; perPage: number; page: number }) {
  const pages = Math.max(1, Math.ceil(wins.length / perPage));
  const current = Math.min(page, pages - 1);
  const shown = wins.slice(current * perPage, current * perPage + perPage);
  const cols = perPage >= 8 ? 4 : perPage >= 6 ? 3 : 2;
  return (
    <div className="flex w-full max-w-[110rem] flex-col items-center text-center">
      <div className="flex items-baseline gap-4">
        <p className={`${styles.kicker} ${styles.rise}`}>Every winner</p>
        {pages > 1 && (
          <span className="tabular-nums text-white/50" style={{ fontSize: 'clamp(0.8rem, 1.2vw, 1.5rem)' }}>
            {current * perPage + 1}–{current * perPage + shown.length} of {wins.length}
          </span>
        )}
      </div>
      <div key={current} className="mt-[3vh] grid w-full gap-[2vh]" style={{ gridTemplateColumns: `repeat(${Math.min(cols, Math.max(1, shown.length))}, minmax(0, 1fr))` }}>
        {shown.map((win, i) => (
          <MontageCard key={`${win.prize.id}:${win.winner.id}`} win={win} index={i} />
        ))}
      </div>
    </div>
  );
}

function CloserSlide({ eventName, confetti }: { eventName: string; confetti: boolean }) {
  return (
    <div className="flex flex-col items-center text-center">
      <Trophy className={`${styles.pop} text-[#f7c948]`} style={{ width: 'clamp(3rem, 8vw, 8rem)', height: 'clamp(3rem, 8vw, 8rem)' }} />
      <h1 className={`${styles.giant} ${styles.pop} mt-[3vh]`} style={{ animationDelay: '250ms' }}>
        Thanks for playing
      </h1>
      <p className={`${styles.sub} ${styles.rise} mt-[4vh]`} style={{ animationDelay: '800ms' }}>
        {eventName} · Congratulations to all our winners!
      </p>
      {confetti && <Confetti active />}
    </div>
  );
}

/* ---------------- Reel ---------------- */

export default function NightRecap({ prizes, winners, allUsers, eventName = DEFAULT_EVENT_NAME, onClose }: NightRecapProps) {
  const [mounted, setMounted] = useState(false);
  const [index, setIndex] = useState(0);
  const [loop, setLoop] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showUnderdog, setShowUnderdog] = useState(true);
  const [landscape, setLandscape] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const idleTimer = useRef<number | null>(null);

  const audio = useDrawAudio(muted);
  const stats = useMemo(() => computeRecapStats(prizes, winners, allUsers), [prizes, winners, allUsers]);
  const perPage = landscape ? 8 : 4;

  const slides = useMemo<Slide[]>(() => {
    const list: Slide[] = [{ id: 'opener', duration: 5000 }, { id: 'numbers', duration: 6000 }];
    if (stats.mostWanted) list.push({ id: 'mostWanted', duration: 5500 });
    if (showUnderdog && stats.underdog) list.push({ id: 'underdog', duration: 6500 });
    if (stats.ticketsByFacility.length >= 2) list.push({ id: 'facilities', duration: 7000 });
    if (stats.wins.length > 0) {
      list.push({ id: 'montage', duration: Math.max(5000, Math.ceil(stats.wins.length / perPage) * MONTAGE_PAGE_MS) });
    }
    list.push({ id: 'closer', duration: 6500 });
    return list;
  }, [stats, showUnderdog, perPage]);

  const safeIndex = Math.min(index, slides.length - 1);
  const slide = slides[safeIndex];

  const goTo = useCallback(
    (next: number) => {
      setElapsed(0);
      if (next >= slides.length) {
        setIndex(0);
        setLoop((l) => l + 1);
      } else {
        setIndex(Math.max(0, next));
      }
    },
    [slides.length]
  );

  // Slide clock.
  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => setElapsed((e) => e + TICK_MS), TICK_MS);
    return () => window.clearInterval(timer);
  }, [paused, safeIndex, loop]);

  useEffect(() => {
    if (elapsed >= slide.duration) goTo(safeIndex + 1);
  }, [elapsed, slide.duration, safeIndex, goTo]);

  // Fanfare as the closer lands.
  useEffect(() => {
    if (slide.id === 'closer') audio.fanfare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide.id, loop]);

  useEffect(() => {
    setMounted(true);
    setMuted(readFlag(MUTE_KEY, false));
    setShowUnderdog(readFlag(UNDERDOG_KEY, true));
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

  const wakeControls = useCallback(() => {
    setControlsVisible(true);
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setControlsVisible(false), CONTROLS_IDLE_MS);
  }, []);

  useEffect(() => {
    wakeControls();
    return () => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
    };
  }, [wakeControls]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    audio.unlock();
    writeFlag(MUTE_KEY, next);
  };

  const toggleUnderdog = () => {
    const next = !showUnderdog;
    setShowUnderdog(next);
    writeFlag(UNDERDOG_KEY, next);
    if (!next && slide.id === 'underdog') goTo(safeIndex + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      wakeControls();
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === 'PageDown') goTo(safeIndex + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') goTo(safeIndex - 1);
      else if (e.key === ' ') {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key === 'm' || e.key === 'M') toggleMute();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Tap-through: left third goes back, the rest goes forward.
  const handleStageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    audio.unlock();
    if (e.clientX < window.innerWidth / 3) goTo(safeIndex - 1);
    else goTo(safeIndex + 1);
  };

  const stopClick = (e: React.SyntheticEvent) => e.stopPropagation();
  const countTick = useCallback(() => audio.tick(false), [audio]);

  const renderSlide = () => {
    switch (slide.id) {
      case 'opener':
        return <OpenerSlide eventName={eventName} />;
      case 'numbers':
        return <NumbersSlide stats={stats} onStep={countTick} />;
      case 'mostWanted':
        return stats.mostWanted && <MostWantedSlide data={stats.mostWanted} />;
      case 'underdog':
        return stats.underdog && <UnderdogSlide win={stats.underdog} />;
      case 'facilities':
        return <FacilitiesSlide stats={stats} />;
      case 'montage':
        return <MontageSlide wins={stats.wins} perPage={perPage} page={Math.floor(elapsed / MONTAGE_PAGE_MS)} />;
      case 'closer':
        return <CloserSlide eventName={eventName} confetti={!reducedMotion} />;
    }
  };

  const iconButton =
    'rounded-full bg-white/10 p-2.5 text-white/80 transition hover:bg-white/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7c948]';

  const content = (
    <div
      className={`${styles.stage} fixed inset-0 z-[110] flex flex-col overflow-hidden`}
      role="dialog"
      aria-modal="true"
      aria-label="Our night, recapped"
      onPointerDown={audio.unlock}
      onPointerMove={wakeControls}
      onClick={handleStageClick}
      style={{ cursor: controlsVisible ? 'pointer' : 'none' }}
    >
      <div className={styles.sky} aria-hidden />
      <div className={styles.grain} aria-hidden />

      {/* Progress + controls */}
      <div className="relative z-[3] px-4 pt-4 sm:px-6 sm:pt-5">
        <div className="flex gap-1.5" aria-hidden>
          {slides.map((s, i) => (
            <div key={s.id} className={styles.segment}>
              <div
                className={styles.segmentFill}
                style={{
                  transform: `scaleX(${i < safeIndex ? 1 : i > safeIndex ? 0 : Math.min(1, elapsed / s.duration)})`,
                  transition: i === safeIndex && elapsed > 0 ? `transform ${TICK_MS}ms linear` : 'none',
                }}
              />
            </div>
          ))}
        </div>
        <div
          className={`${styles.controls} ${controlsVisible || paused ? '' : styles.controlsHidden} mt-3 flex items-center justify-end gap-2`}
          onClick={stopClick}
          onPointerDown={stopClick}
        >
          {stats.underdog && (
            <button
              type="button"
              onClick={toggleUnderdog}
              className={`${iconButton} flex items-center gap-2 px-3.5 text-sm`}
              title={showUnderdog ? 'Hide the underdog slide' : 'Show the underdog slide'}
              aria-pressed={showUnderdog}
            >
              {showUnderdog ? <Zap className="h-4 w-4" /> : <ZapOff className="h-4 w-4" />}
              Underdog {showUnderdog ? 'on' : 'off'}
            </button>
          )}
          <button type="button" onClick={() => setPaused((p) => !p)} className={iconButton} aria-label={paused ? 'Play' : 'Pause'} title={paused ? 'Play (Space)' : 'Pause (Space)'}>
            {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
          </button>
          <button type="button" onClick={toggleMute} className={iconButton} aria-label={muted ? 'Turn sound on' : 'Turn sound off'} title={muted ? 'Turn sound on (M)' : 'Turn sound off (M)'}>
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          <button type="button" onClick={onClose} className={iconButton} aria-label="Close recap" title="Close (Esc)">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div key={`${loop}-${safeIndex}-${slide.id}`} className={`${styles.slide} relative z-[3] flex flex-1 items-center justify-center overflow-hidden px-[4vw] pb-[6vh]`}>
        {renderSlide()}
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
}
