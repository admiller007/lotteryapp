
"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import type { Prize } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Edit3, Trash2, Play, RefreshCcw, Award, ShieldAlert, Upload, Users } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { addUsers, getUsers, type FirebaseUser, addPrize, getPrizes, updatePrize, deletePrize, convertFirebasePrizeToAppPrize, type FirebasePrize } from '@/lib/firebaseService';
import FirebasePrizeManager from '@/components/FirebasePrizeManager';
import WinnerDrawing from '@/components/WinnerDrawing';

type PrizeFormData = Omit<Prize, 'id' | 'entries' | 'totalTicketsInPrize' | 'winnerId'>;

export default function AdminPage() {
  const { state, dispatch, isAdmin, isHydrated } = useAppContext();
  const router = useRouter();
  const { prizes, isAuctionOpen, winners, allUsers, currentUser } = state;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPrize, setEditingPrize] = useState<Prize | null>(null);
  const [formData, setFormData] = useState<PrizeFormData>({
    name: '',
    description: '',
    imageUrl: '',
  });

  // CSV Upload state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // Firebase users state
  const [firebaseUsers, setFirebaseUsers] = useState<FirebaseUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  // Firebase prizes state
  const [firebasePrizes, setFirebasePrizes] = useState<FirebasePrize[]>([]);
  const [loadingPrizes, setLoadingPrizes] = useState(false);

  // Load Firebase users
  const loadFirebaseUsers = async () => {
    setLoadingUsers(true);
    try {
      const users = await getUsers();
      setFirebaseUsers(users);
    } catch (error: any) {
      console.error('Error loading Firebase users:', error);
      toast({
        title: "Error",
        description: "Failed to load users from Firebase",
        variant: "destructive"
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  // Load Firebase prizes
  const loadFirebasePrizes = async () => {
    setLoadingPrizes(true);
    try {
      const prizes = await getPrizes();
      setFirebasePrizes(prizes);
      
      // Update local context for immediate display
      const appPrizes = prizes.map(convertFirebasePrizeToAppPrize);
      dispatch({
        type: 'SET_FIREBASE_PRIZES',
        payload: appPrizes
      });
    } catch (error: any) {
      console.error('Error loading Firebase prizes:', error);
      toast({
        title: "Error",
        description: "Failed to load prizes from Firebase",
        variant: "destructive"
      });
    } finally {
      setLoadingPrizes(false);
    }
  };

  useEffect(() => {
    if (state.currentUser === undefined) return; // Context not yet initialized

    if (!currentUser) {
      router.push('/login');
    } else if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "You do not have permission to view the admin panel.",
        variant: "destructive",
        duration: 5000,
      });
      router.push('/');
    } else {
      // Load Firebase data when admin logs in
      loadFirebaseUsers();
      loadFirebasePrizes();
    }
  }, [currentUser, isAdmin, router, state.currentUser]);

  // Refresh Firebase prizes periodically to show latest allocations
  useEffect(() => {
    if (!isAdmin || !currentUser) return;
    
    const interval = setInterval(() => {
      console.log('Auto-refreshing Firebase prizes...');
      loadFirebasePrizes();
    }, 30000); // Refresh every 30 seconds instead of 10
    
    return () => clearInterval(interval);
  }, [isAdmin, currentUser]);

  // Handle toast messages for single winner draws
  useEffect(() => {
    if (state.lastAction?.type === 'SINGLE_WINNER_DRAWN') {
      toast({
        title: "Winner Drawn!",
        description: `${state.lastAction.winnerName} has won ${state.lastAction.prizeName}!`,
      });
    } else if (state.lastAction?.type === 'NO_ENTRIES_ERROR') {
      toast({
        title: "Cannot Draw Winner",
        description: `No entries found for ${state.lastAction.prizeName}`,
        variant: "destructive",
      });
    } else if (state.lastAction?.type === 'ERROR') {
      toast({
        title: "Error",
        description: state.lastAction.message,
        variant: "destructive",
      });
    }
  }, [state.lastAction]);

  if (!isHydrated) {
    return (
       <div className="space-y-8">
        <Card>
          <CardHeader><Skeleton className="h-8 w-1/3" /></CardHeader>
          <CardContent className="flex gap-4"><Skeleton className="h-10 w-32" /> <Skeleton className="h-10 w-32" /></CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row justify-between items-center">
            <Skeleton className="h-8 w-1/4" />
            <Skeleton className="h-10 w-36" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentUser || !isAdmin) {
    return null; // This will trigger the useEffect redirect
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.description) {
      toast({ title: "Missing fields", description: "Name and description are required.", variant: "destructive" });
      return;
    }

    try {
      if (editingPrize) {
        // Update Firebase prize
        await updatePrize(editingPrize.id, {
          name: formData.name,
          description: formData.description,
          imageUrl: formData.imageUrl
        });
        toast({ title: "Prize Updated", description: `${formData.name} has been updated in Firebase.` });
      } else {
        // Add new Firebase prize
        await addPrize({
          name: formData.name,
          description: formData.description,
          imageUrl: formData.imageUrl,
          entries: [],
          totalTicketsInPrize: 0
        });
        toast({ title: "Prize Added", description: `${formData.name} has been added to Firebase.` });
      }
      
      // Reload Firebase prizes to update display
      await loadFirebasePrizes();
      
      setFormData({ name: '', description: '', imageUrl: '' });
      setEditingPrize(null);
      setIsFormOpen(false);
    } catch (error: any) {
      console.error('Error saving prize:', error);
      toast({ 
        title: "Error", 
        description: "Failed to save prize to Firebase", 
        variant: "destructive" 
      });
    }
  };

  const openEditForm = (prize: Prize) => {
    setEditingPrize(prize);
    setFormData({ name: prize.name, description: prize.description, imageUrl: prize.imageUrl });
    setIsFormOpen(true);
  };

  const openNewForm = () => {
    setEditingPrize(null);
    setFormData({ name: '', description: '', imageUrl: '' });
    setIsFormOpen(true);
  }

  const handleDeletePrize = async (prizeId: string) => {
    try {
      await deletePrize(prizeId);
      
      // Reload Firebase prizes to update display
      await loadFirebasePrizes();
      
      toast({ title: "Prize Deleted", description: "The prize has been removed from Firebase.", variant: "destructive" });
    } catch (error: any) {
      console.error('Error deleting prize:', error);
      toast({ 
        title: "Error", 
        description: "Failed to delete prize from Firebase", 
        variant: "destructive" 
      });
    }
  };

  const handleDrawWinners = () => {
    dispatch({ type: 'DRAW_WINNERS' });
  };
  
  const handleRedrawPrize = (prizeId: string) => {
    dispatch({ type: 'REDRAW_PRIZE_WINNER', payload: { prizeId } });
  };

  const handleDrawSingleWinner = (prizeId: string) => {
    dispatch({ type: 'DRAW_SINGLE_WINNER', payload: { prizeId } });
  };

  const handleResetAuction = () => {
    dispatch({ type: 'RESET_AUCTION' });
    toast({ title: "Auction Reset", description: "The auction has been reset to its initial state." });
  };

  // CSV Upload handlers
  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setCsvFile(file);
    } else {
      toast({ title: "Invalid File", description: "Please select a valid CSV file.", variant: "destructive" });
    }
  };

  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n');
    
    // Detect delimiter (tab or comma)
    const firstLine = lines[0];
    const delimiter = firstLine.includes('\t') ? '\t' : ',';
    
    const headers = firstLine.split(delimiter).map(h => h.trim().toLowerCase().replace(/\s+/g, ''));
    
    console.log('Detected delimiter:', delimiter === '\t' ? 'tab' : 'comma');
    console.log('Parsed headers:', headers);
    
    // Check for required headers (normalize spaces)
    const requiredHeaders = ['firstname', 'lastname', 'facilityname', 'tickets', 'pin'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    
    if (missingHeaders.length > 0) {
      console.log('Missing headers:', missingHeaders);
      console.log('Available headers:', headers);
      throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
    }
    
    const users: any[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter).map(v => v.trim());
      if (values.length !== headers.length) continue;
      
      const userName = `${values[headers.indexOf('firstname')] || ''} ${values[headers.indexOf('lastname')] || ''}`.trim();
      const facilityName = values[headers.indexOf('facilityname')] || '';
      const pin = values[headers.indexOf('pin')] || '';
      
      // Create deterministic user ID based on unique user info
      const employeeId = `user_${userName.replace(/\s+/g, '_').toLowerCase()}_${facilityName.replace(/\s+/g, '_').toLowerCase()}_${pin}`;
      
      const user = {
        firstName: values[headers.indexOf('firstname')] || '',
        lastName: values[headers.indexOf('lastname')] || '',
        employeeId: employeeId,
        facilityName: facilityName,
        tickets: parseInt(values[headers.indexOf('tickets')] || '0'),
        pin: pin
      };
      
      // Validate required fields
      if (user.firstName && user.lastName && user.facilityName && user.pin) {
        users.push(user);
      }
    }
    
    return users;
  };

  const handleCsvUpload = async () => {
    if (!csvFile) return;
    
    setUploading(true);
    
    try {
      const text = await csvFile.text();
      const users = parseCSV(text);
      
      if (users.length === 0) {
        throw new Error('No valid users found in CSV file');
      }
      
      // Convert to Firebase user format
      const firebaseUsers: Omit<FirebaseUser, 'id' | 'createdAt'>[] = users.map(user => ({
        firstName: user.firstName,
        lastName: user.lastName,
        employeeId: user.employeeId,
        facilityName: user.facilityName,
        tickets: user.tickets,
        pin: user.pin
      }));
      
      // Upload users to Firebase
      await addUsers(firebaseUsers);
      
      // Reload Firebase users to update the display
      await loadFirebaseUsers();
      
      // Also update local context for immediate login capability
      dispatch({
        type: 'UPLOAD_USERS',
        payload: users
      });
      
      toast({ 
        title: "Users Uploaded", 
        description: `Successfully uploaded ${users.length} users to Firebase.` 
      });
      
      setCsvFile(null);
      
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({ 
        title: "Upload Failed", 
        description: error.message || 'Failed to upload CSV file', 
        variant: "destructive" 
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl flex items-center">
             <ShieldAlert className="mr-3 h-7 w-7 text-primary" /> Admin Auction Control
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          {isAuctionOpen ? (
            <p className="text-lg font-semibold text-blue-600">Auction is open - Use the Winner Drawing section below to draw winners.</p>
          ) : (
            <p className="text-lg font-semibold text-green-600">Winners have been drawn! Auction is closed.</p>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="outline">
                    <RefreshCcw className="mr-2 h-4 w-4" /> Reset Auction
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action will reset the entire auction. All prize entries will be cleared, winners will be removed, and the auction will be re-opened. 
                    Current user ticket allocations will also be reset. Prize configurations will remain. This cannot be undone.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetAuction}>Confirm Reset</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      <WinnerDrawing />

      <FirebasePrizeManager />

      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl flex items-center">
            <Users className="mr-3 h-7 w-7 text-primary" /> User Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center">
              <Upload className="mr-2 h-5 w-5" />
              Upload Users via CSV
            </h3>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="csv-file">Select CSV File</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleCsvFileChange}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  CSV should contain: firstName, lastName, facilityName, tickets, pin
                </p>
              </div>

              {csvFile && (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                  <span className="text-sm">{csvFile.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({(csvFile.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              )}

              <Button
                onClick={handleCsvUpload}
                disabled={!csvFile || uploading}
                className="w-full sm:w-auto"
              >
                {uploading ? 'Uploading...' : 'Upload Users'}
              </Button>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>CSV Format Example:</strong></p>
              <div className="bg-muted p-2 rounded text-xs font-mono">
                firstName,lastName,facilityName,tickets,pin<br />
                John,Doe,Main Office,100,1234<br />
                Jane,Smith,Branch Office,150,5678
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Firebase Users ({firebaseUsers.length})</h3>
              <Button
                onClick={loadFirebaseUsers}
                variant="outline"
                size="sm"
                disabled={loadingUsers}
              >
                <RefreshCcw className={`h-4 w-4 mr-2 ${loadingUsers ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {loadingUsers ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : firebaseUsers.length === 0 ? (
                <p className="text-muted-foreground">No users uploaded to Firebase yet.</p>
              ) : (
                <div className="space-y-2">
                  {firebaseUsers.map((user) => (
                    <div key={user.id} className="flex justify-between items-center p-2 bg-muted rounded">
                      <div>
                        <span className="font-medium">{user.firstName} {user.lastName}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          ({user.employeeId}) - {user.tickets} tickets
                        </span>
                        <span className="text-xs text-muted-foreground block">
                          {user.facilityName}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
