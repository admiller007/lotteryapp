"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';

/* Shared pieces for the winner draw animations (slot machine and wheel). */

export type DrawStyle = 'slot' | 'wheel';

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

export interface DrawSounds {
  /** A short click as a peg/cell passes. */
  tick: (slow: boolean) => void;
  /** A reel slamming to a stop. */
  clunk: () => void;
}

/** What each draw animation gets from the reveal shell. */
export interface DrawAnimationProps {
  prize: RevealPrize;
  candidates: RevealPerson[];
  /** The winner if already known when the draw opens. */
  initialWinner?: RevealPerson | null;
  /** Always holds the latest winner; it may arrive mid-spin. */
  winnerRef: React.MutableRefObject<RevealPerson | null | undefined>;
  entrantCount: number;
  landscape: boolean;
  reducedMotion: boolean;
  sounds: DrawSounds;
  /** Call once when the animation has come to rest on the winner. */
  onLanded: () => void;
}

export const easeInQuad = (t: number) => t * t;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
export const mod = (n: number, m: number) => ((n % m) + m) % m;

export const shuffle = <T,>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export const uniquePeople = (people: RevealPerson[]) => {
  const unique = new Map<string, RevealPerson>();
  people.forEach((person) => {
    if (person?.id && !unique.has(person.id)) unique.set(person.id, person);
  });
  return Array.from(unique.values());
};

const AVATAR_COLORS = ['#ff6b6b', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export const initialsFor = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

export const colorFor = (key: string) => {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

/** Photo with an initials fallback underneath, so it's never blank while an image loads. */
export function PersonAvatar({
  person,
  size,
  className = '',
  style,
}: {
  person: RevealPerson;
  size: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = !!person.profilePictureUrl && !failed;
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full ${className}`}
      style={{ width: size, height: size, backgroundColor: colorFor(person.id || person.name), ...style }}
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

/**
 * Synthesised draw sounds plus the winning fanfare. Browsers keep audio
 * suspended until the first click on the page, so call unlock() on pointer down.
 */
export function useDrawAudio(muted: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const getCtx = useCallback(() => {
    if (typeof window === 'undefined') return null;
    if (!ctxRef.current) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      try {
        ctxRef.current = new Ctor();
      } catch {
        return null;
      }
    }
    return ctxRef.current;
  }, []);

  useEffect(() => {
    getCtx();
    return () => {
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    };
  }, [getCtx]);

  const unlock = useCallback(() => {
    const ctx = getCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }, [getCtx]);

  const running = useCallback(() => {
    if (mutedRef.current) return null;
    const ctx = getCtx();
    return ctx && ctx.state === 'running' ? ctx : null;
  }, [getCtx]);

  const tick = useCallback((slow: boolean) => {
    const ctx = running();
    if (!ctx) return;
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
  }, [running]);

  const clunk = useCallback(() => {
    const ctx = running();
    if (!ctx) return;
    const t = ctx.currentTime;
    // Low thump...
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(170, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.14);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.6, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
    // ...plus a metallic click on top.
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.type = 'square';
    click.frequency.setValueAtTime(2400, t);
    clickGain.gain.setValueAtTime(0.0001, t);
    clickGain.gain.exponentialRampToValueAtTime(0.08, t + 0.002);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    click.connect(clickGain).connect(ctx.destination);
    click.start(t);
    click.stop(t + 0.04);
  }, [running]);

  const fanfare = useCallback(() => {
    if (mutedRef.current) return;
    try {
      const audio = new Audio('/sounds/winning_slot.wav');
      audio.volume = 0.85;
      audio.play().catch(() => {});
    } catch {
      /* audio unavailable */
    }
  }, []);

  return { unlock, tick, clunk, fanfare };
}
