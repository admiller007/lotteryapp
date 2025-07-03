"use client";
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { LogIn, Users } from 'lucide-react';
import { findCSVUser, getAllCSVUsers } from '@/lib/firebaseService';

export default function FirebaseCSVLoginPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [facilityName, setFacilityName] = useState('');
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
    const userName = `${firstName.trim()} ${lastName.trim()}`;
    
    try {
      console.log('Login attempt:', {
        searchName: userName,
        searchFacility: facilityName.trim(),
        searchPin: pin.trim()
      });

      // Check Firebase for CSV user
      const foundUser = await findCSVUser(
        firstName.trim(),
        lastName.trim(), 
        facilityName.trim(),
        pin.trim()
      );

      console.log('Found user:', foundUser);

      if (!foundUser) {
        toast({
          title: "Invalid Credentials",
          description: "The provided information does not match any uploaded user. Please check your first name, last name, facility name, and PIN.",
          variant: "destructive",
        });
        return;
      }

      // Success! Store user info and redirect
      const userInfo = {
        id: foundUser.id,
        firstName: foundUser.firstName,
        lastName: foundUser.lastName,
        name: foundUser.name,
        facilityName: foundUser.facilityName,
        tickets: foundUser.tickets,
        type: 'csv'
      };

      // Store in sessionStorage for now (you can update context later)
      sessionStorage.setItem('currentUser', JSON.stringify(userInfo));

      toast({
        title: "Login Successful",
        description: `Welcome, ${foundUser.name}!`,
      });

      // Redirect to a success page
      router.push('/firebase-csv-dashboard');

    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: "Login Failed",
        description: "An error occurred during login. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testConnection = async () => {
    try {
      const users = await getAllCSVUsers();
      console.log('Available users:', users);
      toast({
        title: "Connection Test",
        description: `Found ${users.length} users in Firebase.`,
      });
    } catch (error) {
      console.error('Connection test failed:', error);
      toast({
        title: "Connection Failed",
        description: "Could not connect to Firebase.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-md mx-auto">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-headline text-center">Firebase CSV Login</CardTitle>
            <CardDescription className="text-center">
              Login with your name, facility, and PIN (CSV users stored in Firebase)
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
                  disabled={isLoading}
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
                  disabled={isLoading}
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
                  disabled={isLoading}
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
                  disabled={isLoading}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button type="submit" className="w-full" disabled={isLoading}>
                <LogIn className="mr-2 h-4 w-4" />
                {isLoading ? 'Logging In...' : 'Log In'}
              </Button>
              <Button type="button" variant="outline" onClick={testConnection} className="w-full">
                <Users className="mr-2 h-4 w-4" />
                Test Firebase Connection
              </Button>
            </CardFooter>
          </form>
        </Card>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            This login checks Firebase for CSV users uploaded by admin.
          </p>
        </div>
      </div>
    </div>
  );
}