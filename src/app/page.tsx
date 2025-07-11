
"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import PrizeGrid from "@/components/PrizeGrid";
import { Skeleton } from '@/components/ui/skeleton';
import { getPrizes, convertFirebasePrizeToAppPrize, getPrizeTiers, convertFirebasePrizeTierToAppTier } from '@/lib/firebaseService';
import { toast } from '@/hooks/use-toast';

export default function HomePage() {
  const { state, dispatch } = useAppContext();
  const router = useRouter();
  const [loadingPrizes, setLoadingPrizes] = useState(false);

  // Load Firebase prizes and prize tiers on component mount
  useEffect(() => {
    const loadFirebaseData = async () => {
      setLoadingPrizes(true);
      try {
        // Load prizes and prize tiers in parallel
        const [firebasePrizes, firebasePrizeTiers] = await Promise.all([
          getPrizes(),
          getPrizeTiers()
        ]);
        
        console.log('Loaded Firebase prizes:', firebasePrizes);
        console.log('Loaded Firebase prize tiers:', firebasePrizeTiers);
        
        // Convert and update prizes
        const appPrizes = firebasePrizes.map(convertFirebasePrizeToAppPrize);
        console.log('Converted to app prizes:', appPrizes);
        console.log('Sample imageUrl from first prize:', appPrizes[0]?.imageUrl);
        
        dispatch({
          type: 'SET_FIREBASE_PRIZES',
          payload: appPrizes
        });
        
        // Convert and update prize tiers
        const appPrizeTiers = firebasePrizeTiers.map(convertFirebasePrizeTierToAppTier);
        console.log('Converted to app prize tiers:', appPrizeTiers);
        
        dispatch({
          type: 'SET_FIREBASE_PRIZE_TIERS',
          payload: appPrizeTiers
        });
        
        if (firebasePrizes.length > 0 || firebasePrizeTiers.length > 0) {
          toast({
            title: "Data Loaded",
            description: `Loaded ${firebasePrizes.length} prizes and ${firebasePrizeTiers.length} prize tiers from Firebase`
          });
        }
      } catch (error: any) {
        console.error('Error loading Firebase data:', error);
        toast({
          title: "Warning",
          description: "Could not load Firebase data, using cached data",
          variant: "destructive"
        });
      } finally {
        setLoadingPrizes(false);
      }
    };

    loadFirebaseData();
  }, [dispatch]);

  useEffect(() => {
    if (state.currentUser === undefined) return; // Wait for context to initialize

    if (!state.currentUser) {
      router.push('/login');
    }
  }, [state.currentUser, router]);

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

  const clearCacheAndReload = async () => {
    localStorage.removeItem('lotteryAppState');
    window.location.reload();
  };

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold font-headline text-center mb-2">Available Prizes</h2>
        <p className="text-center text-muted-foreground mb-8">
          Allocate your tickets to the prizes you want to win! You can only win one prize.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <div className="text-center mb-4">
            <button 
              onClick={clearCacheAndReload}
              className="text-xs text-blue-600 underline"
            >
              Clear Cache & Reload Firebase Prizes
            </button>
          </div>
        )}
      </div>
      <PrizeGrid />
    </section>
  );
}
