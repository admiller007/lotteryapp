
"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import PrizeGrid from "@/components/PrizeGrid";
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Trophy } from 'lucide-react';
import Link from 'next/link';
import { getAllPrizes, initializeDefaultPrizes, getAllAllocations } from '@/lib/firebaseService';

export default function HomePage() {
  const { state, dispatch } = useAppContext();
  const router = useRouter();

  useEffect(() => {
    // Only redirect if we're sure there's no user
    if (state.currentUser === null) {
      router.push('/login');
    }
  }, [state.currentUser]);

  useEffect(() => {
    // Load Firebase prizes and allocations when component mounts
    const loadFirebaseData = async () => {
      try {
        // Initialize default prizes if none exist
        await initializeDefaultPrizes();
        // Load all prizes from Firebase
        const firebasePrizes = await getAllPrizes();
        // Load all allocations from Firebase
        const firebaseAllocations = await getAllAllocations('default');
        
        // Process allocations into prize entries
        const prizesWithEntries = firebasePrizes.map(prize => {
          const prizeAllocations = firebaseAllocations.filter(allocation => allocation.prizeId === prize.id);
          const entries = prizeAllocations.map(allocation => ({
            userId: allocation.userId,
            numTickets: allocation.tickets
          }));
          const totalTicketsInPrize = entries.reduce((sum, entry) => sum + entry.numTickets, 0);
          
          return {
            ...prize,
            entries,
            totalTicketsInPrize
          };
        });
        
        // Update the context with Firebase prizes including allocations
        dispatch({ type: 'SET_FIREBASE_PRIZES', payload: prizesWithEntries });
        
        // Also update current user allocations if user is logged in
        if (state.currentUser) {
          console.log('Loading allocations for user:', state.currentUser.id);
          const userAllocations = firebaseAllocations.filter(allocation => allocation.userId === state.currentUser.id);
          console.log('Found user allocations:', userAllocations);
          const allocatedTickets: Record<string, number> = {};
          userAllocations.forEach(allocation => {
            allocatedTickets[allocation.prizeId] = allocation.tickets;
          });
          
          dispatch({ 
            type: 'SYNC_USER_ALLOCATIONS', 
            payload: { userId: state.currentUser.id, allocatedTickets } 
          });
        }
      } catch (error) {
        console.error('Error loading Firebase data:', error);
      }
    };

    loadFirebaseData();
  }, [dispatch, state.currentUser?.id]);

  // Additional effect to sync user allocations when user logs in
  useEffect(() => {
    if (state.currentUser && state.prizes.length > 0) {
      const syncUserAllocations = async () => {
        try {
          const firebaseAllocations = await getAllAllocations('default');
          const userAllocations = firebaseAllocations.filter(allocation => allocation.userId === state.currentUser.id);
          console.log('Syncing allocations on login for user:', state.currentUser.id, userAllocations);
          
          const allocatedTickets: Record<string, number> = {};
          userAllocations.forEach(allocation => {
            allocatedTickets[allocation.prizeId] = allocation.tickets;
          });
          
          dispatch({ 
            type: 'SYNC_USER_ALLOCATIONS', 
            payload: { userId: state.currentUser.id, allocatedTickets } 
          });
        } catch (error) {
          console.error('Error syncing user allocations:', error);
        }
      };
      
      syncUserAllocations();
    }
  }, [state.currentUser?.id, state.prizes.length, dispatch]);

  if (state.currentUser === undefined || !state.currentUser) {
    // Show a loading state or skeleton while checking auth / redirecting
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-1/2 mx-auto" />
          <Skeleton className="h-4 w-3/4 mx-auto" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-96 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold font-headline mb-2">Available Prizes</h2>
        <p className="text-muted-foreground mb-6">
          Allocate your tickets to the prizes you want to win! You can only win one prize.
        </p>
        
        {/* Show winners button if auction is closed or winners exist */}
        {(!state.isAuctionOpen || Object.keys(state.winners).length > 0) && (
          <div className="mb-6">
            <Link href="/winners">
              <Button variant="outline" className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-none hover:from-yellow-500 hover:to-orange-600">
                <Trophy className="mr-2 h-4 w-4" />
                View Winners Display
              </Button>
            </Link>
          </div>
        )}
      </div>
      <PrizeGrid />
    </section>
  );
}
