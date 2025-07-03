"use client";
import FirebaseAuth from '@/components/FirebaseAuth';
import { FirebaseAuthProvider, useFirebaseAuth } from '@/context/FirebaseAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut, User } from 'lucide-react';

function AuthenticatedView() {
  const { user, userData, signOut } = useFirebaseAuth();

  if (!user || !userData) return null;

  return (
    <div className="min-h-screen p-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Welcome, {userData.displayName || user.email}!
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Email:</strong> {user.email}
            </div>
            <div>
              <strong>Facility:</strong> {userData.facilityName || 'Not set'}
            </div>
            <div>
              <strong>Tickets:</strong> {userData.tickets}
            </div>
            <div>
              <strong>Role:</strong> {userData.isAdmin ? 'Admin' : 'User'}
            </div>
            <div>
              <strong>Account Created:</strong> {new Date(userData.createdAt).toLocaleDateString()}
            </div>
            <div>
              <strong>User ID:</strong> {user.uid}
            </div>
          </div>
          
          <div className="pt-4 border-t">
            <Button onClick={signOut} variant="outline">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>

          <div className="mt-6 p-4 bg-green-50 rounded-lg">
            <h3 className="font-semibold text-green-800 mb-2">🎉 Firebase Integration Working!</h3>
            <p className="text-green-700 text-sm">
              Your account is connected to Firebase. This means your data will persist across devices and browser sessions.
              Next step: Migrate the lottery functionality to use Firebase!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FirebaseLoginContent() {
  const { user, loading } = useFirebaseAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return user ? <AuthenticatedView /> : <FirebaseAuth />;
}

export default function FirebaseLoginPage() {
  return (
    <FirebaseAuthProvider>
      <FirebaseLoginContent />
    </FirebaseAuthProvider>
  );
}