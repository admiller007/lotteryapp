
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
  name: string; // Combined from firstName and lastName
  totalInitialTickets: number;
  allocatedTickets: Record<string, number>; // prizeId -> count
}

export interface AuctionContextState {
  prizes: Prize[];
  currentUser: AppUser | null; // Can be null if no user is logged in
  isAuctionOpen: boolean;
  winners: Record<string, string>;
  allUsers: Record<string, { name: string }>;
}

export type AuctionAction =
  | { type: 'ADD_PRIZE'; payload: Omit<Prize, 'id' | 'entries' | 'totalTicketsInPrize'> }
  | { type: 'UPDATE_PRIZE'; payload: Omit<Prize, 'entries' | 'totalTicketsInPrize'> & { id: string } }
  | { type: 'DELETE_PRIZE'; payload: { prizeId: string } }
  | { type: 'ALLOCATE_TICKETS'; payload: { prizeId: string; userId: string; userName: string; count: number } }
  | { type: 'DRAW_WINNERS' }
  | { type: 'RESET_AUCTION' }
  | { type: 'REDRAW_PRIZE_WINNER'; payload: { prizeId: string } }
  | { type: 'LOGIN_USER'; payload: { firstName: string; lastName: string; employeeId: string } }
  | { type: 'LOGOUT_USER' };
