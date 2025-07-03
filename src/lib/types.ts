
export interface Prize {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  entries: { userId: string; numTickets: number }[];
  totalTicketsInPrize: number;
}

export interface AppUser {
  id: string; // Will use employeeId
  firstName: string;
  lastName: string;
  employeeId: string;
  facilityName?: string; // Added facility support
  name: string; // Combined from firstName and lastName
  totalInitialTickets: number;
  allocatedTickets: Record<string, number>; // prizeId -> count
}

export interface AuctionContextState {
  prizes: Prize[];
  currentUser: AppUser | null; // Can be null if no user is logged in
  isAuctionOpen: boolean;
  winners: Record<string, string>;
  allUsers: Record<string, { name: string; tickets?: number; facilityName?: string; pin?: string }>;
  lastAction?: { type: string; [key: string]: any };
}

export interface CSVUserData {
  firstName: string;
  lastName: string;
  facilityName: string;
  tickets: number;
  pin: string;
}

// Firebase types
export interface FirebaseUser {
  uid: string;
  email: string;
  displayName: string;
  facilityName: string;
  tickets: number;
  isAdmin: boolean;
  createdAt: string;
}

export interface FirebaseLottery {
  id: string;
  name: string;
  description: string;
  isOpen: boolean;
  createdBy: string;
  createdAt: string;
  prizes: Prize[];
}

export interface FirebaseAllocation {
  id: string;
  lotteryId: string;
  prizeId: string;
  userId: string;
  userName: string;
  tickets: number;
  timestamp: string;
}

export interface FirebaseWinner {
  id: string;
  lotteryId: string;
  prizeId: string;
  userId: string;
  userName: string;
  drawnAt: string;
}

export type AuctionAction =
  | { type: 'ADD_PRIZE'; payload: Omit<Prize, 'id' | 'entries' | 'totalTicketsInPrize'> }
  | { type: 'UPDATE_PRIZE'; payload: Omit<Prize, 'entries' | 'totalTicketsInPrize'> & { id: string } }
  | { type: 'DELETE_PRIZE'; payload: { prizeId: string } }
  | { type: 'ALLOCATE_TICKETS'; payload: { prizeId: string; userId: string; userName: string; count: number } }
  | { type: 'DRAW_WINNERS' }
  | { type: 'DRAW_SINGLE_WINNER'; payload: { prizeId: string } }
  | { type: 'RESET_AUCTION' }
  | { type: 'REDRAW_PRIZE_WINNER'; payload: { prizeId: string } }
  | { type: 'LOGIN_USER'; payload: { firstName: string; lastName: string; facilityName: string; pin: string } }
  | { type: 'LOGOUT_USER' }
  | { type: 'ADD_FIREBASE_USER'; payload: CSVUserData }
  | { type: 'UPLOAD_USERS'; payload: CSVUserData[] }
  | { type: 'SET_FIREBASE_USER'; payload: FirebaseUser | null }
  | { type: 'SET_FIREBASE_PRIZES'; payload: Prize[] }
  | { type: 'SYNC_USER_ALLOCATIONS'; payload: { userId: string; allocatedTickets: Record<string, number> } }
  | { type: 'SET_LOTTERY_DATA'; payload: { prizes: Prize[]; allocations: any[]; winners: any[] } };
