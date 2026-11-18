"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Gift, Pause, Play, Volume2, VolumeX, X } from 'lucide-react';
import styles from './NightRecap.module.css';
import HoloCard from './HoloCard';
import { Confetti, MUTE_KEY } from './WinnerReveal';
import { PersonAvatar, easeOutCubic, useDrawAudio } from './drawShared';
import { computeRecapStats, type FacilityRow, type RecapStats, type RecapWin } from '@/lib/recapStats';
import type { DirectoryUser, Prize } from '@/lib/types';

/* "Our Night, Recapped": a looping full-screen reel for the projector. */

const TICK_MS = 100;
const PAGE_MS = 5000;
const IDLE_MS = 2500;

type SlideId = 'opener' | 'numbers' | 'mostWanted' | 'underdog' | 'facilities' | 'winners' | 'closer';

interface NightRecapProps {
  prizes: Prize[];
  winners: Record<string, string[]>;
  allUsers: Record<string, DirectoryUser>;
  onClose: () => void;
}

const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);
const fmt = (n: number) => n.toLocaleString();

function useCountUp(target: number, delayMs = 0) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }
    let frame = 0;
    const start = performance.now() + delayMs;
    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / 1800));
      setValue(Math.round(easeOutCubic(t) * target));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, delayMs]);
  return value;
}

function PrizeImage({ src, className }: { src?: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-white/10 ${className}`}>
        <Gift className="h-1/2 w-1/2 text-[#f7c948]" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className={className} draggable={false} onError={() => setFailed(true)} />;
}

/* ---------------- Slides ---------------- */

function Stat({ value, label, delay }: { value: number; label: string; delay: number }) {
  const shown = useCountUp(value, delay);
  return (
    <div className={`${styles.rise} flex flex-col items-center`} style={{ animationDelay: `${delay}ms` }}>
      <span className={styles.number}>{fmt(shown)}</span>
      <span className={styles.label}>{label}</span>
    </div>
  );
}

function Numbers({ stats }: { stats: RecapStats }) {
  return (
    <div className="grid w-full max-w-[90rem] grid-cols-1 gap-[6vh] sm:grid-cols-3 sm:gap-[3vw]">
      <Stat value={stats.totalTickets} label={plural(stats.totalTickets, 'ticket')} delay={0} />
      <Stat value={stats.participants} label={plural(stats.participants, 'person', 'people')} delay={600} />
      <Stat value={stats.prizesGiven} label={plural(stats.prizesGiven, 'prize')} delay={1200} />
    </div>
  );
}

function MostWanted({ data }: { data: NonNullable<RecapStats['mostWanted']> }) {
  const tickets = useCountUp(data.tickets, 500);
  return (
    <div className="flex flex-col items-center text-center">
      <p className={styles.title}>Most wanted</p>
      <PrizeImage src={data.prize.imageUrl} className={`${styles.pop} ${styles.photo} mt-[4vh] aspect-square w-[min(38vh,70vw)] p-[1vmin]`} />
      <h2 className={`${styles.rise} ${styles.headline} mt-[4vh]`}>{data.prize.name}</h2>
      <p className={`${styles.rise} ${styles.sub} mt-[1.5vh]`}>
        {fmt(tickets)} {plural(data.tickets, 'ticket')}
      </p>
    </div>
  );
}

function Underdog({ win }: { win: RecapWin }) {
  return (
    <div className="flex flex-col items-center text-center">
      <p className={styles.title}>Underdog</p>
      <PersonAvatar person={win.winner} size={280} className={`${styles.pop} mt-[4vh] h-[32vh] w-[32vh] ring-4 ring-[#f7c948]`} style={{ width: undefined, height: undefined }} />
      <h2 className={`${styles.rise} ${styles.headline} mt-[4vh]`}>{win.winner.name}</h2>
      <p className={`${styles.rise} ${styles.sub} mt-[1.5vh]`}>
        won {win.prize.name} with <span className="font-bold text-[#f7c948]">{win.tickets} {plural(win.tickets, 'ticket')}</span>
      </p>
    </div>
  );
}

function Bars({ title, rows }: { title: string; rows: FacilityRow[] }) {
  const [go, setGo] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setGo(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const top = rows.slice(0, 6);
  const max = Math.max(1, ...top.map((r) => r.value));
  return (
    <div className="w-full">
      <p className={styles.title}>{title}</p>
      <ol className="mt-[3vh] flex flex-col gap-[1.5vh]">
        {top.map((row, i) => (
          <li key={row.facility} className={styles.track}>
            <div
              className={`${styles.bar} ${i === 0 ? styles.barLead : ''}`}
              style={{ width: go ? `${Math.max(8, (row.value / max) * 100)}%` : '0%', transitionDelay: `${i * 120}ms` }}
            />
            <span className={styles.barLabel}>
              <span className="truncate">{row.facility}</span>
              <span className="tabular-nums">{fmt(row.value)}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Facilities({ stats }: { stats: RecapStats }) {
  return (
    <div className="grid w-full max-w-[100rem] grid-cols-1 gap-[5vh] lg:grid-cols-2 lg:gap-[4vw]">
      <Bars title="Tickets" rows={stats.ticketsByFacility} />
      <Bars title="Wins" rows={stats.winsByFacility} />
    </div>
  );
}

function Winners({ wins, perPage, page }: { wins: RecapWin[]; perPage: number; page: number }) {
  const pages = Math.ceil(wins.length / perPage);
  const current = Math.min(page, pages - 1);
  const shown = wins.slice(current * perPage, (current + 1) * perPage);
  return (
    <div
      key={current}
      className="grid w-full max-w-[100rem] gap-[2vh]"
      style={{ gridTemplateColumns: `repeat(${Math.min(perPage / 2, shown.length)}, minmax(0, 1fr))` }}
    >
      {shown.map((win, i) => (
        <div key={`${win.prize.id}:${win.winner.id}`} className={styles.card} style={{ animationDelay: `${i * 120}ms` }}>
          <HoloCard className="h-full" maxTilt={0}>
            <div className="flex h-full flex-col items-center gap-[1.2vh] rounded-[inherit] bg-white p-[2vh] text-center text-slate-900">
              <PersonAvatar person={win.winner} size={120} className="h-[11vh] w-[11vh] ring-4 ring-amber-400" style={{ width: undefined, height: undefined }} />
              <p className="w-full truncate font-extrabold" style={{ fontSize: 'clamp(1rem, 1.5vw, 1.9rem)' }}>{win.winner.name}</p>
              <p className="w-full truncate text-slate-500" style={{ fontSize: 'clamp(0.85rem, 1.1vw, 1.4rem)' }}>{win.prize.name}</p>
            </div>
          </HoloCard>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Reel ---------------- */

export default function NightRecap({ prizes, winners, allUsers, onClose }: NightRecapProps) {
  const [mounted, setMounted] = useState(false);
  const [index, setIndex] = useState(0);
  const [loop, setLoop] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [landscape, setLandscape] = useState(true);
  const [idle, setIdle] = useState(false);
  const idleTimer = useRef<number>();

  const audio = useDrawAudio(muted);
  const stats = useMemo(() => computeRecapStats(prizes, winners, allUsers), [prizes, winners, allUsers]);
  const perPage = landscape ? 8 : 4;

  // Slides with nothing to show are left out.
  const slides = useMemo(() => {
    const list: { id: SlideId; ms: number }[] = [
      { id: 'opener', ms: 4000 },
      { id: 'numbers', ms: 6000 },
    ];
    if (stats.mostWanted) list.push({ id: 'mostWanted', ms: 5500 });
    if (stats.underdog) list.push({ id: 'underdog', ms: 6000 });
    if (stats.ticketsByFacility.length >= 2 && stats.winsByFacility.length) list.push({ id: 'facilities', ms: 6500 });
    if (stats.wins.length) list.push({ id: 'winners', ms: Math.ceil(stats.wins.length / perPage) * PAGE_MS });
    list.push({ id: 'closer', ms: 6000 });
    return list;
  }, [stats, perPage]);

  const current = Math.min(index, slides.length - 1);
  const slide = slides[current];

  const goTo = useCallback(
    (next: number) => {
      setElapsed(0);
      if (next >= slides.length) setLoop((l) => l + 1);
      setIndex(next >= slides.length ? 0 : Math.max(0, next));
    },
    [slides.length]
  );

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => setElapsed((e) => e + TICK_MS), TICK_MS);
    return () => window.clearInterval(timer);
  }, [paused]);

  useEffect(() => {
    if (elapsed >= slide.ms) goTo(current + 1);
  }, [elapsed, slide.ms, current, goTo]);

  useEffect(() => {
    if (slide.id === 'closer') audio.fanfare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide.id, loop]);

  const wake = useCallback(() => {
    setIdle(false);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), IDLE_MS);
  }, []);

  useEffect(() => {
    setMounted(true);
    try {
      setMuted(localStorage.getItem(MUTE_KEY) === 'true');
    } catch {
      /* storage unavailable */
    }
    const measure = () => setLandscape(window.innerWidth / window.innerHeight > 1.15);
    measure();
    wake();
    window.addEventListener('resize', measure);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('resize', measure);
      window.clearTimeout(idleTimer.current);
      document.body.style.overflow = overflow;
    };
  }, [wake]);

  const toggleMute = () => {
    setMuted(!muted);
    audio.unlock();
    try {
      localStorage.setItem(MUTE_KEY, String(!muted));
    } catch {
      /* storage unavailable */
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      wake();
      const actions: Record<string, () => void> = {
        Escape: onClose,
        ArrowRight: () => goTo(current + 1),
        ArrowLeft: () => goTo(current - 1),
        ' ': () => setPaused((p) => !p),
        m: toggleMute,
      };
      const action = actions[e.key];
      if (!action) return;
      e.preventDefault();
      action();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const content = (
    <div
      className={`${styles.stage} fixed inset-0 z-[110] flex flex-col overflow-hidden`}
      role="dialog"
      aria-modal="true"
      aria-label="Night recap"
      onPointerDown={audio.unlock}
      onPointerMove={wake}
      onClick={(e) => goTo(current + (e.clientX < window.innerWidth / 3 ? -1 : 1))}
      style={{ cursor: idle ? 'none' : 'pointer' }}
    >
      <div className={styles.sky} aria-hidden />
      <div className={styles.grain} aria-hidden />

      <div className="relative z-[3] px-4 pt-4 sm:px-6 sm:pt-5">
        <div className="flex gap-1.5" aria-hidden>
          {slides.map((s, i) => (
            <div key={s.id} className={styles.segment}>
              <div
                className={styles.segmentFill}
                style={{
                  transform: `scaleX(${i < current ? 1 : i > current ? 0 : Math.min(1, elapsed / s.ms)})`,
                  transition: i === current && elapsed > 0 ? `transform ${TICK_MS}ms linear` : 'none',
                }}
              />
            </div>
          ))}
        </div>
        <div
          className={`${styles.controls} ${idle && !paused ? styles.hidden : ''} mt-3 flex justify-end gap-2`}
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" onClick={() => setPaused(!paused)} className={styles.icon} aria-label={paused ? 'Play' : 'Pause'}>
            {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
          </button>
          <button type="button" onClick={toggleMute} className={styles.icon} aria-label={muted ? 'Unmute' : 'Mute'}>
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          <button type="button" onClick={onClose} className={styles.icon} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div key={`${loop}-${current}`} className={`${styles.slide} relative z-[3] flex flex-1 items-center justify-center px-[4vw] pb-[8vh]`}>
        {slide.id === 'opener' && <h1 className={styles.giant}>That&rsquo;s a wrap!</h1>}
        {slide.id === 'numbers' && <Numbers stats={stats} />}
        {slide.id === 'mostWanted' && stats.mostWanted && <MostWanted data={stats.mostWanted} />}
        {slide.id === 'underdog' && stats.underdog && <Underdog win={stats.underdog} />}
        {slide.id === 'facilities' && <Facilities stats={stats} />}
        {slide.id === 'winners' && <Winners wins={stats.wins} perPage={perPage} page={Math.floor(elapsed / PAGE_MS)} />}
        {slide.id === 'closer' && (
          <>
            <h1 className={styles.giant}>Thanks for playing</h1>
            <Confetti active />
          </>
        )}
      </div>
    </div>
  );

  return mounted ? createPortal(content, document.body) : null;
}
