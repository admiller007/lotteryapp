"use client";
import FirebaseCSVUpload from '@/components/FirebaseCSVUpload';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield } from 'lucide-react';

export default function FirebaseCSVAdminPage() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Firebase CSV Admin Panel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Upload CSV files to create user accounts in Firebase. Users can then login with their name, facility, and PIN.
            </p>
          </CardContent>
        </Card>

        <FirebaseCSVUpload />
      </div>
    </div>
  );
}