
"use client";
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { LogIn } from 'lucide-react';

export default function LoginPage() {
  const { dispatch } = useAppContext();
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [facilityName, setFacilityName] = useState('');
  const [pin, setPin] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !facilityName.trim() || !pin.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }
    dispatch({ type: 'LOGIN_USER', payload: { firstName, lastName, facilityName, pin } });
    router.push('/'); // Redirect to home page after login
  };

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
              <Input
                id="pin"
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                required
                placeholder="Enter your PIN"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full">
              <LogIn className="mr-2 h-4 w-4" /> Log In
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
