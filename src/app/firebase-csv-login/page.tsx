"use client";
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AppProvider, useAppContext } from '@/context/AppContext';
import { getUserByCredentials } from '@/lib/firebaseService';
import { useRouter } from 'next/navigation';
import { toast } from '@/hooks/use-toast';

function LoginForm() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    facilityName: '',
    pin: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { dispatch } = useAppContext();
  const router = useRouter();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const firebaseUser = await getUserByCredentials(
        formData.firstName,
        formData.lastName,
        formData.facilityName,
        formData.pin
      );

      if (!firebaseUser) {
        setError('Invalid credentials. Please check your information and try again.');
        return;
      }

      // Log in to local app context
      dispatch({
        type: 'ADD_FIREBASE_USER',
        payload: {
          firstName: firebaseUser.firstName,
          lastName: firebaseUser.lastName,
          facilityName: firebaseUser.facilityName,
          tickets: firebaseUser.tickets,
          pin: firebaseUser.pin
        }
      });

      dispatch({
        type: 'LOGIN_USER',
        payload: {
          firstName: firebaseUser.firstName,
          lastName: firebaseUser.lastName,
          facilityName: firebaseUser.facilityName,
          pin: firebaseUser.pin
        }
      });

      toast({
        title: "Login Successful",
        description: `Welcome, ${firebaseUser.firstName} ${firebaseUser.lastName}!`
      });

      router.push('/firebase-csv-dashboard');

    } catch (error: any) {
      console.error('Login error:', error);
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            Firebase User Login
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  required
                  placeholder="John"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  required
                  placeholder="Doe"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="facilityName">Facility Name</Label>
              <Input
                id="facilityName"
                name="facilityName"
                type="text"
                value={formData.facilityName}
                onChange={handleInputChange}
                required
                placeholder="Main Office"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pin">PIN</Label>
              <Input
                id="pin"
                name="pin"
                type="password"
                value={formData.pin}
                onChange={handleInputChange}
                required
                placeholder="Enter your PIN"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button 
              type="submit" 
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>Need to be added to the system?</p>
            <p>Contact your administrator for account creation.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function FirebaseCSVLoginPage() {
  return (
    <AppProvider>
      <LoginForm />
    </AppProvider>
  );
}