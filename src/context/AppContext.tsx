
"use client";
import type { Dispatch, ReactNode } from 'react';
import React, { createContext, useContext, useReducer, useMemo } from 'react';
import type { Prize, AppUser, AuctionContextState, AuctionAction } from '@/lib/types';
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

const initialState: AuctionContextState = {
  prizes: initialPrizes,
  currentUser: null, // No user logged in initially
  isAuctionOpen: true,
  winners: {},
  allUsers: {}, // Populated on login
};

const AppContext = createContext<{
  state: AuctionContextState;
  dispatch: Dispatch<AuctionAction>;
  remainingTickets: number;
  isAdmin: boolean; // Added isAdmin flag
}>({
  state: initialState,
  dispatch: () => null,
  remainingTickets: 0,
  isAdmin: false, // Default to false
});

const auctionReducer = (state: AuctionContextState, action: AuctionAction): AuctionContextState => {
  switch (action.type) {
    case 'LOGIN_USER': {
      const { firstName, lastName, employeeId } = action.payload;
      const userName = `${firstName} ${lastName}`;
      const existingUser = Object.values(state.allUsers).find(u => u.name === userName); 
      
      const newUser: AppUser = {
        id: employeeId, 
        firstName,
        lastName,
        employeeId,
        name: userName,
        totalInitialTickets: 100, 
        allocatedTickets: existingUser && state.currentUser?.id === employeeId ? state.currentUser.allocatedTickets : {}, 
      };
      
      toast({ title: "Login Successful", description: `Welcome, ${userName}!` });
      return {
        ...state,
        currentUser: newUser,
        allUsers: {
          ...state.allUsers,
          [employeeId]: { name: userName },
        },
      };
    }
    case 'LOGOUT_USER': {
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
      return {
        ...state,
        currentUser: null,
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
        toast({ title: "Not enough tickets", description: "You don't have enough tickets to make this allocation.", variant: "destructive" });
        return state;
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

      const updatedAllUsers = state.allUsers[userId] ? state.allUsers : { ...state.allUsers, [userId]: { name: userName }};

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
      toast({ title: "Winners Drawn!", description: "The auction has ended and winners have been selected."});
      return { ...state, winners: newWinners, isAuctionOpen: false };
    }
    case 'RESET_AUCTION': {
      if (!state.currentUser || !ADMIN_EMPLOYEE_IDS.includes(state.currentUser.employeeId)) return state; 
      const resetCurrentUser = state.currentUser ? {
        ...state.currentUser,
        allocatedTickets: {},
      } : null;

      return {
        ...initialState, 
        currentUser: resetCurrentUser, 
        allUsers: resetCurrentUser ? { [resetCurrentUser.id]: { name: resetCurrentUser.name } } : {}, 
        prizes: state.prizes.map(p => ({ ...p, entries: [], totalTicketsInPrize: 0 })), 
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

      return { ...state, winners: updatedWinners };
    }
    default:
      return state;
  }
};

// Load state from localStorage if available
const loadPersistedState = (): AuctionContextState => {
  if (typeof window === 'undefined') return initialState;
  
  try {
    const saved = localStorage.getItem('lotteryAppState');
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...initialState, ...parsed };
    }
  } catch (error) {
    console.error('Error loading persisted state:', error);
  }
  
  return initialState;
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(auctionReducer, loadPersistedState());

  // Save state to localStorage whenever it changes
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('lotteryAppState', JSON.stringify(state));
      } catch (error) {
        console.error('Error saving state to localStorage:', error);
      }
    }
  }, [state.currentUser, state.prizes, state.winners, state.isAuctionOpen, state.allUsers]);

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
    <AppContext.Provider value={{ state, dispatch, remainingTickets, isAdmin }}>
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
