"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './HoloCard.module.css';

interface HoloCardProps {
  children: React.ReactNode;
  className?: string;
  /** Max tilt in degrees. */
  maxTilt?: number;
}

/**
 * Wraps a card in an iridescent holographic foil that tracks the pointer
 * and tilts the card in 3D.
 */
export default function HoloCard({ children, className = '', maxTilt = 10 }: HoloCardProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);
  const [active, setActive] = useState(false);

  const setVars = useCallback((vars: Record<string, string>) => {
    const el = wrapRef.current;
    if (!el) return;
    for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
  }, []);

  const handleMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'touch') return;
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        setVars({
          '--mx': `${px * 100}%`,
          '--my': `${py * 100}%`,
          '--rx': `${(0.5 - py) * maxTilt}deg`,
          '--ry': `${(px - 0.5) * maxTilt}deg`,
          '--active': '1',
        });
      });
      if (!active) setActive(true);
    },
    [active, maxTilt, setVars]
  );

  const handleLeave = useCallback(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    setVars({ '--rx': '0deg', '--ry': '0deg', '--active': '0', '--mx': '50%', '--my': '50%' });
    setActive(false);
  }, [setVars]);

  useEffect(() => () => { if (frame.current) cancelAnimationFrame(frame.current); }, []);

  return (
    <div
      ref={wrapRef}
      className={`${styles.wrap} ${className}`}
      data-active={active ? 'true' : 'false'}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
    >
      <div className={`${styles.card} h-full`}>
        {children}
        <div className={`${styles.layer} ${styles.foil}`} aria-hidden />
        <div className={`${styles.layer} ${styles.grain}`} aria-hidden />
        <div className={`${styles.layer} ${styles.glare}`} aria-hidden />
        <div className={`${styles.layer} ${styles.rim}`} aria-hidden />
      </div>
    </div>
  );
}

/** Embossed holographic "WINNER" seal. */
export function HoloSeal({ label = 'Winner', className = '' }: { label?: string; className?: string }) {
  const year = new Date().getFullYear();
  return (
    <div className={`z-[3] ${className}`} role="img" aria-label={label}>
      <div className={styles.seal}>
        <div className={styles.sealInner}>
          <div>
            <div className={styles.sealTop}>★ ★ ★</div>
            <div className={styles.sealMain}>{label.toUpperCase()}</div>
            <div className={styles.sealTop}>{year}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
