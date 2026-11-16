
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
  numberOfWinners?: number;
  excludedFacilities?: string[];
}

export interface AppUser {
  id: string; // Firestore users doc ID (also the Firebase Auth uid)
  firstName: string;
  lastName: string;
  employeeId: string;
  facilityName: string;
  name: string; // Combined from firstName and lastName
  totalInitialTickets: number;
  allocatedTickets: Record<string, number>; // prizeId -> count
  status?: 'inactive' | 'working' | 'at_party';
  profilePictureUrl?: string; // Optional profile picture URL
  // From the `admin` claim on the Firebase sign-in token. Only controls what
  // the UI shows; Firestore rules and the API routes enforce it.
  isAdmin?: boolean;
}

// Public info about another user (no PIN), keyed by user ID in allUsers.
export interface DirectoryUser {
  id: string;
  name: string;
  tickets?: number;
  facilityName?: string;
  profilePictureUrl?: string;
  status?: 'inactive' | 'working' | 'at_party';
}

export interface PrizeConflict {
  id: string;
  userId: string;
  userName?: string;
  existingPrizeId: string;
  newPrizeId: string;
}

// Which animation the winner draw uses (admin setting, shared via Firestore).
export type DrawStyle = 'slot' | 'wheel';

export interface AuctionContextState {
  prizes: Prize[];
  prizeTiers: PrizeTier[];
  currentUser: AppUser | null; // Can be null if no user is logged in
  isAuctionOpen: boolean;
  // Admin switch stored in Firestore (settings/lottery); when false nobody can change tickets.
  allocationsOpen: boolean;
  drawStyle: DrawStyle;
  winners: Record<string, string[]>;
  // True once the first winners snapshot has arrived from Firestore.
  winnersSynced?: boolean;
  allUsers: Record<string, DirectoryUser>;
  pendingConflict: PrizeConflict | null;
  drawsPaused: boolean;
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
  | { type: 'ASSIGN_SPECIFIC_WINNER'; payload: { prizeId: string; userId: string } }
  | { type: 'DRAW_TIER_WINNERS'; payload: { tierId: string } }
  | { type: 'RESET_AUCTION' }
  | { type: 'SET_ALLOCATIONS_OPEN'; payload: { open: boolean } }
  | { type: 'SET_DRAW_STYLE'; payload: { drawStyle: DrawStyle } }
  | { type: 'REDRAW_PRIZE_WINNER'; payload: { prizeId: string; winnerId?: string } }
  | { type: 'LOGIN_SUCCESS'; payload: { user: AppUser; userName: string } }
  | { type: 'LOGIN_ERROR'; payload: { message: string } }
  | { type: 'LOGOUT_USER' }
  | { type: 'SET_FIREBASE_PRIZES'; payload: Prize[] }
  | { type: 'SET_FIREBASE_PRIZE_TIERS'; payload: PrizeTier[] }
  | { type: 'ADD_PRIZE_TIER'; payload: Omit<PrizeTier, 'id'> }
  | { type: 'UPDATE_PRIZE_TIER'; payload: PrizeTier }
  | { type: 'DELETE_PRIZE_TIER'; payload: { tierId: string } }
  | { type: 'SYNC_USER_ALLOCATIONS'; payload: { userId: string; allocatedTickets: Record<string, number> } }
  | { type: 'LOAD_USER_ALLOCATIONS'; payload: { userId: string; allocatedTickets: Record<string, number> } }
  | { type: 'UPDATE_PROFILE_PICTURE'; payload: { userId: string; profilePictureUrl: string } }
  | { type: 'SYNC_WINNERS_FROM_FIREBASE'; payload: Record<string, string[]> }
  | { type: 'UPSERT_ALL_USERS'; payload: Record<string, DirectoryUser> }
  | { type: 'RESOLVE_WINNER_CONFLICT'; payload: { conflictId: string; keepPrizeId: string; dropPrizeId: string; userId: string } };
