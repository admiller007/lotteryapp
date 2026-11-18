import type { DirectoryUser, Prize } from './types';

/* Numbers for the end-of-night recap reel, worked out from data the app
   already loads (prizes with their entries, winners and the user directory). */

export interface RecapPerson {
  id: string;
  name: string;
  profilePictureUrl?: string;
  facilityName?: string;
}

export interface RecapPrize {
  id: string;
  name: string;
  imageUrl?: string;
}

export interface RecapWin {
  prize: RecapPrize;
  winner: RecapPerson;
  /** Tickets this winner put on this prize. */
  tickets: number;
  /** All tickets on this prize. */
  prizeTickets: number;
}

export interface FacilityRow {
  facility: string;
  value: number;
}

export interface RecapStats {
  totalTickets: number;
  participants: number;
  prizesGiven: number;
  mostWanted: { prize: RecapPrize; tickets: number } | null;
  /** The win with the fewest tickets behind it, when it's a real long shot. */
  underdog: RecapWin | null;
  ticketsByFacility: FacilityRow[];
  winsByFacility: FacilityRow[];
  wins: RecapWin[];
}

const UNKNOWN_FACILITY = 'Other';

const toPrize = (p: Prize): RecapPrize => ({ id: p.id, name: p.name, imageUrl: p.imageUrl || undefined });

const toPerson = (id: string, user: DirectoryUser): RecapPerson => ({
  id,
  name: user.name || 'Unknown',
  profilePictureUrl: user.profilePictureUrl,
  facilityName: user.facilityName,
});

const ticketsOf = (prize: Prize, userId: string) =>
  prize.entries.reduce((sum, e) => (e.userId === userId ? sum + Math.max(0, e.numTickets) : sum), 0);

const prizeTotal = (prize: Prize) => prize.entries.reduce((sum, e) => sum + Math.max(0, e.numTickets), 0);

const sortRows = (map: Map<string, number>): FacilityRow[] =>
  Array.from(map, ([facility, value]) => ({ facility, value }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value || a.facility.localeCompare(b.facility));

export function computeRecapStats(
  prizes: Prize[],
  winners: Record<string, string[]>,
  allUsers: Record<string, DirectoryUser>
): RecapStats {
  let totalTickets = 0;
  const participantIds = new Set<string>();
  const ticketsByFacility = new Map<string, number>();
  let mostWanted: RecapStats['mostWanted'] = null;

  for (const prize of prizes) {
    const total = prizeTotal(prize);
    totalTickets += total;
    for (const entry of prize.entries) {
      if (entry.numTickets <= 0) continue;
      participantIds.add(entry.userId);
      const facility = allUsers[entry.userId]?.facilityName || UNKNOWN_FACILITY;
      ticketsByFacility.set(facility, (ticketsByFacility.get(facility) || 0) + entry.numTickets);
    }
    if (total > 0 && (!mostWanted || total > mostWanted.tickets)) {
      mostWanted = { prize: toPrize(prize), tickets: total };
    }
  }

  const wins: RecapWin[] = [];
  const winsByFacility = new Map<string, number>();
  for (const prize of prizes) {
    const total = prizeTotal(prize);
    for (const winnerId of winners[prize.id] || []) {
      const user = allUsers[winnerId];
      if (!user) continue;
      wins.push({ prize: toPrize(prize), winner: toPerson(winnerId, user), tickets: ticketsOf(prize, winnerId), prizeTickets: total });
      const facility = user.facilityName || UNKNOWN_FACILITY;
      winsByFacility.set(facility, (winsByFacility.get(facility) || 0) + 1);
    }
  }

  // Underdog: fewest tickets behind a win, ties broken by the longest odds.
  // Only worth a slide when they really were up against it (under a quarter
  // of the tickets on that prize).
  let underdog: RecapWin | null = null;
  for (const win of wins) {
    if (win.tickets <= 0 || win.prizeTickets <= 0) continue;
    if (win.tickets / win.prizeTickets >= 0.25) continue;
    if (
      !underdog ||
      win.tickets < underdog.tickets ||
      (win.tickets === underdog.tickets && win.tickets / win.prizeTickets < underdog.tickets / underdog.prizeTickets)
    ) {
      underdog = win;
    }
  }

  return {
    totalTickets,
    participants: participantIds.size,
    prizesGiven: wins.length,
    mostWanted,
    underdog,
    ticketsByFacility: sortRows(ticketsByFacility),
    winsByFacility: sortRows(winsByFacility),
    wins,
  };
}

/**
 * True when every prize that has entries has all the winners it can get
 * (its winner count, or fewer if it had fewer entrants than that).
 */
export function allPrizesDrawn(prizes: Prize[], winners: Record<string, string[]>): boolean {
  let anyDrawable = false;
  for (const prize of prizes) {
    const entrants = new Set(prize.entries.filter((e) => e.numTickets > 0).map((e) => e.userId)).size;
    if (entrants === 0) continue;
    anyDrawable = true;
    const needed = Math.min(prize.numberOfWinners || 1, entrants);
    if ((winners[prize.id] || []).length < needed) return false;
  }
  return anyDrawable;
}
