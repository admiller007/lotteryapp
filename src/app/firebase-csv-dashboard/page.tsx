"use client";
import { useState, useEffect } from 'react';
import { FirebaseAuthProvider, useFirebaseAuth } from '@/context/FirebaseAuthContext';
import { AppProvider, useAppContext } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PrizeGrid from '@/components/PrizeGrid';
import UserTicketInfo from '@/components/UserTicketInfo';
import { getPrizes, convertFirebasePrizeToAppPrize, getUserByCredentials } from '@/lib/firebaseService';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';

function DashboardContent() {
  const { user } = useFirebaseAuth();
  const { state, dispatch } = useAppContext();
  const [loading, setLoading] = useState(false);

  const loadFirebasePrizes = async () => {
    setLoading(true);
    try {
      const firebasePrizes = await getPrizes();
      const appPrizes = firebasePrizes.map(convertFirebasePrizeToAppPrize);
      dispatch({
        type: 'SET_FIREBASE_PRIZES',
        payload: appPrizes
      });
      toast({
        title: "Success",
        description: `Loaded ${appPrizes.length} prizes from Firebase`
      });
    } catch (error: any) {
      console.error('Error loading prizes:', error);
      toast({
        title: "Error",
        description: "Failed to load prizes from Firebase",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadFirebasePrizes();
    }
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">Please sign in to access the dashboard.</p>
          <Link href="/firebase-login">
            <Button>Go to Login</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">
              Firebase Dashboard
            </h1>
            <div className="flex items-center space-x-4">
              <Button 
                variant="outline" 
                onClick={loadFirebasePrizes}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Refresh Prizes'}
              </Button>
              <span className="text-sm text-gray-600">
                {user.email}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {state.currentUser && (
            <Card>
              <CardHeader>
                <CardTitle>Your Ticket Information</CardTitle>
              </CardHeader>
              <CardContent>
                <UserTicketInfo />
              </CardContent>
            </Card>
          )}

          <section>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Available Prizes</h2>
              <p className="text-sm text-muted-foreground">
                {state.prizes.length} prizes available
              </p>
            </div>
            <PrizeGrid />
          </section>

          {!state.currentUser && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <p className="text-muted-foreground">
                    Please log in to allocate tickets to prizes.
                  </p>
                  <Link href="/login">
                    <Button>Go to Login</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}

export default function FirebaseCSVDashboardPage() {
  return (
    <FirebaseAuthProvider>
      <AppProvider>
        <DashboardContent />
      </AppProvider>
    </FirebaseAuthProvider>
  );
}