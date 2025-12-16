
"use client";
import React, { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext, useFirebaseLogin } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import { PARTY_CHECKIN_FLAG_KEY, PARTY_CHECKIN_QUERY_KEY, PARTY_CHECKIN_QUERY_VALUE } from '@/lib/partyCheckIn';

export default function LoginPage() {
  const { state } = useAppContext();
  const { loginWithFirebase } = useFirebaseLogin();
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [facilityName, setFacilityName] = useState('');
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);

  // Capture At Party intent from the URL (QR code) and remember it for the login flow
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const statusQuery = new URLSearchParams(window.location.search).get(PARTY_CHECKIN_QUERY_KEY);
    if (statusQuery === PARTY_CHECKIN_QUERY_VALUE) {
      localStorage.setItem(PARTY_CHECKIN_FLAG_KEY, 'true');
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !facilityName.trim() || !pin.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    await loginWithFirebase(firstName, lastName, facilityName, pin);
  };

  // Handle login success/error
  React.useEffect(() => {
    if (state.lastAction?.type === 'LOGIN_SUCCESS') {
      setIsLoading(false);

      // Check user status - if inactive, redirect to inactive page (except for admin users)
      const isAdmin = state.currentUser?.employeeId && ['ADMIN001', 'DEV007'].includes(state.currentUser.employeeId);
      if (state.currentUser?.status === 'inactive' && !isAdmin) {
        router.push('/inactive');
        return;
      }

      // Check if user has a profile picture, if not redirect to profile picture page
      if (state.currentUser && !state.currentUser.profilePictureUrl) {
        router.push('/profile-picture');
      } else {
        router.push('/'); // Redirect to home page if user already has profile picture
      }
    } else if (state.lastAction?.type === 'LOGIN_ERROR') {
      setIsLoading(false);
      toast({
        title: "Login Failed",
        description: state.lastAction.message || "Invalid credentials",
        variant: "destructive",
      });
    }
  }, [state.lastAction, state.currentUser, router]);

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-150px)]">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline text-center">Welcome to TicketToss</CardTitle>
          <CardDescription className="text-center">
            Please enter your details to access the auction.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                placeholder="Enter your first name"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                placeholder="Enter your last name"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="facilityName">Facility Name</Label>
              <Input
                id="facilityName"
                value={facilityName}
                onChange={(e) => setFacilityName(e.target.value)}
                required
                placeholder="Enter your facility name"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pin">PIN</Label>
              <div className="relative">
                <Input
                  id="pin"
                  type={showPin ? "text" : "password"}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  required
                  placeholder="Enter your PIN"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPin(!showPin)}
                >
                  {showPin ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
              <LogIn className="mr-2 h-4 w-4" /> {isLoading ? 'Logging in...' : 'Log In'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
