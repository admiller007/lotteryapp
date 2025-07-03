"use client";
import FirebaseCSVUpload from '@/components/FirebaseCSVUpload';
import FirebasePrizeManager from '@/components/FirebasePrizeManager';
import { FirebaseAuthProvider, useFirebaseAuth } from '@/context/FirebaseAuthContext';
import { AppProvider } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

function AdminContent() {
  const { user, logout } = useFirebaseAuth();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">Please sign in to access the admin panel.</p>
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
              Firebase Admin Dashboard
            </h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {user.email}
              </span>
              <Button variant="outline" onClick={logout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-4">Prize Management</h2>
            <FirebasePrizeManager />
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">User Management</h2>
            <FirebaseCSVUpload />
          </section>
        </div>
      </main>
    </div>
  );
}

export default function FirebaseCSVAdminPage() {
  return (
    <FirebaseAuthProvider>
      <AppProvider>
        <AdminContent />
      </AppProvider>
    </FirebaseAuthProvider>
  );
}