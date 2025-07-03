
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
  allUsers: {
    // Pre-populated admin users
    'ADMIN001': { name: 'Admin User', tickets: 100, facilityName: 'Admin Office', pin: 'admin123' },
    'DEV007': { name: 'Developer Admin', tickets: 100, facilityName: 'Dev Office', pin: 'dev456' },
  },
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
      const { firstName, lastName, facilityName, pin } = action.payload;
      const userName = `${firstName} ${lastName}`;
      
      // Find user in uploaded users with matching credentials
      const userEntry = Object.entries(state.allUsers).find(([_, userData]) => 
        userData.name === userName && 
        userData.facilityName === facilityName && 
        userData.pin === pin
      );
      
      if (!userEntry) {
          return state;
      }
      
      const [userId, existingUserData] = userEntry;
      const ticketCount = existingUserData.tickets || 100;
      
      const newUser: AppUser = {
        id: userId, 
        firstName,
        lastName,
        employeeId: userId, // Using userId as employeeId for now
        facilityName,
        name: userName,
        totalInitialTickets: ticketCount, 
        allocatedTickets: state.currentUser?.id === userId ? state.currentUser.allocatedTickets : {}, 
      };
      
      return {
        ...state,
        currentUser: newUser,
        lastAction: { type: 'LOGIN_SUCCESS', userName },
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

      return {
        ...state,
        winners: { ...state.winners, [prizeId]: winnerId },
        lastAction: { type: 'SINGLE_WINNER_DRAWN', winnerName, prizeName: prize.name },
      };
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
        allUsers: {
          ...initialState.allUsers, // Always preserve admin users
          ...Object.fromEntries(
            Object.entries(state.allUsers).filter(([_, user]) => 
              user.name !== 'Admin User' && user.name !== 'Developer Admin'
            )
          )
        }, 
        prizes: state.prizes.map(p => ({ ...p, entries: [], totalTicketsInPrize: 0 })), 
        lastAction: { type: 'AUCTION_RESET' },
      };
    }
    case 'REDRAW_PRIZE_WINNER': {
      if (!state.currentUser || !ADMIN_EMPLOYEE_IDS.includes(state.currentUser.employeeId) || state.isAuctionOpen) {
        return {
          ...state,
          lastAction: { type: 'ACTION_DENIED', message: "Admin login required or auction must be closed." },
        };
      }

      const { prizeId } = action.payload;
      const prize = state.prizes.find(p => p.id === prizeId);
      if (!prize) {
        return {
          ...state,
          lastAction: { type: 'ERROR', message: "Prize Not Found" },
        };
      }

      if (prize.entries.length === 0 || prize.entries.every(e => e.numTickets === 0)) {
        return {
          ...state,
          lastAction: { type: 'NO_ENTRIES_ERROR', prizeName: prize.name },
        };
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
        return { 
          ...state, 
          winners: updatedWinners,
          lastAction: { type: 'REDRAW_NO_WINNER', prizeName: prize.name },
        };
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
        return { 
          ...state, 
          winners: updatedWinners,
          lastAction: { type: 'REDRAW_ERROR', prizeName: prize.name },
        };
      }

      const newWinnerIndex = Math.floor(Math.random() * finalEligibleDrawingPool.length);
      const newWinnerId = finalEligibleDrawingPool[newWinnerIndex];
      
      const updatedWinners = { ...state.winners, [prizeId]: newWinnerId };
      const newWinnerName = state.allUsers[newWinnerId]?.name || 'Unknown User';
      return { 
        ...state, 
        winners: updatedWinners,
        lastAction: { type: 'WINNER_REDRAWN', winnerName: newWinnerName, prizeName: prize.name },
      };
    }
    case 'ADD_FIREBASE_USER': {
      // Add a single Firebase user to allUsers without admin check
      const userData = action.payload;
      const userName = `${userData.firstName} ${userData.lastName}`;
      // Create deterministic user ID based on unique user info
      const userId = `user_${userName.replace(/\s+/g, '_').toLowerCase()}_${userData.facilityName.replace(/\s+/g, '_').toLowerCase()}_${userData.pin}`;
      
      const newUser = {
        name: userName,
        tickets: userData.tickets,
        facilityName: userData.facilityName,
        pin: userData.pin,
      };

      return {
        ...state,
        allUsers: {
          ...state.allUsers,
          [userId]: newUser,
        },
      };
    }
    case 'SET_FIREBASE_PRIZES': {
      return {
        ...state,
        prizes: action.payload,
      };
    }
    case 'SYNC_USER_ALLOCATIONS': {
      if (!state.currentUser || state.currentUser.id !== action.payload.userId) {
        return state;
      }
      
      return {
        ...state,
        currentUser: {
          ...state.currentUser,
          allocatedTickets: action.payload.allocatedTickets,
        },
      };
    }
    case 'UPLOAD_USERS': {
      if (!state.currentUser || !ADMIN_EMPLOYEE_IDS.includes(state.currentUser.employeeId)) {
        return {
          ...state,
          lastAction: { type: 'ACCESS_DENIED', message: "Admin login required to upload users." },
        };
      }

      const newUsers: Record<string, { name: string; tickets: number; facilityName: string }> = {};
      
      action.payload.forEach((userData, index) => {
        const userName = `${userData.firstName} ${userData.lastName}`;
        // Create deterministic user ID based on unique user info
        const userId = `user_${userName.replace(/\s+/g, '_').toLowerCase()}_${userData.facilityName.replace(/\s+/g, '_').toLowerCase()}_${userData.pin}`;
        
        newUsers[userId] = {
          name: userName,
          tickets: userData.tickets,
          facilityName: userData.facilityName,
          pin: userData.pin,
        };
      });

      return {
        ...state,
        allUsers: {
          ...state.allUsers,
          ...newUsers,
        },
      };
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
      // Merge persisted allUsers with initial admin users to ensure admins are always available
      const mergedUsers = {
        ...initialState.allUsers, // Start with admin users
        ...parsed.allUsers, // Add any persisted users from CSV uploads
      };
      
      // If there's a current user in localStorage, restore them
      let restoredCurrentUser = null;
      if (parsed.currentUser) {
        restoredCurrentUser = parsed.currentUser;
      }
      
      return { 
        ...initialState, 
        ...parsed,
        allUsers: mergedUsers,
        currentUser: restoredCurrentUser
      };
    }
  } catch (error) {
    console.error('Error loading persisted state:', error);
  }
  
  return initialState;
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(auctionReducer, loadPersistedState());

  // Handle toast notifications based on lastAction
  React.useEffect(() => {
    if (!state.lastAction) return;

    const action = state.lastAction;
    switch (action.type) {
      case 'LOGIN_SUCCESS':
        toast({ title: "Login Successful", description: `Welcome, ${action.userName}!` });
        break;
      case 'LOGOUT_SUCCESS':
        toast({ title: "Logged Out", description: "You have been successfully logged out." });
        break;
      case 'ALLOCATION_ERROR':
        toast({ title: "Not enough tickets", description: action.message, variant: "destructive" });
        break;
      case 'WINNERS_DRAWN':
        toast({ title: "Winners Drawn!", description: "The auction has ended and winners have been selected." });
        break;
      case 'AUCTION_RESET':
        toast({ title: "Auction Reset", description: "The auction has been reset to its initial state." });
        break;
      case 'ACTION_DENIED':
        toast({ title: "Action Denied", description: action.message, variant: "destructive" });
        break;
      case 'ERROR':
        toast({ title: action.message, variant: "destructive" });
        break;
      case 'NO_ENTRIES_ERROR':
        toast({ title: "No Entries", description: `No tickets entered for ${action.prizeName} to draw from.`, variant: "destructive" });
        break;
      case 'REDRAW_NO_WINNER':
        toast({ title: "Re-draw Result", description: `No eligible alternative winner could be found for ${action.prizeName}. The prize is now unwon.` });
        break;
      case 'REDRAW_ERROR':
        toast({ title: "Re-draw Error", description: `Could not form a drawing pool for ${action.prizeName}. The prize is now unwon.` });
        break;
      case 'WINNER_REDRAWN':
        toast({ title: "Winner Re-drawn!", description: `${action.winnerName} is the new winner of ${action.prizeName}.` });
        break;
      case 'SINGLE_WINNER_DRAWN':
        toast({ title: "Winner Drawn!", description: `${action.winnerName} won ${action.prizeName}!` });
        break;
      case 'ACCESS_DENIED':
        toast({ title: "Access Denied", description: action.message, variant: "destructive" });
        break;
    }
  }, [state.lastAction]);

  // Simplified persistence to prevent loops
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('lotteryAppState', JSON.stringify({
          allUsers: state.allUsers,
          prizes: state.prizes,
          winners: state.winners,
          isAuctionOpen: state.isAuctionOpen,
          currentUser: state.currentUser
        }));
      } catch (error) {
        console.error('Error saving state to localStorage:', error);
      }
    }
  }, [state.currentUser?.id, state.allUsers, state.isAuctionOpen, state.prizes]); // Include prizes to persist ticket allocations

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
