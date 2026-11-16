"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import styles from './SlotMachineDraw.module.css';
import { SLOT_SYMBOLS, SlotSymbol, SlotSymbolDefs, type SlotSymbolName } from './SlotSymbols';
import {
  PersonAvatar,
  easeInQuad,
  easeOutCubic,
  mod,
  shuffle,
  uniquePeople,
  type DrawAnimationProps,
  type RevealPerson,
} from './drawShared';

/*
 * Three-reel slot machine. Reel strips alternate classic symbols with
 * entrants; all three reels stop, one after another, on the winner for a
 * jackpot. Reel positions are in "cells": cell k sits on the payline when the
 * reel's position is k, and cells fall downward as the position increases.
 */

const CRUISE = 15; // cells per second at full speed
const LEVER_MS = 520; // reels start as the lever reaches the bottom
const REEL_STAGGER_MS = 140;
const KICK_MS = 140; // reels jerk up slightly before they fall
const SPIN_UP_MS = 450;
const MIN_SPIN_MS = 2600;
// When each reel starts to slow, and over how long, once the winner is known.
// The third reel takes its time for suspense.
const STOP_PLAN = [
  { delay: 0, duration: 1500 },
  { delay: 650, duration: 1900 },
  { delay: 1500, duration: 4400 },
];
const OVERSHOOT = 0.14; // reels slam a little past the line, then settle back
const SETTLE_MS = 280;
const MAX_REEL_PEOPLE = 30;
const ANGLE_PER_CELL = 0.9; // radians; gives the reels their curved-drum look

type ReelPhase = 'waiting' | 'spinning' | 'slowing' | 'settling' | 'stopped';

interface ReelState {
  phase: ReelPhase;
  pos: number;
  vel: number;
  startedAt: number;
  slowAt: number | null;
  slow: { from: number; distance: number; start: number; duration: number } | null;
  settleAt: number;
  target: number | null;
  lastCell: number;
}

type Cell = { kind: 'symbol'; symbol: SlotSymbolName } | { kind: 'person'; person: RevealPerson };

const useCellSize = (landscape: boolean) => {
  const compute = () => {
    if (typeof window === 'undefined') return 200;
    const w = window.innerWidth;
    const h = window.innerHeight;
    return landscape ? Math.min((h - 120) / 4.5, w * 0.165) : Math.min((w * 0.9) / 4.15, (h - 160) / 5.2);
  };
  const [cell, setCell] = useState(compute);
  useEffect(() => {
    const onResize = () => setCell(compute());
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landscape]);
  return Math.max(60, Math.round(cell));
};

export default function SlotMachineDraw({
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
  const gid = useId().replace(/:/g, '');
  const c = useCellSize(landscape);

  const [view, setView] = useState({ pos: [0, 0, 0], vel: [0, 0, 0] });
  const [targets, setTargets] = useState<Array<number | null>>([null, null, null]);
  const [stopped, setStopped] = useState([false, false, false]);
  const [landed, setLanded] = useState(false);

  const onLandedRef = useRef(onLanded);
  const soundsRef = useRef(sounds);
  onLandedRef.current = onLanded;
  soundsRef.current = sounds;

  // Each reel gets its own shuffle of people and symbols.
  const strips = useMemo(() => {
    let people = shuffle(uniquePeople(candidates)).slice(0, MAX_REEL_PEOPLE);
    if (people.length === 0) people = [initialWinner ?? { id: '?', name: '?' }];
    return [0, 1, 2].map(() => ({ people: shuffle(people), symbols: shuffle([...SLOT_SYMBOLS]) }));
    // Sample once; later prop changes shouldn't reshuffle spinning reels.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cellAt = (reel: number, i: number): Cell => {
    const strip = strips[reel];
    if (mod(i, 2) === 0) return { kind: 'symbol', symbol: strip.symbols[mod(i / 2, strip.symbols.length)] };
    const n = strip.people.length;
    const slot = mod((i - 1) / 2, n);
    const target = targets[reel];
    const w = winnerRef.current;
    if (target !== null && w) {
      if (i === target) return { kind: 'person', person: w };
      const p = strip.people[slot];
      // Keep the winner's face away from the payline on the neighbouring cells.
      if (n > 1 && p.id === w.id && Math.abs(i - target) <= 6) return { kind: 'person', person: strip.people[mod(slot + 1, n)] };
      return { kind: 'person', person: p };
    }
    return { kind: 'person', person: strip.people[slot] };
  };

  /* ----- animation ----- */

  useEffect(() => {
    const speed = reducedMotion ? 0.45 : 1;
    const minSpin = reducedMotion ? 900 : MIN_SPIN_MS;
    const reels: ReelState[] = [0, 1, 2].map(() => ({
      phase: 'waiting',
      pos: 0,
      vel: 0,
      startedAt: 0,
      slowAt: null,
      slow: null,
      settleAt: 0,
      target: null,
      lastCell: 0,
    }));
    let planned = false;
    let frame = 0;
    const start = performance.now();
    let last = start;

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const elapsed = now - start;

      // Once the winner is known and the reels are at full speed, schedule the stops.
      const w = winnerRef.current;
      if (!planned && w && elapsed >= minSpin && reels.every((r) => r.phase === 'spinning' && r.vel >= CRUISE * 0.99)) {
        planned = true;
        reels.forEach((r, i) => {
          r.slowAt = now + STOP_PLAN[i].delay * speed;
        });
      }

      reels.forEach((r, i) => {
        if (r.phase === 'waiting' && elapsed >= LEVER_MS + i * REEL_STAGGER_MS) {
          r.phase = 'spinning';
          r.startedAt = now;
        }

        if (r.phase === 'spinning') {
          const t = now - r.startedAt;
          if (t < KICK_MS) {
            r.pos = -0.18 * Math.sin((Math.PI / 2) * (t / KICK_MS));
            r.vel = 0;
          } else {
            r.vel = CRUISE * easeInQuad(Math.min(1, (t - KICK_MS) / SPIN_UP_MS));
            r.pos += r.vel * dt;
          }

          if (r.slowAt !== null && now >= r.slowAt) {
            // Pick the person cell (odd index) that a matched slow-down reaches naturally.
            const duration = STOP_PLAN[i].duration * speed;
            const natural = (r.vel * (duration / 1000)) / 3; // cubic ease-out starts at 3x average speed
            let target = Math.round(r.pos + natural);
            if (mod(target, 2) === 0) target += 1;
            while (target - r.pos < 5) target += 2;
            const distance = target + OVERSHOOT - r.pos;
            r.target = target;
            r.slow = { from: r.pos, distance, start: now, duration: ((3 * distance) / r.vel) * 1000 };
            r.phase = 'slowing';
            setTargets((prev) => prev.map((value, j) => (j === i ? target : value)));
          }
        } else if (r.phase === 'slowing' && r.slow) {
          const t = Math.min(1, (now - r.slow.start) / r.slow.duration);
          r.pos = r.slow.from + r.slow.distance * easeOutCubic(t);
          r.vel = (3 * r.slow.distance * Math.pow(1 - t, 2)) / (r.slow.duration / 1000);
          if (t >= 1) {
            r.phase = 'settling';
            r.settleAt = now;
            r.vel = 0;
            soundsRef.current.clunk();
          }
        } else if (r.phase === 'settling' && r.target !== null) {
          const t = Math.min(1, (now - r.settleAt) / SETTLE_MS);
          r.pos = r.target + OVERSHOOT * (1 - easeOutCubic(t));
          if (t >= 1) {
            r.pos = r.target;
            r.phase = 'stopped';
            setStopped((prev) => prev.map((value, j) => (j === i ? true : value)));
          }
        }

        // The last reel ticks as it crawls toward the line.
        const cell = Math.round(r.pos);
        if (cell !== r.lastCell) {
          r.lastCell = cell;
          if (i === 2 && r.phase === 'slowing' && r.vel < 9) soundsRef.current.tick(true);
        }
      });

      setView({ pos: reels.map((r) => r.pos), vel: reels.map((r) => r.vel) });

      if (reels.every((r) => r.phase === 'stopped')) {
        setLanded(true);
        onLandedRef.current();
        return;
      }
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
    // The loop reads the winner through a ref; restarting it would reset the reels.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  /* ----- layout ----- */

  const reelW = c * (landscape ? 1.22 : 1.1);
  const gap = c * 0.08;
  const bezelPad = c * 0.1;
  const bodyPad = c * 0.18;
  const bezelW = 3 * reelW + 2 * gap + 2 * bezelPad;
  const bodyW = bezelW + 2 * bodyPad;
  const marqueeH = c * 0.98;
  const anticipating = stopped[0] && stopped[1] && !stopped[2];
  const lightsMode = landed ? 'win' : anticipating ? 'fast' : 'spin';

  const bulbs = useMemo(() => {
    const spacing = c * 0.19;
    const inset = c * 0.075;
    const w = bodyW;
    const h = marqueeH;
    const list: Array<{ x: number; y: number }> = [];
    const across = Math.max(2, Math.round((w - 2 * inset) / spacing));
    for (let i = 0; i <= across; i++) {
      const x = inset + ((w - 2 * inset) * i) / across;
      list.push({ x, y: inset }, { x, y: h - inset });
    }
    const down = Math.max(1, Math.round((h - 2 * inset) / spacing));
    for (let i = 1; i < down; i++) {
      const y = inset + ((h - 2 * inset) * i) / down;
      list.push({ x: inset, y }, { x: w - inset, y });
    }
    return list;
  }, [c, bodyW, marqueeH]);

  const renderCell = (reel: number, i: number) => {
    const cell = cellAt(reel, i);
    if (cell.kind === 'symbol') return <SlotSymbol name={cell.symbol} id={gid} size={c * 0.72} />;
    const isWinner = landed && i === targets[reel];
    return (
      <>
        <PersonAvatar
          person={cell.person}
          size={c * 0.6}
          className={isWinner ? styles.winAvatar : ''}
          style={{ boxShadow: isWinner ? undefined : '0 0 0 3px #fff, 0 3px 8px rgba(0,0,0,0.35)' }}
        />
        <span
          className="mt-[0.35em] max-w-[92%] truncate font-bold leading-tight text-[#1f2937]"
          style={{ fontSize: Math.max(11, c * 0.105) }}
        >
          {cell.person.name}
        </span>
      </>
    );
  };

  const renderReel = (reel: number) => {
    const pos = view.pos[reel];
    const vel = view.vel[reel];
    const radius = c / ANGLE_PER_CELL;
    const base = Math.floor(pos);
    const cells: React.ReactNode[] = [];
    for (let i = base - 2; i <= base + 2; i++) {
      const theta = (pos - i) * ANGLE_PER_CELL;
      if (Math.abs(theta) >= 1.45) continue;
      cells.push(
        <div
          key={i}
          className="absolute inset-x-0 top-1/2 flex flex-col items-center justify-center"
          style={{
            height: c,
            transform: `translateY(calc(-50% + ${radius * Math.sin(theta)}px)) scaleY(${Math.cos(theta)})`,
          }}
        >
          {renderCell(reel, i)}
        </div>
      );
    }
    const blur = reducedMotion ? 0 : vel > 11 ? 2 : vel > 5 ? 1 : 0;
    return (
      <div
        key={reel}
        className={`${styles.reelWindow} ${anticipating && reel === 2 ? styles.anticipate : ''} ${landed ? styles.reelWin : ''}`}
        style={{ width: reelW, height: 2 * c, borderRadius: c * 0.08 }}
      >
        <div className="absolute inset-0" style={{ filter: blur ? `url(#${gid}-blur${blur})` : undefined }}>
          {cells}
        </div>
        <div className={styles.reelShade} />
      </div>
    );
  };

  const ledLabel = landed ? '★ JACKPOT ★' : anticipating ? 'ONE MORE…' : null;
  const ledText = landed ? winnerRef.current?.name ?? '' : null;
  const rodH = c * 0.95;

  return (
    <div className="relative z-[3] flex flex-1 flex-col items-center justify-center pb-[3vh]">
      <SlotSymbolDefs id={gid} />
      {/* The margin leaves room for the lever while keeping the machine centred. */}
      <div className="relative" style={{ width: bodyW, marginRight: c * 0.42 }}>
        {/* Marquee sign with chasing bulbs */}
        <div
          className={`${styles.marquee} relative flex items-center justify-center`}
          style={{ height: marqueeH, borderRadius: `${c * 0.3}px ${c * 0.3}px ${c * 0.06}px ${c * 0.06}px`, gap: c * 0.18, padding: `0 ${c * 0.35}px` }}
        >
          <div className={styles.lights} data-mode={reducedMotion ? 'still' : lightsMode} aria-hidden>
            {bulbs.map((b, i) => (
              <span
                key={i}
                className={`${styles.bulb} ${i % 2 === 0 ? styles.bulbA : styles.bulbB}`}
                style={{ left: b.x, top: b.y, width: c * 0.07, height: c * 0.07 }}
              />
            ))}
          </div>
          {prize.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={prize.imageUrl}
              alt=""
              className="relative shrink-0 rounded-[18%] bg-white object-contain shadow-xl"
              style={{ width: c * 0.6, height: c * 0.6, padding: c * 0.04 }}
            />
          )}
          <div className="relative min-w-0 text-left">
            <div className="flex items-center gap-[0.6em] font-semibold uppercase tracking-[0.2em] text-white/75" style={{ fontSize: Math.max(10, c * 0.075) }}>
              {prize.tierName && (
                <>
                  <span className="h-[0.7em] w-[0.7em] rounded-full" style={{ backgroundColor: prize.tierColor || '#f7c948' }} />
                  <span>{prize.tierName}</span>
                  <span className="text-white/40">·</span>
                </>
              )}
              <span>
                {entrantCount} {entrantCount === 1 ? 'entrant' : 'entrants'}
              </span>
            </div>
            <h2 className={`${styles.marqueeTitle} truncate`} style={{ fontSize: Math.max(22, c * 0.25) }}>
              {prize.name}
            </h2>
          </div>
        </div>

        {/* Cabinet */}
        <div className={styles.cabinet} style={{ padding: bodyPad, paddingTop: bodyPad * 0.8, borderRadius: `0 0 ${c * 0.12}px ${c * 0.12}px` }}>
          <div className={`${styles.bezel} relative mx-auto flex`} style={{ width: bezelW, padding: bezelPad, gap, borderRadius: c * 0.12 }}>
            {[0, 1, 2].map(renderReel)}
            <div className={`${styles.payline} ${landed ? styles.paylineWin : ''}`} style={{ left: bezelPad * 0.4, right: bezelPad * 0.4 }} />
            <span className={styles.paylineArrowLeft} style={{ borderWidth: `${c * 0.07}px 0 ${c * 0.07}px ${c * 0.1}px` }} />
            <span className={styles.paylineArrowRight} style={{ borderWidth: `${c * 0.07}px ${c * 0.1}px ${c * 0.07}px 0` }} />
          </div>

          {/* LED display */}
          <div
            className={`${styles.led} mx-auto flex flex-col items-center justify-center text-center`}
            style={{ width: bezelW * 0.86, height: c * 0.52, marginTop: c * 0.14, borderRadius: c * 0.06 }}
            aria-live="polite"
          >
            {ledText ? (
              <>
                <span className={styles.ledBlink} style={{ fontSize: Math.max(10, c * 0.08) }}>{ledLabel}</span>
                <span className="max-w-[94%] truncate font-bold leading-none" style={{ fontSize: Math.max(18, c * 0.2) }}>
                  {ledText}
                </span>
              </>
            ) : ledLabel ? (
              <span className={styles.ledBlink} style={{ fontSize: Math.max(16, c * 0.17) }}>{ledLabel}</span>
            ) : (
              <span className={styles.dots} style={{ fontSize: Math.max(16, c * 0.15) }}>SPINNING</span>
            )}
          </div>
        </div>

        {/* Pull lever on the right */}
        <div
          className="absolute"
          style={{ left: '100%', top: marqueeH + bodyPad * 0.8 + bezelPad + c, width: c * 0.42, height: 0 }}
          aria-hidden
        >
          <div className={styles.leverMount} style={{ width: c * 0.2, height: c * 0.6, top: -c * 0.3, borderRadius: `0 ${c * 0.08}px ${c * 0.08}px 0` }} />
          <div
            className={`${styles.leverRod} ${reducedMotion ? '' : styles.leverPull}`}
            style={{ left: c * 0.2, width: c * 0.075, height: rodH, bottom: 0, borderRadius: c * 0.04 }}
          />
          <div
            className={`${styles.leverKnob} ${reducedMotion ? '' : styles.leverKnobPull}`}
            style={{
              left: c * 0.2 + c * 0.0375 - c * 0.15,
              width: c * 0.3,
              height: c * 0.3,
              bottom: rodH - c * 0.15,
              ['--rod' as string]: `${rodH}px`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
