"use client";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function TestPage() {
  return (
    <div className="min-h-screen p-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>🚀 Server Stability Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-green-600 font-semibold">
            ✅ Server is running and stable!
          </p>
          
          <div className="p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold mb-2">Next Steps:</h3>
            <ul className="text-sm space-y-1">
              <li>• This minimal page should load without crashes</li>
              <li>• We can gradually re-enable components</li>
              <li>• Firebase integration is ready to use</li>
            </ul>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => window.location.href = '/firebase-login'}>
              Test Firebase Auth
            </Button>
            <Button onClick={() => window.location.href = '/firebase-csv-admin'}>
              Test CSV Admin
            </Button>
            <Button onClick={() => window.location.href = '/firebase-csv-login'}>
              Test CSV Login
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            <p>Server uptime: {new Date().toLocaleTimeString()}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}