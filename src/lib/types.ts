
export interface PrizeTier {
  id: string;
  name: string;
  description: string;
  color: string;
  order: number;
}

export interface Prize {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  entries: { userId: string; numTickets: number }[];
  totalTicketsInPrize: number;
  tierId?: string;
}

export interface AppUser {
  id: string; // Will use employeeId
  firstName: string;
  lastName: string;
  employeeId: string;
  facilityName: string;
  name: string; // Combined from firstName and lastName
  totalInitialTickets: number;
  allocatedTickets: Record<string, number>; // prizeId -> count
}

export interface AuctionContextState {
  prizes: Prize[];
  prizeTiers: PrizeTier[];
  currentUser: AppUser | null; // Can be null if no user is logged in
  isAuctionOpen: boolean;
  winners: Record<string, string>;
  allUsers: Record<string, { name: string; tickets?: number; facilityName?: string; pin?: string }>;
  lastAction?: {
    type: string;
    message?: string;
    userName?: string;
    prizeName?: string;
    winnerName?: string;
  };
}

export type AuctionAction =
  | { type: 'ADD_PRIZE'; payload: Omit<Prize, 'id' | 'entries' | 'totalTicketsInPrize'> }
  | { type: 'UPDATE_PRIZE'; payload: Omit<Prize, 'entries' | 'totalTicketsInPrize'> & { id: string } }
  | { type: 'DELETE_PRIZE'; payload: { prizeId: string } }
  | { type: 'ALLOCATE_TICKETS'; payload: { prizeId: string; userId: string; userName: string; count: number } }
  | { type: 'DRAW_WINNERS' }
  | { type: 'DRAW_SINGLE_WINNER'; payload: { prizeId: string } }
  | { type: 'DRAW_TIER_WINNERS'; payload: { tierId: string } }
  | { type: 'RESET_AUCTION' }
  | { type: 'REDRAW_PRIZE_WINNER'; payload: { prizeId: string } }
  | { type: 'LOGIN_USER'; payload: { firstName: string; lastName: string; facilityName: string; pin: string } }
  | { type: 'LOGIN_SUCCESS'; payload: { user: AppUser; userName: string } }
  | { type: 'LOGIN_ERROR'; payload: { message: string } }
  | { type: 'LOGIN_PENDING' }
  | { type: 'LOGOUT_USER' }
  | { type: 'ADD_FIREBASE_USER'; payload: { firstName: string; lastName: string; facilityName: string; tickets: number; pin: string } }
  | { type: 'SET_FIREBASE_PRIZES'; payload: Prize[] }
  | { type: 'SET_FIREBASE_PRIZE_TIERS'; payload: PrizeTier[] }
  | { type: 'ADD_PRIZE_TIER'; payload: Omit<PrizeTier, 'id'> }
  | { type: 'UPDATE_PRIZE_TIER'; payload: PrizeTier }
  | { type: 'DELETE_PRIZE_TIER'; payload: { tierId: string } }
  | { type: 'SYNC_USER_ALLOCATIONS'; payload: { userId: string; allocatedTickets: Record<string, number> } }
  | { type: 'LOAD_USER_ALLOCATIONS'; payload: { userId: string; allocatedTickets: Record<string, number> } }
  | { type: 'UPLOAD_USERS'; payload: Array<{ firstName: string; lastName: string; employeeId: string; facilityName: string; tickets: number; pin: string }> };
