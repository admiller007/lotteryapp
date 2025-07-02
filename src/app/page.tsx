
"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import PrizeGrid from "@/components/PrizeGrid";
import { Skeleton } from '@/components/ui/skeleton';

export default function HomePage() {
  const { state } = useAppContext();
  const router = useRouter();

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

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold font-headline text-center mb-2">Available Prizes</h2>
        <p className="text-center text-muted-foreground mb-8">
          Allocate your tickets to the prizes you want to win! You can only win one prize.
        </p>
      </div>
      <PrizeGrid />
    </section>
  );
}
