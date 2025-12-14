"use client";
import React from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, LogOut } from 'lucide-react';

export default function InactivePage() {
  const { state, dispatch } = useAppContext();
  const router = useRouter();

  const handleLogout = () => {
    dispatch({ type: 'LOGOUT_USER' });
    router.push('/login');
  };

  // Redirect to home if user is not inactive
  React.useEffect(() => {
    if (!state.currentUser) {
      router.push('/login');
    } else if (state.currentUser.status !== 'inactive') {
      router.push('/');
    }
  }, [state.currentUser, router]);

  if (!state.currentUser || state.currentUser.status !== 'inactive') {
    return null; // Prevent flash of content before redirect
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-150px)] px-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-full bg-orange-100 text-orange-600 w-fit">
            <AlertCircle className="h-8 w-8" />
          </div>
          <CardTitle className="text-2xl font-headline">Account Inactive</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <div className="space-y-2">
            <p className="text-muted-foreground">
              Hello {state.currentUser.firstName} {state.currentUser.lastName},
            </p>
            <p className="text-muted-foreground">
              Your account is currently inactive. You cannot access the lottery at this time.
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Please contact your administrator to activate your account or check back later.
            </p>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Log Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}