
"use client";
import type { Dispatch, ReactNode } from 'react';
import React, { createContext, useContext, useReducer, useMemo, useEffect, useRef } from 'react';
import type { Prize, AppUser, AuctionContextState, AuctionAction, PrizeTier, DirectoryUser } from '@/lib/types';
import type { FirebasePrize, FirebaseUser } from '@/lib/firebaseService';
import { toast } from '@/hooks/use-toast';
import { PARTY_CHECKIN_FLAG_KEY } from '@/lib/partyCheckIn';

// Older versions saved the whole app state, including every user's PIN, here.
const LEGACY_STORAGE_KEY = 'lotteryAppState';
// Fired when the server rejects an allocation so the provider can reload the
// user's real allocations (the reducer has already applied the change).
const ALLOCATION_FAILED_EVENT = 'lottery:allocation-failed';

// Map of user ID -> public user info, for names and photos on the draw and
// winners screens. Users are keyed by document ID (used by allocations and
// winners) and also by employeeId for older records.
export const toDirectory = (users: FirebaseUser[]): Record<string, DirectoryUser> =>
  users.reduce<Record<string, DirectoryUser>>((acc, user) => {
    const entry: DirectoryUser = {
      id: user.id || user.employeeId,
      name: `${user.firstName} ${user.lastName}`,
      tickets: user.tickets,
      facilityName: user.facilityName,
      profilePictureUrl: user.profilePictureUrl,
      status: user.status || 'inactive',
    };
    if (user.id) acc[user.id] = entry;
    if (user.employeeId) acc[user.employeeId] = entry;
    return acc;
  }, {});

const initialPrizes: Prize[] = [
  {
    id: 'prize1',
    name: 'Luxury Spa Day',
    description: 'A full day of pampering at a top-rated spa, including massage, facial, and more.',
    imageUrl: 'https://placehold.co/300x200.png',
    entries: [],
    totalTicketsInPrize: 0,
    numberOfWinners: 1,
    excludedFacilities: [],
  },
  {
    id: 'prize2',
    name: 'Weekend Getaway',
    description: 'A two-night stay for two at a scenic countryside cabin.',
    imageUrl: 'https://placehold.co/300x200.png',
    entries: [],
    totalTicketsInPrize: 0,
    numberOfWinners: 1,
    excludedFacilities: [],
  },
  {
    id: 'prize3',
    name: 'Tech Gadget Bundle',
    description: 'Latest smartwatch, wireless earbuds, and a portable charger.',
    imageUrl: 'https://placehold.co/300x200.png',
    entries: [],
    totalTicketsInPrize: 0,
    numberOfWinners: 1,
    excludedFacilities: [],
  },
];

const initialPrizeTiers: PrizeTier[] = [
  {
    id: 'tier1',
    name: 'Grand Prize',
    description: 'The most valuable prizes',
    color: '#FFD700',
    order: 1,
  },
  {
    id: 'tier2',
    name: 'Premium',
    description: 'High-value prizes',
    color: '#C0C0C0',
    order: 2,
  },
  {
    id: 'tier3',
    name: 'Standard',
    description: 'Regular prizes',
    color: '#CD7F32',
    order: 3,
  },
];

const initialState: AuctionContextState = {
  prizes: initialPrizes,
  prizeTiers: initialPrizeTiers,
  currentUser: null, // No user logged in initially
  isAuctionOpen: true,
  allocationsOpen: true,
  drawStyle: 'slot',
  winners: {},
  pendingConflict: null,
  drawsPaused: false,
  allUsers: {},
};

const buildDrawingPool = (
  prize: Prize,
  excludedUserIds: Set<string> = new Set<string>(),
  allUsers: AuctionContextState['allUsers'] = {}
) => {
  const drawingPool: string[] = [];
  const normalizedExcludedFacilities = (prize.excludedFacilities || [])
    .map(facility => facility.trim().toLowerCase())
    .filter(Boolean);

  prize.entries.forEach(entry => {
    if (entry.numTickets <= 0) return;
    if (excludedUserIds.has(entry.userId)) return;
    const facilityName = allUsers[entry.userId]?.facilityName?.trim().toLowerCase();
    if (facilityName && normalizedExcludedFacilities.includes(facilityName)) return;

    for (let i = 0; i < entry.numTickets; i++) {
      drawingPool.push(entry.userId);
    }
  });

  return drawingPool;
};

const pickWinnerWithConflictCheck = (
  prize: Prize,
  currentWinners: Record<string, string[]>,
  excludedUserIds: Set<string> = new Set<string>(),
  allUsers: AuctionContextState['allUsers'] = {}
) => {
  const drawingPool = buildDrawingPool(prize, excludedUserIds, allUsers);

  if (drawingPool.length === 0) {
    return { winnerId: null as string | null, conflictPrizeId: null as string | null };
  }

  const winnerIndex = Math.floor(Math.random() * drawingPool.length);
  const winnerId = drawingPool[winnerIndex];
  const conflictPrizeId =
    Object.entries(currentWinners).find(
      ([pId, uIds]) => pId !== prize.id && uIds.includes(winnerId)
    )?.[0] || null;

  return { winnerId, conflictPrizeId };
};

const AppContext = createContext<{
  state: AuctionContextState;
  dispatch: Dispatch<AuctionAction>;
  remainingTickets: number;
  isAdmin: boolean;
  isHydrated: boolean;
  logout: () => Promise<void>;
}>({
  state: initialState,
  dispatch: () => null,
  remainingTickets: 0,
  isAdmin: false,
  isHydrated: false,
  logout: async () => {},
});

const auctionReducer = (state: AuctionContextState, action: AuctionAction): AuctionContextState => {
  switch (action.type) {
    case 'LOGIN_SUCCESS': {
      const { user, userName } = action.payload;
      return {
        ...state,
        currentUser: user,
        lastAction: { type: 'LOGIN_SUCCESS', userName },
      };
    }
    case 'LOGIN_ERROR': {
      const { message } = action.payload;
      return {
        ...state,
        lastAction: { type: 'LOGIN_ERROR', message },
      };
    }
    case 'LOGOUT_USER': {
      return {
        ...state,
        currentUser: null,
        lastAction: { type: 'LOGOUT_SUCCESS' },
      };
    }
    case 'ADD_PRIZE': {
      if (!state.currentUser || !state.currentUser.isAdmin) return state; 
      const newPrize: Prize = {
        ...action.payload,
        id: `prize-${Date.now()}`,
        entries: [],
        totalTicketsInPrize: 0,
      };
      return { ...state, prizes: [...state.prizes, newPrize] };
    }
    case 'UPDATE_PRIZE': {
      if (!state.currentUser || !state.currentUser.isAdmin) return state;
      return {
        ...state,
        prizes: state.prizes.map((p) =>
          p.id === action.payload.id ? { ...p, ...action.payload } : p
        ),
      };
    }
    case 'DELETE_PRIZE': {
      if (!state.currentUser || !state.currentUser.isAdmin) return state;
      const updatedAllocatedTickets = { ...state.currentUser.allocatedTickets };
      delete updatedAllocatedTickets[action.payload.prizeId];
      
      return {
        ...state,
        prizes: state.prizes.filter((p) => p.id !== action.payload.prizeId),
        currentUser: {
          ...state.currentUser,
          allocatedTickets: updatedAllocatedTickets,
        },
      };
    }
    case 'ALLOCATE_TICKETS': {
      if (!state.currentUser) return state;
      if (!state.allocationsOpen) {
        toast({ title: "Ticket allocation is closed", description: "Tickets can't be changed right now.", variant: "destructive" });
        return state;
      }
      const { prizeId, userId, userName, count } = action.payload; 
      const prize = state.prizes.find(p => p.id === prizeId);
      if (!prize) return state;

      const currentAllocationForPrize = state.currentUser.allocatedTickets[prizeId] || 0;
      
      const totalAllocatedByCurrentUser = Object.values(state.currentUser.allocatedTickets).reduce((sum, val) => sum + val, 0) - currentAllocationForPrize;
      const potentialNewTotalAllocated = totalAllocatedByCurrentUser + count;

      if (potentialNewTotalAllocated > state.currentUser.totalInitialTickets) {
        return {
          ...state,
          lastAction: { type: 'ALLOCATION_ERROR', message: "You don't have enough tickets to make this allocation." },
        };
      }
      
      const updatedAllocatedTickets = { ...state.currentUser.allocatedTickets, [prizeId]: count };
      if (count === 0) {
        delete updatedAllocatedTickets[prizeId];
      }
      
      let updatedEntries = prize.entries.filter(entry => entry.userId !== userId);
      if (count > 0) {
        updatedEntries.push({ userId, numTickets: count });
      }
      
      const updatedPrize = {
        ...prize,
        entries: updatedEntries,
        totalTicketsInPrize: updatedEntries.reduce((sum, entry) => sum + entry.numTickets, 0),
      };


      // The server checks the ticket limit and the "allocation closed" switch,
      // and updates the prize's entries in a transaction. Don't also write
      // this client's copy of prize.entries: it can be stale and would wipe
      // out other users' allocations to the same prize.
      import('@/lib/apiClient').then(async ({ allocateTicketsApi }) => {
        try {
          await allocateTicketsApi({
            prizeId,
            tickets: count,
            // Admins can allocate for others (random-allocation test tool).
            ...(userId !== state.currentUser?.id ? { userId } : {}),
          });
        } catch (error) {
          console.error('Failed to save allocation:', error);
          toast({
            title: "Tickets not saved",
            description: (error as Error)?.message || "We couldn't save that allocation. Please try again.",
            variant: "destructive",
          });
          if (typeof window !== 'undefined') window.dispatchEvent(new Event(ALLOCATION_FAILED_EVENT));
        }
      });

      const updatedAllUsers = state.allUsers[userId]
        ? state.allUsers
        : { ...state.allUsers, [userId]: { id: userId, name: userName } };

      return {
        ...state,
        currentUser: { ...state.currentUser, allocatedTickets: updatedAllocatedTickets },
        prizes: state.prizes.map(p => p.id === prizeId ? updatedPrize : p),
        allUsers: updatedAllUsers,
      };
    }
    case 'DRAW_WINNERS': {
      if (!state.currentUser || !state.currentUser.isAdmin || !state.isAuctionOpen) return state;
      if (state.pendingConflict) {
        return {
          ...state,
          lastAction: { type: 'WINNER_CONFLICT_PENDING', message: 'Resolve the existing winner conflict before drawing more prizes.' },
        };
      }

      const updatedWinners: Record<string, string[]> = { ...state.winners };
      const shuffledPrizes = [...state.prizes].sort(() => Math.random() - 0.5);
      const assignedWinners = new Set<string>(Object.values(updatedWinners).flat());
      let conflict: { id: string; userId: string; userName?: string; existingPrizeId: string; newPrizeId: string } | null = null;

      for (const prize of shuffledPrizes) {
        const desiredWinners = prize.numberOfWinners || 1;
        const currentPrizeWinners = updatedWinners[prize.id] || [];
        if (currentPrizeWinners.length >= desiredWinners) continue; // Skip prizes that already have enough winners
        if (prize.entries.length === 0) continue;

        const slotsToFill = desiredWinners - currentPrizeWinners.length;

        for (let i = 0; i < slotsToFill; i++) {
          const { winnerId, conflictPrizeId } = pickWinnerWithConflictCheck(prize, updatedWinners, assignedWinners, state.allUsers);

          if (!winnerId) break;

          if (conflictPrizeId) {
            conflict = {
              id: `conflict-${Date.now()}`,
              userId: winnerId,
              userName: state.allUsers[winnerId]?.name,
              existingPrizeId: conflictPrizeId,
              newPrizeId: prize.id,
            };
            break;
          }

          currentPrizeWinners.push(winnerId);
          assignedWinners.add(winnerId);
        }

        updatedWinners[prize.id] = currentPrizeWinners;

        if (conflict) break;
      }

      if (conflict) {
        import('@/lib/firebaseService').then(async ({ saveWinners }) => {
          try {
            await saveWinners(updatedWinners);
          } catch (error) {
            console.error('Failed to save winners before conflict resolution:', error);
          }
        });

        return {
          ...state,
          winners: updatedWinners,
          pendingConflict: conflict,
          drawsPaused: true,
          lastAction: { type: 'WINNER_CONFLICT', message: `${conflict.userName || 'Selected user'} already holds another prize. Resolve the conflict to continue.` },
        };
      }

      // Save all winners to Firebase
      import('@/lib/firebaseService').then(async ({ saveWinners }) => {
        try {
          await saveWinners(updatedWinners);
        } catch (error) {
          console.error('Failed to save all winners to Firebase:', error);
        }
      });

      return {
        ...state,
        winners: updatedWinners,
        isAuctionOpen: false,
        pendingConflict: null,
        drawsPaused: false,
        lastAction: { type: 'WINNERS_DRAWN' },
      };
    }
    case 'DRAW_SINGLE_WINNER': {
      if (!state.currentUser || !state.currentUser.isAdmin) return state;
      if (state.pendingConflict) {
        return {
          ...state,
          lastAction: { type: 'WINNER_CONFLICT_PENDING', message: 'Resolve the existing winner conflict before drawing more prizes.' },
        };
      }

      const { prizeId } = action.payload;
      const prize = state.prizes.find(p => p.id === prizeId);
      if (!prize || prize.entries.length === 0) {
        return {
          ...state,
          lastAction: { type: 'NO_ENTRIES_ERROR', prizeName: prize?.name || 'Unknown Prize' },
        };
      }

      const desiredWinners = prize.numberOfWinners || 1;
      const currentPrizeWinners = state.winners[prizeId] || [];

      // Check if this prize already has enough winners
      if (currentPrizeWinners.length >= desiredWinners) {
        return {
          ...state,
          lastAction: { type: 'ERROR', message: 'This prize already has all winners drawn. Use redraw if needed.' },
        };
      }

      const excluded = new Set<string>(Object.values(state.winners).flat());
      const { winnerId, conflictPrizeId } = pickWinnerWithConflictCheck(prize, state.winners, excluded, state.allUsers);

      if (!winnerId) {
        return {
          ...state,
          lastAction: { type: 'ERROR', message: 'No eligible participants for this prize.' },
        };
      }

      if (conflictPrizeId) {
        const conflict = {
          id: `conflict-${Date.now()}`,
          userId: winnerId,
          userName: state.allUsers[winnerId]?.name,
          existingPrizeId: conflictPrizeId,
          newPrizeId: prize.id,
        };
        return {
          ...state,
          pendingConflict: conflict,
          drawsPaused: true,
          lastAction: { type: 'WINNER_CONFLICT', message: `${conflict.userName || 'Selected user'} already holds another prize. Resolve the conflict to continue.` },
        };
      }

      const winnerName = state.allUsers[winnerId]?.name || 'Unknown User';

      // Save winner to Firebase
      import('@/lib/firebaseService').then(async ({ saveWinner }) => {
        try {
          await saveWinner(prizeId, winnerId);
        } catch (error) {
          console.error('Failed to save winner to Firebase:', error);
        }
      });

      return {
        ...state,
        winners: { ...state.winners, [prizeId]: [...currentPrizeWinners, winnerId] },
        pendingConflict: null,
        drawsPaused: false,
        lastAction: { type: 'SINGLE_WINNER_DRAWN', winnerName, prizeName: prize.name },
      };
    }
    case 'ASSIGN_SPECIFIC_WINNER': {
      if (!state.currentUser || !state.currentUser.isAdmin) return state;
      if (state.pendingConflict) {
        return {
          ...state,
          lastAction: { type: 'WINNER_CONFLICT_PENDING', message: 'Resolve the existing winner conflict before drawing more prizes.' },
        };
      }

      const { prizeId, userId } = action.payload;
      const prize = state.prizes.find((p) => p.id === prizeId);
      if (!prize) {
        return {
          ...state,
          lastAction: { type: 'ERROR', message: 'Prize not found for manual winner selection.' },
        };
      }

      const desiredWinners = prize.numberOfWinners || 1;
      const currentPrizeWinners = state.winners[prizeId] || [];

      if (currentPrizeWinners.includes(userId)) {
        return state;
      }

      if (currentPrizeWinners.length >= desiredWinners) {
        return {
          ...state,
          lastAction: { type: 'ERROR', message: 'This prize already has all winners drawn. Use redraw if needed.' },
        };
      }

      const hasEntriesForPrize = prize.entries.some((entry) => entry.userId === userId && entry.numTickets > 0);
      if (!hasEntriesForPrize) {
        return {
          ...state,
          lastAction: { type: 'ERROR', message: 'Selected winner does not have entries for this prize.' },
        };
      }

      const conflictPrizeId =
        Object.entries(state.winners).find(
          ([pId, uIds]) => pId !== prize.id && uIds.includes(userId)
        )?.[0] || null;

      if (conflictPrizeId) {
        const conflict = {
          id: `conflict-${Date.now()}`,
          userId,
          userName: state.allUsers[userId]?.name,
          existingPrizeId: conflictPrizeId,
          newPrizeId: prize.id,
        };
        return {
          ...state,
          pendingConflict: conflict,
          drawsPaused: true,
          lastAction: { type: 'WINNER_CONFLICT', message: `${conflict.userName || 'Selected user'} already holds another prize. Resolve the conflict to continue.` },
        };
      }

      const winnerName = state.allUsers[userId]?.name || 'Unknown User';
      const updatedPrizeWinners = [...currentPrizeWinners, userId];
      const updatedWinners = { ...state.winners, [prizeId]: updatedPrizeWinners };

      import('@/lib/firebaseService').then(async ({ saveWinner }) => {
        try {
          await saveWinner(prizeId, userId);
        } catch (error) {
          console.error('Failed to save winner to Firebase:', error);
        }
      });

      return {
        ...state,
        winners: updatedWinners,
        pendingConflict: null,
        drawsPaused: false,
        lastAction: { type: 'SINGLE_WINNER_DRAWN', winnerName, prizeName: prize.name },
      };
    }
    case 'RESET_AUCTION': {
      if (!state.currentUser || !state.currentUser.isAdmin) return state; 
      
      // Clear allocations, prize entries, and winners from Firebase
      import('@/lib/firebaseService').then(async ({ resetAuctionData }) => {
        try {
          await resetAuctionData();
        } catch (error) {
          console.error('Failed to reset auction data in Firebase:', error);
          toast({ title: "Reset failed", description: "Couldn't clear lottery data in Firebase. Please try again.", variant: "destructive" });
        }
      });
      
      const resetCurrentUser = state.currentUser ? {
        ...state.currentUser,
        allocatedTickets: {},
      } : null;

      return {
        ...initialState, 
        winners: {}, // Explicitly clear winners
        currentUser: resetCurrentUser, 
        allUsers: state.allUsers, // keep names; reset only clears tickets and winners
        prizes: state.prizes.map(p => ({ ...p, entries: [], totalTicketsInPrize: 0 })), 
        prizeTiers: state.prizeTiers,
        drawStyle: state.drawStyle, // a display setting, not lottery data
      };
    }
    case 'REDRAW_PRIZE_WINNER': {
      // Replaces ONE winner of a prize (e.g. they're not present). Allowed at
      // any time: admins usually draw prize-by-prize, so the auction is still
      // "open" when a redraw is needed.
      if (!state.currentUser || !state.currentUser.isAdmin) {
        toast({ title: "Action Denied", description: "Admin login required.", variant: "destructive" });
        return state;
      }

      if (state.pendingConflict) {
        toast({ title: "Resolve Conflict First", description: "Finish the pending winner conflict before redrawing.", variant: "destructive" });
        return state;
      }

      const { prizeId } = action.payload;
      const prize = state.prizes.find(p => p.id === prizeId);
      if (!prize) {
        toast({ title: "Prize Not Found", variant: "destructive" });
        return state;
      }

      const currentPrizeWinners = state.winners[prizeId] || [];
      const replacedId = action.payload.winnerId ?? currentPrizeWinners[currentPrizeWinners.length - 1];
      if (!replacedId || !currentPrizeWinners.includes(replacedId)) {
        toast({ title: "Nothing to Redraw", description: `${prize.name} has no winner to replace.`, variant: "destructive" });
        return state;
      }

      // The replaced winner can't be picked again, and (as with every draw)
      // nobody who currently holds a prize can win this one.
      const excluded = new Set<string>([...Object.values(state.winners).flat(), replacedId]);
      const { winnerId: newWinnerId } = pickWinnerWithConflictCheck(prize, state.winners, excluded, state.allUsers);

      const keptWinners = currentPrizeWinners.filter(id => id !== replacedId);
      const updatedWinners = { ...state.winners };
      if (newWinnerId) {
        // New winner goes last so the slot machine (which shows the latest
        // winner of a prize) announces them.
        updatedWinners[prizeId] = [...keptWinners, newWinnerId];
      } else if (keptWinners.length > 0) {
        updatedWinners[prizeId] = keptWinners;
      } else {
        delete updatedWinners[prizeId];
      }

      const replacedName = state.allUsers[replacedId]?.name || 'Previous winner';
      // A successful redraw is announced by the winner reveal, so no toast
      // here (it would give the name away while the reel is spinning).
      if (!newWinnerId) {
        toast({ title: "No Other Eligible Entrants", description: `${replacedName} was removed from ${prize.name}, but no one else is eligible to win it.` });
      }

      // Persist in both cases, otherwise the winners listener would restore
      // the removed winner from Firebase.
      import('@/lib/firebaseService').then(async ({ saveWinners }) => {
        try {
          await saveWinners(updatedWinners);
        } catch (error) {
          console.error('Failed to save redrawn winners to Firebase:', error);
          toast({ title: "Redraw not saved", description: "Couldn't save the redraw. Please try again.", variant: "destructive" });
        }
      });

      return { ...state, winners: updatedWinners };
    }
    case 'SET_ALLOCATIONS_OPEN': {
      if (state.allocationsOpen === action.payload.open) return state;
      return { ...state, allocationsOpen: action.payload.open };
    }
    case 'SET_DRAW_STYLE': {
      if (state.drawStyle === action.payload.drawStyle) return state;
      return { ...state, drawStyle: action.payload.drawStyle };
    }
    case 'SET_FIREBASE_PRIZES': {
      return {
        ...state,
        prizes: action.payload,
      };
    }
    case 'SET_FIREBASE_PRIZE_TIERS': {
      return {
        ...state,
        prizeTiers: action.payload,
      };
    }
    case 'ADD_PRIZE_TIER': {
      if (!state.currentUser || !state.currentUser.isAdmin) return state;
      const newTier: PrizeTier = {
        ...action.payload,
        id: `tier-${Date.now()}`,
      };
      return {
        ...state,
        prizeTiers: [...state.prizeTiers, newTier],
      };
    }
    case 'UPDATE_PRIZE_TIER': {
      if (!state.currentUser || !state.currentUser.isAdmin) return state;
      return {
        ...state,
        prizeTiers: state.prizeTiers.map(tier =>
          tier.id === action.payload.id ? action.payload : tier
        ),
      };
    }
    case 'DELETE_PRIZE_TIER': {
      if (!state.currentUser || !state.currentUser.isAdmin) return state;
      const { tierId } = action.payload;
      // Remove tier assignment from all prizes in this tier
      const updatedPrizes = state.prizes.map(prize => 
        prize.tierId === tierId ? { ...prize, tierId: undefined } : prize
      );
      return {
        ...state,
        prizeTiers: state.prizeTiers.filter(tier => tier.id !== tierId),
        prizes: updatedPrizes,
      };
    }
    case 'DRAW_TIER_WINNERS': {
      if (!state.currentUser || !state.currentUser.isAdmin) return state;
      if (state.pendingConflict) {
        return {
          ...state,
          lastAction: { type: 'WINNER_CONFLICT_PENDING', message: 'Resolve the existing winner conflict before drawing more prizes.' },
        };
      }
      
      const { tierId } = action.payload;
      const tierPrizes = state.prizes.filter(prize => prize.tierId === tierId);
      
      if (tierPrizes.length === 0) {
        return {
          ...state,
          lastAction: { type: 'ERROR', message: 'No prizes found in this tier' },
        };
      }
      
      const newWinners = { ...state.winners };
      const shuffledPrizes = [...tierPrizes].sort(() => Math.random() - 0.5);
      const assignedWinners = new Set<string>(Object.values(newWinners).flat());
      let conflict: { id: string; userId: string; userName?: string; existingPrizeId: string; newPrizeId: string } | null = null;

      for (const prize of shuffledPrizes) {
        if (prize.entries.length === 0) continue;

        const desiredWinners = prize.numberOfWinners || 1;
        const currentPrizeWinners = newWinners[prize.id] || [];
        if (currentPrizeWinners.length >= desiredWinners) continue;

        const slotsToFill = desiredWinners - currentPrizeWinners.length;

        for (let i = 0; i < slotsToFill; i++) {
          const { winnerId, conflictPrizeId } = pickWinnerWithConflictCheck(prize, newWinners, assignedWinners, state.allUsers);

          if (!winnerId) break;

          if (conflictPrizeId) {
            conflict = {
              id: `conflict-${Date.now()}`,
              userId: winnerId,
              userName: state.allUsers[winnerId]?.name,
              existingPrizeId: conflictPrizeId,
              newPrizeId: prize.id,
            };
            break;
          }

          currentPrizeWinners.push(winnerId);
          assignedWinners.add(winnerId);
        }

        newWinners[prize.id] = currentPrizeWinners;

        if (conflict) break;
      }

      if (conflict) {
        import('@/lib/firebaseService').then(async ({ saveWinners }) => {
          try {
            await saveWinners(newWinners);
          } catch (error) {
            console.error('Failed to save winners before resolving conflict:', error);
          }
        });

        return {
          ...state,
          winners: newWinners,
          pendingConflict: conflict,
          drawsPaused: true,
          lastAction: { type: 'WINNER_CONFLICT', message: `${conflict.userName || 'Selected user'} already holds another prize. Resolve the conflict to continue.` },
        };
      }

      // Save all winners to Firebase
      import('@/lib/firebaseService').then(async ({ saveWinners }) => {
        try {
          await saveWinners(newWinners);
        } catch (error) {
          console.error('Failed to save tier winners to Firebase:', error);
        }
      });

      const tier = state.prizeTiers.find(t => t.id === tierId);
      return {
        ...state,
        winners: newWinners,
        pendingConflict: null,
        drawsPaused: false,
        lastAction: { type: 'TIER_WINNERS_DRAWN', message: `Winners drawn for ${tier?.name || 'tier'}` },
      };
    }
    case 'RESOLVE_WINNER_CONFLICT': {
      const conflict = state.pendingConflict;
      if (!conflict || conflict.id !== action.payload.conflictId) return state;

      const { keepPrizeId, dropPrizeId, userId } = action.payload;
      const updatedWinners = { ...state.winners };

      // Ensure the kept prize is assigned to the user
      updatedWinners[keepPrizeId] = [userId];

      // Vacate the dropped prize before redrawing
      delete updatedWinners[dropPrizeId];

      const dropPrize = state.prizes.find(p => p.id === dropPrizeId);
      let nextConflict: { id: string; userId: string; userName?: string; existingPrizeId: string; newPrizeId: string } | null = null;

      if (dropPrize && dropPrize.entries.some(entry => entry.numTickets > 0)) {
        const { winnerId, conflictPrizeId } = pickWinnerWithConflictCheck(
          dropPrize,
          updatedWinners,
          new Set([userId]),
          state.allUsers
        );

        if (winnerId && !conflictPrizeId) {
          updatedWinners[dropPrizeId] = [winnerId];
        } else if (winnerId && conflictPrizeId) {
          nextConflict = {
            id: `conflict-${Date.now()}`,
            userId: winnerId,
            userName: state.allUsers[winnerId]?.name,
            existingPrizeId: conflictPrizeId,
            newPrizeId: dropPrizeId,
          };
        }
      }

      import('@/lib/firebaseService').then(async ({ saveWinners }) => {
        try {
          await saveWinners(updatedWinners);
        } catch (error) {
          console.error('Failed to save conflict resolution winners to Firebase:', error);
        }
      });

      return {
        ...state,
        winners: updatedWinners,
        pendingConflict: nextConflict,
        drawsPaused: !!nextConflict,
        lastAction: nextConflict
          ? { type: 'WINNER_CONFLICT', message: `${nextConflict.userName || 'Selected user'} already holds another prize. Resolve the conflict to continue.` }
          : { type: 'CONFLICT_RESOLVED', message: 'Winner conflict resolved and prize redrawn.' },
      };
    }
    case 'LOAD_USER_ALLOCATIONS': {
      if (!state.currentUser || state.currentUser.id !== action.payload.userId) {
        return state; // Only load allocations for the current user
      }
      
      return {
        ...state,
        currentUser: {
          ...state.currentUser,
          allocatedTickets: action.payload.allocatedTickets,
        },
      };
    }
    case 'UPSERT_ALL_USERS': {
      const updatedUsers: typeof state.allUsers = { ...state.allUsers };

      Object.entries(action.payload).forEach(([userId, userData]) => {
        const normalizedId = userData.id || userId;
        const existing = updatedUsers[userId] ?? { id: normalizedId, name: '' };
        updatedUsers[userId] = {
          ...existing,
          ...userData,
          id: normalizedId,
        };
      });

      return {
        ...state,
        allUsers: updatedUsers,
      };
    }
    case 'UPDATE_PROFILE_PICTURE': {
      const { userId, profilePictureUrl } = action.payload;
      if (!state.currentUser || state.currentUser.id !== userId) {
        return state;
      }
      
      return {
        ...state,
        currentUser: {
          ...state.currentUser,
          profilePictureUrl,
        },
      };
    }
    case 'SYNC_WINNERS_FROM_FIREBASE': {
      return {
        ...state,
        winners: action.payload,
        winnersSynced: true,
        pendingConflict: null,
        drawsPaused: false,
      };
    }
    default:
      return state;
  }
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(auctionReducer, initialState);
  // True once Firebase Auth has told us whether someone is signed in (and
  // their profile has loaded), so pages don't redirect before then.
  const [isHydrated, setIsHydrated] = React.useState(false);
  const [allocationsLoaded, setAllocationsLoaded] = React.useState<string | null>(null);
  const winnersRef = useRef(state.winners);
  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    currentUserIdRef.current = state.currentUser?.id ?? null;
  }, [state.currentUser]);

  // The signed-in user comes from Firebase Auth, which only the server's
  // login route can start (it checks the PIN). Admin rights come from the
  // token's admin claim, not from anything stored in the browser.
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    try {
      // Remove the old saved state, which included other users' PINs.
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // storage unavailable
    }

    (async () => {
      const [{ auth, db }, { onAuthStateChanged, signOut }, { doc, getDoc }] = await Promise.all([
        import('@/lib/firebase'),
        import('firebase/auth'),
        import('firebase/firestore'),
      ]);
      if (cancelled) return;

      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        try {
          if (!firebaseUser) {
            if (currentUserIdRef.current) dispatch({ type: 'LOGOUT_USER' });
            return;
          }

          const [tokenResult, profileSnap] = await Promise.all([
            firebaseUser.getIdTokenResult(),
            getDoc(doc(db, 'users', firebaseUser.uid)),
          ]);
          if (!profileSnap.exists()) {
            // User was deleted; end the session.
            await signOut(auth);
            return;
          }

          const profile = profileSnap.data() as FirebaseUser;
          const user: AppUser = {
            id: firebaseUser.uid,
            firstName: profile.firstName,
            lastName: profile.lastName,
            employeeId: profile.employeeId || firebaseUser.uid,
            facilityName: profile.facilityName,
            name: `${profile.firstName} ${profile.lastName}`,
            totalInitialTickets: profile.tickets || 0,
            allocatedTickets: {},
            status: profile.status || 'inactive',
            profilePictureUrl: profile.profilePictureUrl,
            isAdmin: tokenResult.claims.admin === true,
          };
          dispatch({ type: 'LOGIN_SUCCESS', payload: { user, userName: user.name } });
        } catch (error) {
          console.error('Failed to restore login:', error);
        } finally {
          setIsHydrated(true);
        }
      });
    })().catch((error) => {
      console.error('Firebase Auth unavailable:', error);
      setIsHydrated(true);
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const logout = React.useCallback(async () => {
    try {
      const [{ auth }, { signOut }] = await Promise.all([import('@/lib/firebase'), import('firebase/auth')]);
      await signOut(auth);
    } catch (error) {
      console.error('Sign-out failed:', error);
    }
    dispatch({ type: 'LOGOUT_USER' });
  }, []);

  // Create demo prizes and tiers in an empty database (admins only: nobody
  // else may write prizes).
  React.useEffect(() => {
    if (isHydrated && state.currentUser?.isAdmin) {
      import('@/lib/firebaseService').then(async ({ addPrize, getPrizes, addPrizeTier, getPrizeTiers }) => {
        try {
          const [existingPrizes, existingPrizeTiers] = await Promise.all([
            getPrizes(),
            getPrizeTiers()
          ]);
          
          // Add demo prize tiers if they don't exist
          if (existingPrizeTiers.length === 0) {
            await Promise.all([
              addPrizeTier({
                name: 'Grand Prize',
                description: 'The most valuable prizes',
                color: '#FFD700',
                order: 1,
              }),
              addPrizeTier({
                name: 'Premium',
                description: 'High-value prizes',
                color: '#C0C0C0',
                order: 2,
              }),
              addPrizeTier({
                name: 'Standard',
                description: 'Regular prizes',
                color: '#CD7F32',
                order: 3,
              })
            ]);
          }

          // Add demo prizes if they don't exist
          if (existingPrizes.length === 0) {
            await Promise.all([
              addPrize({
                name: 'Luxury Spa Day',
                description: 'A full day of pampering at a top-rated spa, including massage, facial, and more.',
                imageUrl: 'https://placehold.co/300x200.png',
                entries: [],
                totalTicketsInPrize: 0
              }),
              addPrize({
                name: 'Weekend Getaway',
                description: 'A two-night stay for two at a scenic countryside cabin.',
                imageUrl: 'https://placehold.co/300x200.png',
                entries: [],
                totalTicketsInPrize: 0
              }),
              addPrize({
                name: 'Tech Gadget Bundle',
                description: 'Latest smartwatch, wireless earbuds, and a portable charger.',
                imageUrl: 'https://placehold.co/300x200.png',
                entries: [],
                totalTicketsInPrize: 0
              })
            ]);
          }
        } catch (error) {
          console.error('Error adding demo prizes and tiers:', error);
        }
      });
    }
  }, [isHydrated, state.currentUser?.isAdmin]);

  // Load user allocations from Firebase when user logs in
  React.useEffect(() => {
    if (state.currentUser && state.lastAction?.type === 'LOGIN_SUCCESS' && allocationsLoaded !== state.currentUser.id) {
      // Add a small delay to avoid race conditions with user input
      const timer = setTimeout(() => {
        import('@/lib/firebaseService').then(async ({ getUserAllocations }) => {
          try {
            const firebaseAllocations = await getUserAllocations(state.currentUser!.id);
            dispatch({
              type: 'LOAD_USER_ALLOCATIONS',
              payload: {
                userId: state.currentUser!.id,
                allocatedTickets: firebaseAllocations,
              },
            });
            setAllocationsLoaded(state.currentUser!.id);
          } catch (error) {
            console.error('Failed to load user allocations from Firebase:', error);
          }
        });
      }, 1000); // 1 second delay
      
      return () => clearTimeout(timer);
    }
  }, [state.currentUser, state.lastAction, allocationsLoaded]);

  // Reset allocations loaded flag when user logs out
  React.useEffect(() => {
    if (!state.currentUser) {
      setAllocationsLoaded(null);
    }
  }, [state.currentUser]);

  // The server rejected an allocation: reload the user's real allocations.
  React.useEffect(() => {
    const reload = () => {
      const userId = currentUserIdRef.current;
      if (!userId) return;
      import('@/lib/firebaseService')
        .then(({ getUserAllocations }) => getUserAllocations(userId))
        .then((allocatedTickets) => dispatch({ type: 'LOAD_USER_ALLOCATIONS', payload: { userId, allocatedTickets } }))
        .catch((error) => console.error('Failed to reload allocations:', error));
    };
    window.addEventListener(ALLOCATION_FAILED_EVENT, reload);
    return () => window.removeEventListener(ALLOCATION_FAILED_EVENT, reload);
  }, []);

  // Load Firebase data on mount and set up real-time listeners
  // Keep winnersRef in sync with latest state so the Firebase listener
  // always compares against the current value (avoids stale closure).
  useEffect(() => {
    winnersRef.current = state.winners;
  }, [state.winners]);

  React.useEffect(() => {
    let winnersUnsubscribe: (() => void) | null = null;
    let prizesUnsubscribe: (() => void) | null = null;
    let settingsUnsubscribe: (() => void) | null = null;

    const setupFirebaseData = async () => {
      try {
        // Load Firebase prizes and users first
        const { 
          getPrizes, 
          getUsers, 
          getPrizeTiers,
          convertFirebasePrizeToAppPrize,
          convertFirebasePrizeTierToAppTier,
        } = await import('@/lib/firebaseService');
        const { collection, onSnapshot, query, orderBy, doc } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');

        // Admin's "close ticket allocation" switch, live for everyone.
        settingsUnsubscribe = onSnapshot(
          doc(db, 'settings', 'lottery'),
          (snap) => {
            const open = !snap.exists() || snap.data().allocationsOpen !== false;
            dispatch({ type: 'SET_ALLOCATIONS_OPEN', payload: { open } });
            // Admin's choice of draw animation, so the projector follows it live.
            const drawStyle = snap.exists() && snap.data().drawStyle === 'wheel' ? 'wheel' : 'slot';
            dispatch({ type: 'SET_DRAW_STYLE', payload: { drawStyle } });
          },
          (error) => console.error('Settings listener error:', error)
        );
        
        // Load Firebase data
        const [firebasePrizes, firebaseUsers, firebaseTiers] = await Promise.all([
          getPrizes(),
          getUsers(), 
          getPrizeTiers()
        ]);
        
        // Convert and set Firebase prizes
        if (firebasePrizes.length > 0) {
          const convertedPrizes = firebasePrizes.map(convertFirebasePrizeToAppPrize);
          dispatch({ type: 'SET_FIREBASE_PRIZES', payload: convertedPrizes });
        }
        
        // Set Firebase prize tiers
        if (firebaseTiers.length > 0) {
          const convertedTiers = firebaseTiers.map(convertFirebasePrizeTierToAppTier);
          dispatch({ type: 'SET_FIREBASE_PRIZE_TIERS', payload: convertedTiers });
        }
        
        // Public user directory (names, facilities, photos; no PINs)
        if (firebaseUsers.length > 0) {
          const usersMap = toDirectory(firebaseUsers);
          dispatch({ type: 'UPSERT_ALL_USERS', payload: usersMap });
        }
        
        // Keep prizes (and their ticket entries) live. Without this, each
        // browser keeps the entries it loaded at page load, so the admin would
        // draw winners from stale entries. Same ordering as getPrizes().
        prizesUnsubscribe = onSnapshot(
          query(collection(db, 'prizes'), orderBy('createdAt', 'desc')),
          (snapshot) => {
            if (snapshot.empty) return;
            const livePrizes = snapshot.docs.map((d) =>
              convertFirebasePrizeToAppPrize({ id: d.id, ...d.data() } as FirebasePrize)
            );
            dispatch({ type: 'SET_FIREBASE_PRIZES', payload: livePrizes });
          },
          (error) => console.error('Prizes listener error:', error)
        );

        // Now set up winners listener
        let receivedFirstWinners = false;
        winnersUnsubscribe = onSnapshot(collection(db, 'winners'), (snapshot) => {
          const winnersData: Record<string, string[]> = {};

          snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.prizeId && data.winnerId) {
              if (!winnersData[data.prizeId]) {
                winnersData[data.prizeId] = [];
              }
              winnersData[data.prizeId].push(data.winnerId);
            }
          });
          
          // Only dispatch if the winners data has actually changed
          const isWinnersDataEqual = (
            current: Record<string, string[]>,
            updated: Record<string, string[]>
          ): boolean => {
            const currentKeys = Object.keys(current);
            const updatedKeys = Object.keys(updated);

            if (currentKeys.length !== updatedKeys.length) {
              return false;
            }

            for (const key of currentKeys) {
              if (!updated.hasOwnProperty(key)) {
                return false;
              }

              const currentArray = current[key];
              const updatedArray = updated[key];

              if (currentArray.length !== updatedArray.length) {
                return false;
              }

              for (let i = 0; i < currentArray.length; i++) {
                if (currentArray[i] !== updatedArray[i]) {
                  return false;
                }
              }
            }

            return true;
          };

          // Always dispatch the first snapshot so winnersSynced gets set, even
          // when there are no winners yet.
          if (!receivedFirstWinners || !isWinnersDataEqual(winnersRef.current, winnersData)) {
            receivedFirstWinners = true;
            dispatch({
              type: 'SYNC_WINNERS_FROM_FIREBASE',
              payload: winnersData
            });
          }
        }, (error) => {
          console.error('Error listening to winners collection:', error);
        });
      } catch (error) {
        console.error('Error setting up Firebase data:', error);
      }
    };

    setupFirebaseData();

    // Cleanup listener on unmount
    return () => {
      if (winnersUnsubscribe) {
        winnersUnsubscribe();
      }
      if (prizesUnsubscribe) {
        prizesUnsubscribe();
      }
      if (settingsUnsubscribe) {
        settingsUnsubscribe();
      }
    };
  }, []); // Empty dependency array to run once on mount

  const remainingTickets = useMemo(() => {
    if (!state.currentUser) return 0;
    const allocatedSum = Object.values(state.currentUser.allocatedTickets).reduce((sum, count) => sum + count, 0);
    return state.currentUser.totalInitialTickets - allocatedSum;
  }, [state.currentUser]);

  const isAdmin = !!state.currentUser?.isAdmin;

  return (
    <AppContext.Provider value={{ state, dispatch, remainingTickets, isAdmin, isHydrated, logout }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

export const useFirebaseLogin = () => {
  const { dispatch } = useAppContext();

  // The server checks the PIN and returns a Firebase sign-in token. Signing in
  // with it fires the auth listener in AppProvider, which loads the profile
  // and dispatches LOGIN_SUCCESS.
  const loginWithFirebase = async (firstName: string, lastName: string, facilityName: string, pin: string) => {
    const partyCheckIn = typeof window !== 'undefined' && localStorage.getItem(PARTY_CHECKIN_FLAG_KEY) === 'true';
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, facilityName, pin, partyCheckIn }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.token) {
        dispatch({ type: 'LOGIN_ERROR', payload: { message: data.error || 'Login failed. Please try again.' } });
        return;
      }

      if (partyCheckIn) localStorage.removeItem(PARTY_CHECKIN_FLAG_KEY);
      const [{ auth }, { signInWithCustomToken }] = await Promise.all([import('@/lib/firebase'), import('firebase/auth')]);
      await signInWithCustomToken(auth, data.token);
    } catch (error) {
      console.error('Login error:', error);
      dispatch({ type: 'LOGIN_ERROR', payload: { message: 'Login failed. Please try again.' } });
    }
  };

  return { loginWithFirebase };
};

// Exported for test harnesses
export { auctionReducer, buildDrawingPool, pickWinnerWithConflictCheck, initialState };
