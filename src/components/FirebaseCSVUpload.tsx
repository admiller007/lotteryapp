"use client";
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { addUsers, type FirebaseUser } from '@/lib/firebaseService';
import { useAppContext } from '@/context/AppContext';

interface CSVUser {
  firstName: string;
  lastName: string;
  employeeId: string;
  facilityName: string;
  tickets: number;
  pin: string;
}

export default function FirebaseCSVUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    count?: number;
  } | null>(null);
  
  const { dispatch } = useAppContext();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      setResult(null);
    } else {
      setResult({
        success: false,
        message: 'Please select a valid CSV file.'
      });
    }
  };

  const parseCSV = (text: string): CSVUser[] => {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    // Check for required headers
    const requiredHeaders = ['firstname', 'lastname', 'employeeid', 'facilityname', 'tickets', 'pin'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
    }
    
    const users: CSVUser[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length !== headers.length) continue;
      
      const user: CSVUser = {
        firstName: values[headers.indexOf('firstname')] || '',
        lastName: values[headers.indexOf('lastname')] || '',
        employeeId: values[headers.indexOf('employeeid')] || '',
        facilityName: values[headers.indexOf('facilityname')] || '',
        tickets: parseInt(values[headers.indexOf('tickets')] || '0'),
        pin: values[headers.indexOf('pin')] || ''
      };
      
      // Validate required fields
      if (user.firstName && user.lastName && user.employeeId && user.facilityName && user.pin) {
        users.push(user);
      }
    }
    
    return users;
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setUploading(true);
    setResult(null);
    
    try {
      const text = await file.text();
      const users = parseCSV(text);
      
      if (users.length === 0) {
        throw new Error('No valid users found in CSV file');
      }
      
      // Upload to Firebase
      const firebaseUsers: Omit<FirebaseUser, 'id' | 'createdAt'>[] = users.map(user => ({
        firstName: user.firstName,
        lastName: user.lastName,
        employeeId: user.employeeId,
        facilityName: user.facilityName,
        tickets: user.tickets,
        pin: user.pin
      }));
      
      await addUsers(firebaseUsers);
      
      // Update local app context
      dispatch({
        type: 'UPLOAD_USERS',
        payload: users
      });
      
      setResult({
        success: true,
        message: `Successfully uploaded ${users.length} users to Firebase and updated local state.`,
        count: users.length
      });
      
      setFile(null);
      
    } catch (error: any) {
      console.error('Upload error:', error);
      setResult({
        success: false,
        message: error.message || 'Failed to upload CSV file'
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Firebase CSV User Upload
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="csv-file" className="text-sm font-medium">
            Select CSV File
          </label>
          <Input
            id="csv-file"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="cursor-pointer"
          />
          <p className="text-xs text-muted-foreground">
            CSV should contain: firstName, lastName, employeeId, facilityName, tickets, pin
          </p>
        </div>

        {file && (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
            <FileText className="h-4 w-4" />
            <span className="text-sm">{file.name}</span>
            <span className="text-xs text-muted-foreground">
              ({(file.size / 1024).toFixed(1)} KB)
            </span>
          </div>
        )}

        {result && (
          <Alert variant={result.success ? "default" : "destructive"}>
            {result.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>{result.message}</AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="w-full"
        >
          {uploading ? 'Uploading...' : 'Upload to Firebase'}
        </Button>

        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>CSV Format Example:</strong></p>
          <code className="block p-2 bg-muted rounded text-xs">
            firstName,lastName,employeeId,facilityName,tickets,pin<br />
            John,Doe,EMP001,Main Office,100,1234<br />
            Jane,Smith,EMP002,Branch Office,150,5678
          </code>
        </div>
      </CardContent>
    </Card>
  );
}