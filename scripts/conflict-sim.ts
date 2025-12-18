import { auctionReducer, initialState } from '../src/context/AppContext';
import type { AuctionContextState, Prize } from '../src/lib/types';

// Deterministic Math.random helper
const runWithFixedRandom = <T,>(fn: () => T, value: number = 0): T => {
  const originalRandom = Math.random;
  Math.random = () => value;
  try {
    return fn();
  } finally {
    Math.random = originalRandom;
  }
};

const adminUser = {
  id: 'ADMIN001',
  firstName: 'Admin',
  lastName: 'User',
  employeeId: 'ADMIN001',
  facilityName: 'Admin',
  name: 'Admin User',
  totalInitialTickets: 100,
  allocatedTickets: {},
  status: 'working' as const,
};

const basePrizes: Prize[] = [
  {
    id: 'p1',
    name: 'Prize One',
    description: '',
    imageUrl: '',
    entries: [
      { userId: 'userA', numTickets: 3 },
      { userId: 'userB', numTickets: 1 },
    ],
    totalTicketsInPrize: 4,
  },
  {
    id: 'p2',
    name: 'Prize Two',
    description: '',
    imageUrl: '',
    entries: [
      { userId: 'userA', numTickets: 3 },
      { userId: 'userC', numTickets: 2 },
    ],
    totalTicketsInPrize: 5,
  },
];

const baseUsers: AuctionContextState['allUsers'] = {
  ADMIN001: { id: 'ADMIN001', name: 'Admin User', facilityName: 'Admin' },
  userA: { id: 'userA', name: 'User A' },
  userB: { id: 'userB', name: 'User B' },
  userC: { id: 'userC', name: 'User C' },
};

const makeState = (): AuctionContextState => ({
  ...initialState,
  currentUser: adminUser,
  prizes: JSON.parse(JSON.stringify(basePrizes)),
  prizeTiers: [],
  winners: {},
  allUsers: { ...baseUsers },
  pendingConflict: null,
  drawsPaused: false,
  isAuctionOpen: true,
});

const drawSingle = (state: AuctionContextState, prizeId: string) =>
  auctionReducer(state, { type: 'DRAW_SINGLE_WINNER', payload: { prizeId } });

const resolveConflict = (
  state: AuctionContextState,
  keepExisting: boolean
) => {
  const conflict = state.pendingConflict;
  if (!conflict) return state;

  const keepPrizeId = keepExisting ? conflict.existingPrizeId : conflict.newPrizeId;
  const dropPrizeId = keepExisting ? conflict.newPrizeId : conflict.existingPrizeId;

  return auctionReducer(state, {
    type: 'RESOLVE_WINNER_CONFLICT',
    payload: {
      conflictId: conflict.id,
      keepPrizeId,
      dropPrizeId,
      userId: conflict.userId,
    },
  });
};

const logState = (label: string, state: AuctionContextState) => {
  console.log(`\n=== ${label} ===`);
  console.log('winners:', state.winners);
  console.log('pendingConflict:', state.pendingConflict);
  console.log('drawsPaused:', state.drawsPaused);
};

const runScenario = (keepExisting: boolean) => {
  const scenarioLabel = keepExisting
    ? 'Keep existing prize (redraw new prize)'
    : 'Keep new prize (redraw existing prize)';

  const resultState = runWithFixedRandom(() => {
    let state = makeState();

    state = drawSingle(state, 'p1');
    logState('After drawing Prize 1', state);

    state = drawSingle(state, 'p2');
    logState('After drawing Prize 2 (expect conflict)', state);

    state = resolveConflict(state, keepExisting);
    logState('After resolving conflict', state);

    return state;
  });

  return { label: scenarioLabel, final: resultState };
};

const scenarios = [true, false];
scenarios.forEach((keepExisting) => {
  console.log(`\n\n### Scenario: ${keepExisting ? 'Keep existing' : 'Keep new'} ###`);
  const { final } = runScenario(keepExisting);
  console.log('Final winners:', final.winners);
});
