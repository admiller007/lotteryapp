import type { DirectoryUser, Prize } from './types';

/* Made-up people and prizes so admins can preview the recap reel before any
   real winners have been drawn. Nothing here is saved anywhere. */

const FACILITIES = ['Northside', 'Lakeview', 'Riverside', 'Oak Park'];
const NAMES = [
  'Maria Lopez', 'James Chen', 'Aisha Patel', 'Tom Becker', 'Lena Novak', 'Sam Rivera',
  'Priya Shah', 'Owen Kelly', 'Grace Kim', 'Diego Silva', 'Nora Fitz', 'Ben Adler',
];
const PRIZES: [string, string][] = [
  ['Weekend Getaway', '#f97316'],
  ['Smart TV', '#3b82f6'],
  ['Espresso Machine', '#10b981'],
  ['Wireless Earbuds', '#a855f7'],
  ['Spa Day', '#ec4899'],
  ['Gift Card', '#eab308'],
];

const swatch = (color: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='200' height='200' rx='36' fill='${color}'/></svg>`
  )}`;

export function buildRecapDemo() {
  const allUsers: Record<string, DirectoryUser> = Object.fromEntries(
    NAMES.map((name, i) => [`demo-${i}`, { id: `demo-${i}`, name, facilityName: FACILITIES[i % FACILITIES.length] }])
  );
  const prizes: Prize[] = PRIZES.map(([name, color], p) => {
    const entries = NAMES.map((_, i) => ({ userId: `demo-${i}`, numTickets: ((i * 7 + p * 3) % 30) + (p === 0 ? 20 : 0) }));
    if (p === 3) entries[5].numTickets = 2; // the underdog
    return {
      id: `demo-prize-${p}`,
      name,
      description: '',
      imageUrl: swatch(color),
      entries,
      totalTicketsInPrize: entries.reduce((sum, e) => sum + e.numTickets, 0),
    };
  });
  const winners: Record<string, string[]> = {
    'demo-prize-0': ['demo-0'],
    'demo-prize-1': ['demo-1'],
    'demo-prize-2': ['demo-2', 'demo-7'],
    'demo-prize-3': ['demo-5'],
    'demo-prize-4': ['demo-4'],
    'demo-prize-5': ['demo-9'],
  };
  return { prizes, winners, allUsers, eventName: 'Sample recap' };
}
