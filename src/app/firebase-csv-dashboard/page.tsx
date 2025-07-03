"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogOut, User, Ticket } from 'lucide-react';

export default function FirebaseCSVDashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const userInfo = sessionStorage.getItem('currentUser');
    if (userInfo) {
      setCurrentUser(JSON.parse(userInfo));
    } else {
      router.push('/firebase-csv-login');
    }
    setLoading(false);
  }, [router]);

  const handleLogout = () => {
    sessionStorage.removeItem('currentUser');
    router.push('/firebase-csv-login');
  };

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

  if (!currentUser) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Welcome, {currentUser.name}!
              </div>
              <Button onClick={handleLogout} variant="outline" size="sm">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <strong>Name:</strong><br />
                {currentUser.name}
              </div>
              <div>
                <strong>Facility:</strong><br />
                {currentUser.facilityName}
              </div>
              <div>
                <strong>Available Tickets:</strong><br />
                <span className="flex items-center gap-1">
                  <Ticket className="h-4 w-4" />
                  {currentUser.tickets}
                </span>
              </div>
              <div>
                <strong>User Type:</strong><br />
                CSV User
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>🎉 Firebase CSV Login Working!</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-green-700">
                ✅ <strong>CSV users are now stored in Firebase!</strong><br />
                ✅ <strong>Login works with name/facility/PIN (same as before)</strong><br />
                ✅ <strong>Data persists across sessions</strong><br />
                ✅ <strong>Admin can upload CSV to Firebase</strong>
              </p>
              
              <div className="p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-2">Next Steps:</h3>
                <ul className="text-blue-700 text-sm space-y-1">
                  <li>• Replace the main app login with this Firebase version</li>
                  <li>• Migrate prize allocation to Firebase</li>
                  <li>• Add real-time updates for live lottery experience</li>
                  <li>• Deploy to production</li>
                </ul>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold mb-2">Test Pages:</h3>
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    onClick={() => router.push('/firebase-csv-admin')}
                    className="mr-2"
                  >
                    Admin CSV Upload
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => router.push('/firebase-csv-login')}
                  >
                    CSV Login Page
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}