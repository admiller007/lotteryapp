"use client";
import FirebaseAuth from '@/components/FirebaseAuth';
import { FirebaseAuthProvider } from '@/context/FirebaseAuthContext';

export default function FirebaseLoginPage() {
  return (
    <FirebaseAuthProvider>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-bold text-gray-900">
              Firebase Authentication
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Sign in to manage prizes and users
            </p>
          </div>
          <FirebaseAuth />
        </div>
      </div>
    </FirebaseAuthProvider>
  );
}