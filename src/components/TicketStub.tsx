"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './TicketStub.module.css';

/** Marks the header ticket wallet so allocations can fly tickets to/from it. */
export const TICKET_WALLET_ATTR = 'data-ticket-wallet';

function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic pseudo-barcode bar widths for a seed. */
function barcodeFor(seed: string, bars = 16): number[] {
  let h = hashString(seed) || 1;
  return Array.from({ length: bars }, () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return 1 + ((h >>> 0) % 3);
  });
}

function OdometerDigit({ digit }: { digit: number }) {
  return (
    <span className={styles.digit}>
      <span className={styles.digitStrip} style={{ transform: `translateY(-${digit}em)` }}>
        {Array.from({ length: 10 }, (_, i) => <span key={i}>{i}</span>)}
      </span>
    </span>
  );
}

interface TicketStubProps {
  remaining: number;
  total: number;
  seed: string;
}

export default function TicketStub({ remaining, total, seed }: TicketStubProps) {
  const bars = useMemo(() => barcodeFor(seed), [seed]);
  const serial = useMemo(() => String(hashString(seed) % 1_000_000).padStart(6, '0'), [seed]);
  const width = Math.max(String(total).length, String(remaining).length, 2);
  const digits = String(Math.max(0, remaining)).padStart(width, '0').split('').map(Number);

  const [bump, setBump] = useState(false);
  const prev = useRef(remaining);
  useEffect(() => {
    if (prev.current === remaining) return;
    prev.current = remaining;
    setBump(true);
    const t = window.setTimeout(() => setBump(false), 520);
    return () => window.clearTimeout(t);
  }, [remaining]);

  return (
    <div
      className={`${styles.stub} ${bump ? styles.bump : ''}`}
      {...{ [TICKET_WALLET_ATTR]: '' }}
      role="status"
      aria-label={`${remaining} of ${total} tickets remaining`}
    >
      <div className={styles.main}>
        <div className={styles.barcode} aria-hidden>
          {bars.map((w, i) => <span key={i} style={{ width: w }} />)}
        </div>
        <div className={styles.meta} aria-hidden>
          <span className={styles.label}>Admit one</span>
          <span className={styles.serial}>Nº {serial}</span>
        </div>
      </div>
      <div className={styles.tab} aria-hidden>
        <div className={styles.meta}>
          <span className={styles.label}>Tickets</span>
          <span className={styles.count}>
            <span className={styles.digits}>
              {digits.map((d, i) => <OdometerDigit key={`${width}-${i}`} digit={d} />)}
            </span>
            <span className={styles.total}>/{total}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Tear mini ticket stubs off and fly them between two elements.
 * Used when allocating (wallet → prize) or returning tickets (prize → wallet).
 */
export function launchTickets(from: Element | null, to: Element | null, count: number) {
  if (!from || !to || count <= 0 || typeof window === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const n = Math.min(count, 10);

  for (let i = 0; i < n; i++) {
    const el = document.createElement('div');
    el.className = styles.flyer;
    document.body.appendChild(el);

    const sx = a.left + a.width / 2 - 17 + (Math.random() - 0.5) * 16;
    const sy = a.top + a.height / 2 - 10;
    const ex = b.left + b.width / 2 - 17 + (Math.random() - 0.5) * Math.min(b.width * 0.6, 120);
    const ey = b.top + b.height / 2 - 10 + (Math.random() - 0.5) * 12;
    const lift = Math.min(160, Math.abs(ey - sy) * 0.35 + 60);
    const mx = (sx + ex) / 2 + (Math.random() - 0.5) * 120;
    const my = Math.min(sy, ey) - lift;
    const spin = (Math.random() - 0.5) * 540;

    const anim = el.animate(
      [
        { transform: `translate(${sx}px, ${sy}px) rotate(-8deg) scale(0.6)`, opacity: 0 },
        { transform: `translate(${sx}px, ${sy - 14}px) rotate(${spin * 0.1}deg) scale(1.1)`, opacity: 1, offset: 0.12 },
        { transform: `translate(${mx}px, ${my}px) rotate(${spin * 0.6}deg) scale(1.15)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${ex}px, ${ey}px) rotate(${spin}deg) scale(0.55)`, opacity: 0.9, offset: 0.92 },
        { transform: `translate(${ex}px, ${ey}px) rotate(${spin}deg) scale(0.2)`, opacity: 0 },
      ],
      {
        duration: 900 + Math.random() * 250,
        delay: i * 70,
        easing: 'cubic-bezier(.45,.05,.35,1)',
        fill: 'both',
      }
    );
    anim.onfinish = () => el.remove();
    anim.oncancel = () => el.remove();
  }
}
