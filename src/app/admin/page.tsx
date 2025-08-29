
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
import { PlusCircle, Edit3, Trash2, Play, RefreshCcw, Award, ShieldAlert, Upload, Users, Gift, Layers, Ticket, Trophy } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { addUsers, getUsers, type FirebaseUser, addPrize, getPrizes, updatePrize, deletePrize, convertFirebasePrizeToAppPrize, type FirebasePrize } from '@/lib/firebaseService';
import FirebasePrizeManager from '@/components/FirebasePrizeManager';
import WinnerDrawing from '@/components/WinnerDrawing';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

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
  const [previewUsers, setPreviewUsers] = useState<any[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");
  
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
  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setPreviewUsers([]);
    setPreviewError(null);
    if (!file) return;

    if (file.type !== 'text/csv') {
      toast({ title: "Invalid File", description: "Please select a valid CSV file.", variant: "destructive" });
      return;
    }
    setCsvFile(file);
    try {
      const text = await file.text();
      const users = parseCSV(text);
      if (users.length === 0) {
        setPreviewError('No valid users found in CSV file');
      }
      setPreviewUsers(users);
    } catch (err: any) {
      console.error('CSV parse error:', err);
      setPreviewError(err.message || 'Failed to parse CSV');
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
    if (previewUsers.length === 0) {
      toast({ title: "Nothing to Upload", description: "Please select a valid CSV and review preview.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const firebaseUsersPayload: Omit<FirebaseUser, 'id' | 'createdAt'>[] = previewUsers.map((user) => ({
        firstName: user.firstName,
        lastName: user.lastName,
        employeeId: user.employeeId,
        facilityName: user.facilityName,
        tickets: user.tickets,
        pin: user.pin,
      }));

      await addUsers(firebaseUsersPayload);
      await loadFirebaseUsers();
      dispatch({ type: 'UPLOAD_USERS', payload: previewUsers });
      toast({ title: "Users Uploaded", description: `Successfully uploaded ${previewUsers.length} users to Firebase.` });

      setCsvFile(null);
      setPreviewUsers([]);
      setPreviewError(null);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({ title: "Upload Failed", description: error.message || 'Failed to upload CSV file', variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const downloadCsvTemplate = () => {
    const header = 'firstName,lastName,facilityName,tickets,pin\n';
    const sample = 'John,Doe,Main Office,100,1234\nJane,Smith,Branch Office,150,5678\n';
    const blob = new Blob([header + sample], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users_template.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const filteredUsers = firebaseUsers.filter(u => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
    return (
      fullName.includes(q) ||
      (u.employeeId || '').toLowerCase().includes(q) ||
      (u.facilityName || '').toLowerCase().includes(q)
    );
  });

  // Stats for overview
  const totalPrizes = state.prizes.length;
  const prizesWithEntriesCount = state.prizes.filter(p => p.entries.length > 0).length;
  const totalTiers = (state.prizeTiers?.length) || 0;
  const totalUsers = firebaseUsers.length;
  const totalTickets = state.prizes.reduce((sum, p) => sum + (p.totalTicketsInPrize || 0), 0);
  const winnersCount = Object.keys(state.winners).length;

  return (
    <div className="space-y-8">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="drawing">Drawing</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row justify-between items-center">
              <CardTitle className="font-headline text-2xl flex items-center">
                <ShieldAlert className="mr-3 h-7 w-7 text-primary" /> Admin Overview
              </CardTitle>
              <div className="flex gap-3">
                <Button onClick={loadFirebasePrizes} variant="outline">
                  <RefreshCcw className="mr-2 h-4 w-4" /> Refresh Prizes
                </Button>
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
                        This action will reset the entire auction. All prize entries will be cleared, winners will be removed, and the auction will be re-opened. Current user ticket allocations will also be reset. Prize configurations will remain. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleResetAuction}>Confirm Reset</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm">
                <span className="text-muted-foreground">Auction Status: </span>
                <Badge variant={isAuctionOpen ? "default" : "secondary"}>{isAuctionOpen ? 'Open' : 'Closed'}</Badge>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm text-muted-foreground">Prizes</div>
                        <div className="text-2xl font-bold">{totalPrizes}</div>
                        <div className="text-xs text-muted-foreground">{prizesWithEntriesCount} with entries</div>
                      </div>
                      <div className="p-2 rounded-full bg-blue-100 text-blue-600">
                        <Gift className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm text-muted-foreground">Prize Tiers</div>
                        <div className="text-2xl font-bold">{totalTiers}</div>
                      </div>
                      <div className="p-2 rounded-full bg-amber-100 text-amber-600">
                        <Layers className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm text-muted-foreground">Users</div>
                        <div className="text-2xl font-bold">{totalUsers}</div>
                      </div>
                      <div className="p-2 rounded-full bg-purple-100 text-purple-600">
                        <Users className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm text-muted-foreground">Tickets Allocated</div>
                        <div className="text-2xl font-bold">{totalTickets}</div>
                      </div>
                      <div className="p-2 rounded-full bg-green-100 text-green-600">
                        <Ticket className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm text-muted-foreground">Winners</div>
                        <div className="text-2xl font-bold">{winnersCount}</div>
                      </div>
                      <div className="p-2 rounded-full bg-rose-100 text-rose-600">
                        <Trophy className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drawing">
          <WinnerDrawing />
        </TabsContent>

        <TabsContent value="inventory">
          <FirebasePrizeManager />
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
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

                <div className="flex gap-2 flex-wrap items-center">
                  <div className="flex-1 min-w-[240px]">
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
                  <Button variant="outline" onClick={downloadCsvTemplate} className="mt-6">
                    Download Template
                  </Button>
                </div>

                {csvFile && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                    <span className="text-sm">{csvFile.name}</span>
                    <span className="text-xs text-muted-foreground">({(csvFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="font-medium">Preview</h4>
                  {previewError ? (
                    <p className="text-sm text-destructive">{previewError}</p>
                  ) : previewUsers.length > 0 ? (
                    <div className="border rounded-md overflow-hidden">
                      <div className="max-h-48 overflow-auto text-sm">
                        <table className="w-full">
                          <thead className="bg-muted">
                            <tr>
                              <th className="text-left p-2">Name</th>
                              <th className="text-left p-2">Employee ID</th>
                              <th className="text-left p-2">Facility</th>
                              <th className="text-left p-2">Tickets</th>
                              <th className="text-left p-2">PIN</th>
                            </tr>
                          </thead>
                          <tbody>
                            {previewUsers.slice(0, 10).map((u, i) => (
                              <tr key={i} className="border-t">
                                <td className="p-2">{u.firstName} {u.lastName}</td>
                                <td className="p-2">{u.employeeId}</td>
                                <td className="p-2">{u.facilityName}</td>
                                <td className="p-2">{u.tickets}</td>
                                <td className="p-2">{u.pin}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="p-2 text-xs text-muted-foreground">Showing first {Math.min(10, previewUsers.length)} of {previewUsers.length}</div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Select a CSV to preview users before uploading.</p>
                  )}
                </div>

                <Button onClick={handleCsvUpload} disabled={previewUsers.length === 0 || uploading} className="w-full sm:w-auto">
                  {uploading ? 'Uploading...' : `Confirm Upload (${previewUsers.length})`}
                </Button>
              </div>

              <div className="border-t pt-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <h3 className="text-lg font-semibold">Firebase Users ({firebaseUsers.length})</h3>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Input
                      placeholder="Search name, employee ID, facility"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full sm:w-72"
                    />
                    <Button onClick={loadFirebaseUsers} variant="outline" size="sm" disabled={loadingUsers}>
                      <RefreshCcw className={`h-4 w-4 mr-2 ${loadingUsers ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {loadingUsers ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map(i => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <p className="text-muted-foreground">No users found.</p>
                  ) : (
                    <div className="space-y-2">
                      {filteredUsers.map((user) => (
                        <div key={user.id} className="flex justify-between items-center p-2 bg-muted rounded">
                          <div>
                            <span className="font-medium">{user.firstName} {user.lastName}</span>
                            <span className="text-sm text-muted-foreground ml-2">({user.employeeId}) - {user.tickets} tickets</span>
                            <span className="text-xs text-muted-foreground block">{user.facilityName}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
