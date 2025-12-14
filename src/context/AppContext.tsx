
"use client";
import type { Dispatch, ReactNode } from 'react';
import React, { createContext, useContext, useReducer, useMemo, useEffect } from 'react';
import type { Prize, AppUser, AuctionContextState, AuctionAction, PrizeTier } from '@/lib/types';
import { toast } from '@/hooks/use-toast';

// Define Admin Employee IDs here. In a real app, this would come from a secure config.
const ADMIN_EMPLOYEE_IDS = ['ADMIN001', 'DEV007']; // Example Admin IDs

const initialPrizes: Prize[] = [
  {
    id: 'prize1',
    name: 'Luxury Spa Day',
    description: 'A full day of pampering at a top-rated spa, including massage, facial, and more.',
    imageUrl: 'https://placehold.co/300x200.png',
    entries: [],
    totalTicketsInPrize: 0,
  },
  {
    id: 'prize2',
    name: 'Weekend Getaway',
    description: 'A two-night stay for two at a scenic countryside cabin.',
    imageUrl: 'https://placehold.co/300x200.png',
    entries: [],
    totalTicketsInPrize: 0,
  },
  {
    id: 'prize3',
    name: 'Tech Gadget Bundle',
    description: 'Latest smartwatch, wireless earbuds, and a portable charger.',
    imageUrl: 'https://placehold.co/300x200.png',
    entries: [],
    totalTicketsInPrize: 0,
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
  winners: {},
  allUsers: {
    // Pre-populated admin users
    'ADMIN001': { id: 'ADMIN001', name: 'Admin User', tickets: 100, facilityName: 'Admin Office', pin: 'admin123', status: 'working' },
    'DEV007': { id: 'DEV007', name: 'Developer Admin', tickets: 100, facilityName: 'Dev Office', pin: 'dev456', status: 'working' },
  },
};

const AppContext = createContext<{
  state: AuctionContextState;
  dispatch: Dispatch<AuctionAction>;
  remainingTickets: number;
  isAdmin: boolean;
  isHydrated: boolean;
}>({
  state: initialState,
  dispatch: () => null,
  remainingTickets: 0,
  isAdmin: false,
  isHydrated: false,
});

const auctionReducer = (state: AuctionContextState, action: AuctionAction): AuctionContextState => {
  switch (action.type) {
    case 'LOGIN_USER': {
      // This will be handled by the component now
      return {
        ...state,
        lastAction: { type: 'LOGIN_PENDING' },
      };
    }
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
      if (!state.currentUser || !ADMIN_EMPLOYEE_IDS.includes(state.currentUser.employeeId)) return state; 
      const newPrize: Prize = {
        ...action.payload,
        id: `prize-${Date.now()}`,
        entries: [],
        totalTicketsInPrize: 0,
      };
      return { ...state, prizes: [...state.prizes, newPrize] };
    }
    case 'UPDATE_PRIZE': {
      if (!state.currentUser || !ADMIN_EMPLOYEE_IDS.includes(state.currentUser.employeeId)) return state;
      return {
        ...state,
        prizes: state.prizes.map((p) =>
          p.id === action.payload.id ? { ...p, ...action.payload } : p
        ),
      };
    }
    case 'DELETE_PRIZE': {
      if (!state.currentUser || !ADMIN_EMPLOYEE_IDS.includes(state.currentUser.employeeId)) return state;
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


      // Save to Firebase
      import('@/lib/firebaseService').then(async ({ allocateTickets, updatePrizeEntries }) => {
        try {
          // Save the allocation to Firebase
          await allocateTickets({
            lotteryId: 'default', // Using default lottery ID
            prizeId,
            userId,
            userName,
            tickets: count,
            timestamp: new Date().toISOString()
          });
          
          // Update the prize entries in Firebase
          await updatePrizeEntries(prizeId, updatedEntries);
          
          console.log('Firebase allocation saved successfully');
        } catch (error) {
          console.error('Failed to save allocation to Firebase:', error);
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
      if (!state.currentUser || !ADMIN_EMPLOYEE_IDS.includes(state.currentUser.employeeId) || !state.isAuctionOpen) return state;

      const newWinners: Record<string, string> = {};
      const usersWhoWon = new Set<string>();
      const shuffledPrizes = [...state.prizes].sort(() => Math.random() - 0.5);

      for (const prize of shuffledPrizes) {
        if (prize.entries.length === 0) continue;

        const drawingPool: string[] = [];
        prize.entries.forEach(entry => {
          for (let i = 0; i < entry.numTickets; i++) {
            drawingPool.push(entry.userId);
          }
        });
        
        const eligiblePool = drawingPool.filter(userId => !usersWhoWon.has(userId));

        if (eligiblePool.length > 0) {
          const winnerIndex = Math.floor(Math.random() * eligiblePool.length);
          const winnerId = eligiblePool[winnerIndex];
          newWinners[prize.id] = winnerId;
          usersWhoWon.add(winnerId);
        }
      }

      // Save all winners to Firebase
      import('@/lib/firebaseService').then(async ({ saveWinners }) => {
        try {
          await saveWinners(newWinners);
        } catch (error) {
          console.error('Failed to save all winners to Firebase:', error);
        }
      });

      return {
        ...state,
        winners: newWinners,
        isAuctionOpen: false,
        lastAction: { type: 'WINNERS_DRAWN' },
      };
    }
    case 'DRAW_SINGLE_WINNER': {
      if (!state.currentUser || !ADMIN_EMPLOYEE_IDS.includes(state.currentUser.employeeId)) return state;

      const { prizeId } = action.payload;
      const prize = state.prizes.find(p => p.id === prizeId);
      if (!prize || prize.entries.length === 0) {
        return {
          ...state,
          lastAction: { type: 'NO_ENTRIES_ERROR', prizeName: prize?.name || 'Unknown Prize' },
        };
      }

      // Check if this prize already has a winner
      if (state.winners[prizeId]) {
        return {
          ...state,
          lastAction: { type: 'ERROR', message: 'This prize already has a winner. Use redraw if needed.' },
        };
      }

      // Create drawing pool for this prize
      const drawingPool: string[] = [];
      prize.entries.forEach(entry => {
        for (let i = 0; i < entry.numTickets; i++) {
          drawingPool.push(entry.userId);
        }
      });

      // Filter out users who already won other prizes
      const usersWhoWon = new Set(Object.values(state.winners));
      const eligiblePool = drawingPool.filter(userId => !usersWhoWon.has(userId));

      if (eligiblePool.length === 0) {
        return {
          ...state,
          lastAction: { type: 'ERROR', message: 'No eligible participants for this prize (all may have won other prizes).' },
        };
      }

      // Draw the winner
      const winnerIndex = Math.floor(Math.random() * eligiblePool.length);
      const winnerId = eligiblePool[winnerIndex];
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
        winners: { ...state.winners, [prizeId]: winnerId },
        lastAction: { type: 'SINGLE_WINNER_DRAWN', winnerName, prizeName: prize.name },
      };
    }
    case 'RESET_AUCTION': {
      if (!state.currentUser || !ADMIN_EMPLOYEE_IDS.includes(state.currentUser.employeeId)) return state; 
      
      // Clear allocations, prize entries, and winners from Firebase
      import('@/lib/firebaseService').then(async ({ resetAuctionData }) => {
        try {
          await resetAuctionData();
          console.log('Auction data reset in Firebase');
        } catch (error) {
          console.error('Failed to reset auction data in Firebase:', error);
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
        allUsers: resetCurrentUser ? { [resetCurrentUser.id]: { id: resetCurrentUser.id, name: resetCurrentUser.name } } : {}, 
        prizes: state.prizes.map(p => ({ ...p, entries: [], totalTicketsInPrize: 0 })), 
        prizeTiers: state.prizeTiers,
      };
    }
    case 'REDRAW_PRIZE_WINNER': {
      if (!state.currentUser || !ADMIN_EMPLOYEE_IDS.includes(state.currentUser.employeeId) || state.isAuctionOpen) {
        toast({ title: "Action Denied", description: "Admin login required or auction must be closed.", variant: "destructive" });
        return state;
      }

      const { prizeId } = action.payload;
      const prize = state.prizes.find(p => p.id === prizeId);
      if (!prize) {
        toast({ title: "Prize Not Found", variant: "destructive" });
        return state;
      }

      if (prize.entries.length === 0 || prize.entries.every(e => e.numTickets === 0)) {
        toast({ title: "No Entries", description: `No tickets entered for ${prize.name} to draw from.`, variant: "destructive" });
        return state;
      }

      const originalWinnerId = state.winners[prizeId];
      const fixedOtherWinners = new Set<string>();
      Object.entries(state.winners).forEach(([pID, winnerUserID]) => {
        if (pID !== prizeId && winnerUserID) {
          fixedOtherWinners.add(winnerUserID);
        }
      });
      
      const eligibleUsersForRedraw = new Set<string>();
      prize.entries.forEach(entry => {
        if (entry.numTickets > 0 && entry.userId !== originalWinnerId && !fixedOtherWinners.has(entry.userId)) {
          eligibleUsersForRedraw.add(entry.userId);
        }
      });

      if (eligibleUsersForRedraw.size === 0) {
        const updatedWinners = { ...state.winners };
        delete updatedWinners[prizeId];
        toast({ title: "Re-draw Result", description: `No eligible alternative winner could be found for ${prize.name}. The prize is now unwon.` });
        return { ...state, winners: updatedWinners };
      }

      const finalEligibleDrawingPool: string[] = [];
      prize.entries.forEach(entry => {
        if (eligibleUsersForRedraw.has(entry.userId)) { 
          for (let i = 0; i < entry.numTickets; i++) {
            finalEligibleDrawingPool.push(entry.userId);
          }
        }
      });
      
      if (finalEligibleDrawingPool.length === 0) {
        const updatedWinners = { ...state.winners };
        delete updatedWinners[prizeId];
        toast({ title: "Re-draw Error", description: `Could not form a drawing pool for ${prize.name}. The prize is now unwon.` });
        return { ...state, winners: updatedWinners };
      }

      const newWinnerIndex = Math.floor(Math.random() * finalEligibleDrawingPool.length);
      const newWinnerId = finalEligibleDrawingPool[newWinnerIndex];
      
      const updatedWinners = { ...state.winners, [prizeId]: newWinnerId };
      const newWinnerName = state.allUsers[newWinnerId]?.name || 'Unknown User';
      toast({ title: "Winner Re-drawn!", description: `${newWinnerName} is the new winner of ${prize.name}.` });

      // Save winner to Firebase
      import('@/lib/firebaseService').then(async ({ saveWinner }) => {
        try {
          await saveWinner(prizeId, newWinnerId);
        } catch (error) {
          console.error('Failed to save redrawn winner to Firebase:', error);
        }
      });

      return { ...state, winners: updatedWinners };
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
      if (!state.currentUser || !ADMIN_EMPLOYEE_IDS.includes(state.currentUser.employeeId)) return state;
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
      if (!state.currentUser || !ADMIN_EMPLOYEE_IDS.includes(state.currentUser.employeeId)) return state;
      return {
        ...state,
        prizeTiers: state.prizeTiers.map(tier =>
          tier.id === action.payload.id ? action.payload : tier
        ),
      };
    }
    case 'DELETE_PRIZE_TIER': {
      if (!state.currentUser || !ADMIN_EMPLOYEE_IDS.includes(state.currentUser.employeeId)) return state;
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
      if (!state.currentUser || !ADMIN_EMPLOYEE_IDS.includes(state.currentUser.employeeId)) return state;
      
      const { tierId } = action.payload;
      const tierPrizes = state.prizes.filter(prize => prize.tierId === tierId);
      
      if (tierPrizes.length === 0) {
        return {
          ...state,
          lastAction: { type: 'ERROR', message: 'No prizes found in this tier' },
        };
      }
      
      const newWinners = { ...state.winners };
      const usersWhoWon = new Set(Object.values(state.winners));
      const shuffledPrizes = [...tierPrizes].sort(() => Math.random() - 0.5);
      
      for (const prize of shuffledPrizes) {
        if (prize.entries.length === 0) continue;
        if (newWinners[prize.id]) continue; // Skip if already has winner
        
        const drawingPool: string[] = [];
        prize.entries.forEach(entry => {
          for (let i = 0; i < entry.numTickets; i++) {
            drawingPool.push(entry.userId);
          }
        });
        
        const eligiblePool = drawingPool.filter(userId => !usersWhoWon.has(userId));
        
        if (eligiblePool.length > 0) {
          const winnerIndex = Math.floor(Math.random() * eligiblePool.length);
          const winnerId = eligiblePool[winnerIndex];
          newWinners[prize.id] = winnerId;
          usersWhoWon.add(winnerId);
        }
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
        lastAction: { type: 'TIER_WINNERS_DRAWN', message: `Winners drawn for ${tier?.name || 'tier'}` },
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
    case 'UPLOAD_USERS': {
      if (!state.currentUser || !ADMIN_EMPLOYEE_IDS.includes(state.currentUser.employeeId)) {
        return {
          ...state,
          lastAction: { type: 'ACCESS_DENIED', message: "Admin login required to upload users." },
        };
      }

      const newUsers: Record<string, AuctionContextState['allUsers'][string]> = {};
      
      action.payload.forEach((userData) => {
        const userName = `${userData.firstName} ${userData.lastName}`;
        // Create deterministic user ID based on unique user info
        const userId = `user_${userName.replace(/\s+/g, '_').toLowerCase()}_${userData.facilityName.replace(/\s+/g, '_').toLowerCase()}_${userData.pin}`;
        
        newUsers[userId] = {
          id: userId,
          name: userName,
          tickets: userData.tickets,
          facilityName: userData.facilityName,
          pin: userData.pin,
          status: userData.status || 'inactive',
        };
      });

      return {
        ...state,
        allUsers: {
          ...state.allUsers,
          ...newUsers,
        },
        lastAction: { type: 'USERS_UPLOADED', message: `Successfully uploaded ${action.payload.length} users` },
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
      };
    }
    default:
      return state;
  }
};

// Load state from localStorage if available
const loadPersistedState = (): AuctionContextState => {
  return initialState; // Always return initial state for SSR
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(auctionReducer, loadPersistedState());
  const [isHydrated, setIsHydrated] = React.useState(false);
  const [allocationsLoaded, setAllocationsLoaded] = React.useState<string | null>(null);

  // Hydrate from localStorage on client side only
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('lotteryAppState');
        if (saved) {
          const parsed = JSON.parse(saved);
          // Merge persisted allUsers with initial admin users
          const mergedUsers: Record<string, AuctionContextState['allUsers'][string]> = {
            ...initialState.allUsers,
            ...parsed.allUsers,
          };

          const normalizedUsers = (Object.entries(mergedUsers) as Array<[string, AuctionContextState['allUsers'][string]]>).reduce(
            (acc, [userId, user]) => {
              acc[userId] = {
                ...user,
                id: user.id || userId,
              };
              return acc;
            },
            {} as Record<string, AuctionContextState['allUsers'][string]>
          );
          
          // Restore state from localStorage but exclude winners (they come from Firebase)
          const restoredState = { 
            ...initialState, 
            ...parsed,
            winners: {}, // Always start with empty winners - Firebase will populate
            allUsers: normalizedUsers,
            currentUser: parsed.currentUser || null,
            prizeTiers: parsed.prizeTiers || initialPrizeTiers
          };
          
          if (parsed.currentUser) {
            dispatch({
              type: 'LOGIN_SUCCESS',
              payload: { user: parsed.currentUser, userName: parsed.currentUser.name }
            });
          }
        }
      } catch (error) {
        console.error('Error loading persisted state:', error);
      }
      setIsHydrated(true);
    }
  }, []);

  // Add demo prizes and prize tiers to Firebase if they don't exist
  React.useEffect(() => {
    if (isHydrated && state.currentUser) {
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
            console.log('Demo prize tiers added to Firebase');
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
            console.log('Demo prizes added to Firebase');
          }
        } catch (error) {
          console.error('Error adding demo prizes and tiers:', error);
        }
      });
    }
  }, [isHydrated, state.currentUser]);

  // Load user allocations from Firebase when user logs in
  React.useEffect(() => {
    if (state.currentUser && state.lastAction?.type === 'LOGIN_SUCCESS' && allocationsLoaded !== state.currentUser.id) {
      // Add a small delay to avoid race conditions with user input
      const timer = setTimeout(() => {
        import('@/lib/firebaseService').then(async ({ getUserAllocations }) => {
          try {
            const firebaseAllocations = await getUserAllocations(state.currentUser!.id);
            console.log('Loaded user allocations from Firebase:', firebaseAllocations);
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

  // Save state to localStorage whenever it changes
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('lotteryAppState', JSON.stringify(state));
      } catch (error) {
        console.error('Error saving state to localStorage:', error);
      }
    }
  }, [state.currentUser, state.prizes, state.winners, state.isAuctionOpen, state.allUsers, state.prizeTiers]);

  // Load Firebase data on mount and set up real-time listeners
  React.useEffect(() => {
    let winnersUnsubscribe: (() => void) | null = null;
    
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
        const { collection, onSnapshot } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        
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
        
        // Set Firebase users
        if (firebaseUsers.length > 0) {
          const usersMap = firebaseUsers.reduce<Record<string, AuctionContextState['allUsers'][string]>>((acc, user) => {
            const userObj = {
              id: user.id || user.employeeId,
              name: `${user.firstName} ${user.lastName}`,
              tickets: user.tickets,
              facilityName: user.facilityName,
              pin: user.pin,
              profilePictureUrl: user.profilePictureUrl,
              status: user.status || 'inactive',
            };

            // Map by Firebase document ID (used for winners)
            if (user.id) {
              acc[user.id] = userObj;
            }

            // Also map by employeeId (used for allocations)
            if (user.employeeId) {
              acc[user.employeeId] = userObj;
            }

            return acc;
          }, {});

          // Ensure admin users are always included in the mapping
          const adminUsers = {
            'ADMIN001': { id: 'ADMIN001', name: 'Admin User', tickets: 100, facilityName: 'Admin Office', pin: 'admin123', status: 'working' },
            'DEV007': { id: 'DEV007', name: 'Developer Admin', tickets: 100, facilityName: 'Dev Office', pin: 'dev456', status: 'working' },
          };

          // Add admin users to the mapping
          Object.entries(adminUsers).forEach(([id, user]) => {
            usersMap[id] = user;
          });

          dispatch({ type: 'UPSERT_ALL_USERS', payload: usersMap });
        }
        
        // Now set up winners listener
        winnersUnsubscribe = onSnapshot(collection(db, 'winners'), (snapshot) => {
          const winnersData: Record<string, string> = {};
          
          snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.prizeId && data.winnerId) {
              winnersData[data.prizeId] = data.winnerId;
            }
          });
          
          // Only dispatch if the winners data has actually changed
          const currentWinnersString = JSON.stringify(state.winners);
          const newWinnersString = JSON.stringify(winnersData);
          
          if (currentWinnersString !== newWinnersString) {
            console.log('Winners updated from Firebase:', winnersData);
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
    };
  }, []); // Empty dependency array to run once on mount

  const remainingTickets = useMemo(() => {
    if (!state.currentUser) return 0;
    const allocatedSum = Object.values(state.currentUser.allocatedTickets).reduce((sum, count) => sum + count, 0);
    return state.currentUser.totalInitialTickets - allocatedSum;
  }, [state.currentUser]);

  const isAdmin = useMemo(() => {
    if (!state.currentUser) return false;
    return ADMIN_EMPLOYEE_IDS.includes(state.currentUser.employeeId);
  }, [state.currentUser]);

  return (
    <AppContext.Provider value={{ state, dispatch, remainingTickets, isAdmin, isHydrated }}>
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
  
  const loginWithFirebase = async (firstName: string, lastName: string, facilityName: string, pin: string) => {
    const userName = `${firstName} ${lastName}`;
    
    console.log('Login attempt:', { firstName, lastName, facilityName, pin, userName });
    
    try {
      const { getUserByCredentials } = await import('@/lib/firebaseService');
      const firebaseUser = await getUserByCredentials(firstName, lastName, facilityName, pin);
      
      if (!firebaseUser) {
        console.log('Login failed - no matching user found in Firebase');
        dispatch({
          type: 'LOGIN_ERROR',
          payload: { message: 'Invalid credentials' }
        });
        return;
      }
      
      console.log('Firebase user found:', firebaseUser);
      
      const newUser: AppUser = {
        id: firebaseUser.id || firebaseUser.employeeId,
        firstName: firebaseUser.firstName,
        lastName: firebaseUser.lastName,
        employeeId: firebaseUser.employeeId,
        facilityName: firebaseUser.facilityName,
        name: userName,
        totalInitialTickets: firebaseUser.tickets,
        allocatedTickets: {},
        status: firebaseUser.status || 'inactive',
        profilePictureUrl: firebaseUser.profilePictureUrl,
      };
      
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: { user: newUser, userName }
      });
    } catch (error) {
      console.error('Firebase login error:', error);
      dispatch({
        type: 'LOGIN_ERROR',
        payload: { message: 'Login failed. Please try again.' }
      });
    }
  };
  
  return { loginWithFirebase };
};
