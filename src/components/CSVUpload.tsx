"use client";
import { useState, useRef, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import type { CSVUserData } from '@/lib/types';

export default function CSVUpload() {
  const { dispatch } = useAppContext();
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CSVUserData[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (csvText: string): CSVUserData[] => {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    const data: CSVUserData[] = [];
    const parseErrors: string[] = [];

    // Validate headers
    const requiredHeaders = ['first name', 'last name', 'facility name', 'tickets', 'pin'];
    const headerMap = {
      firstName: headers.findIndex(h => h.includes('first') && h.includes('name')),
      lastName: headers.findIndex(h => h.includes('last') && h.includes('name')),
      facilityName: headers.findIndex(h => h.includes('facility') && h.includes('name')),
      tickets: headers.findIndex(h => h.includes('ticket')),
      pin: headers.findIndex(h => h.includes('pin'))
    };

    // Check if all required headers are present
    const missingHeaders = Object.entries(headerMap)
      .filter(([_, index]) => index === -1)
      .map(([key]) => key);

    if (missingHeaders.length > 0) {
      parseErrors.push(`Missing required columns: ${missingHeaders.join(', ')}`);
      setErrors(parseErrors);
      return [];
    }

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      
      if (values.length < 5) {
        parseErrors.push(`Row ${i + 1}: Not enough columns`);
        continue;
      }

      const firstName = values[headerMap.firstName]?.trim();
      const lastName = values[headerMap.lastName]?.trim();
      const facilityName = values[headerMap.facilityName]?.trim();
      const ticketsStr = values[headerMap.tickets]?.trim();
      const pin = values[headerMap.pin]?.trim();

      if (!firstName || !lastName || !facilityName || !pin) {
        parseErrors.push(`Row ${i + 1}: Missing required data (firstName, lastName, facilityName, or pin)`);
        continue;
      }

      const tickets = parseInt(ticketsStr);
      if (isNaN(tickets) || tickets < 0) {
        parseErrors.push(`Row ${i + 1}: Invalid ticket count "${ticketsStr}"`);
        continue;
      }

      data.push({
        firstName,
        lastName,
        facilityName,
        tickets,
        pin
      });
    }

    // Check for duplicate PINs
    const pinCounts = new Map<string, number>();
    data.forEach((user, index) => {
      const currentCount = pinCounts.get(user.pin) || 0;
      pinCounts.set(user.pin, currentCount + 1);
      if (currentCount > 0) {
        parseErrors.push(`Row ${data.findIndex(u => u.pin === user.pin) + 2} and ${index + 2}: Duplicate PIN "${user.pin}"`);
      }
    });

    setErrors(parseErrors);
    return data;
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast({
        title: "Invalid File Type",
        description: "Please select a CSV file.",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsedData = parseCSV(text);
      setCsvData(parsedData);
      setIsProcessing(false);
    };

    reader.onerror = () => {
      toast({
        title: "File Read Error",
        description: "Could not read the selected file.",
        variant: "destructive",
      });
      setIsProcessing(false);
    };

    reader.readAsText(selectedFile);
  };

  const handleUpload = () => {
    if (csvData.length === 0) {
      toast({
        title: "No Data",
        description: "Please select and validate a CSV file first.",
        variant: "destructive",
      });
      return;
    }

    if (errors.length > 0) {
      toast({
        title: "Validation Errors",
        description: "Please fix the validation errors before uploading.",
        variant: "destructive",
      });
      return;
    }

    console.log('Uploading users:', csvData);
    dispatch({ type: 'UPLOAD_USERS', payload: csvData });

    toast({
      title: "Upload Successful",
      description: `Successfully uploaded ${csvData.length} users.`,
    });

    // Reset form
    setFile(null);
    setCsvData([]);
    setErrors([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const clearFile = () => {
    setFile(null);
    setCsvData([]);
    setErrors([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          CSV User Upload
        </CardTitle>
        <CardDescription>
          Upload a CSV file with user data (First Name, Last Name, Facility Name, Tickets, PIN)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="csvFile">Select CSV File</Label>
          <Input
            id="csvFile"
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleFileChange}
            disabled={isProcessing}
          />
        </div>

        {isProcessing && (
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription>Processing CSV file...</AlertDescription>
          </Alert>
        )}

        {errors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-semibold mb-2">Validation Errors:</div>
              <ul className="list-disc list-inside space-y-1">
                {errors.map((error, index) => (
                  <li key={index} className="text-sm">{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {csvData.length > 0 && errors.length === 0 && (
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription>
              Successfully parsed {csvData.length} users from CSV file.
              <div className="mt-2 text-sm">
                Preview: {csvData.slice(0, 3).map(user => 
                  `${user.firstName} ${user.lastName} (${user.facilityName}, ${user.tickets} tickets, PIN: ${user.pin})`
                ).join(', ')}
                {csvData.length > 3 && '...'}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button 
            onClick={handleUpload}
            disabled={csvData.length === 0 || errors.length > 0 || isProcessing}
            className="flex-1"
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload Users
          </Button>
          {file && (
            <Button variant="outline" onClick={clearFile}>
              Clear
            </Button>
          )}
        </div>

        <div className="text-sm text-muted-foreground">
          <div className="font-semibold mb-1">CSV Format Requirements:</div>
          <ul className="list-disc list-inside space-y-1">
            <li>Headers: First Name, Last Name, Facility Name, Tickets, PIN</li>
            <li>Tickets must be a positive number</li>
            <li>PIN must be unique for each user</li>
            <li>All fields are required</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}