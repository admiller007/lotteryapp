
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
import { PlusCircle, Edit3, Trash2, Play, RefreshCcw, Award, ShieldAlert, Trophy } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import FirebaseCSVUpload from '@/components/FirebaseCSVUpload';
import FirebasePrizeManager from '@/components/FirebasePrizeManager';

type PrizeFormData = Omit<Prize, 'id' | 'entries' | 'totalTicketsInPrize' | 'winnerId'>;

export default function AdminPage() {
  const { state, dispatch, isAdmin } = useAppContext();
  const router = useRouter();
  const { prizes, isAuctionOpen, winners, allUsers, currentUser } = state;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPrize, setEditingPrize] = useState<Prize | null>(null);
  const [formData, setFormData] = useState<PrizeFormData>({
    name: '',
    description: '',
    imageUrl: '',
  });

  useEffect(() => {
    if (state.currentUser === null) {
      router.push('/login');
    } else if (currentUser && !isAdmin) {
      toast({
        title: "Access Denied",
        description: "You do not have permission to view the admin panel.",
        variant: "destructive",
        duration: 5000,
      });
      router.push('/');
    }
  }, [currentUser, isAdmin, state.currentUser]);

  if (state.currentUser === undefined || !currentUser || !isAdmin) {
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.description) {
      toast({ title: "Missing fields", description: "Name and description are required.", variant: "destructive" });
      return;
    }
    if (editingPrize) {
      dispatch({ type: 'UPDATE_PRIZE', payload: { ...editingPrize, ...formData } });
      toast({ title: "Prize Updated", description: `${formData.name} has been updated.` });
    } else {
      dispatch({ type: 'ADD_PRIZE', payload: formData });
      toast({ title: "Prize Added", description: `${formData.name} has been added.` });
    }
    setFormData({ name: '', description: '', imageUrl: '' });
    setEditingPrize(null);
    setIsFormOpen(false);
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

  const handleDeletePrize = (prizeId: string) => {
    dispatch({ type: 'DELETE_PRIZE', payload: { prizeId } });
    toast({ title: "Prize Deleted", description: "The prize has been removed.", variant: "destructive" });
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

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl flex items-center">
             <ShieldAlert className="mr-3 h-7 w-7 text-primary" /> Admin Auction Control
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4 flex-wrap">
          {isAuctionOpen ? (
            <Button onClick={handleDrawWinners} disabled={prizes.length === 0}>
              <Award className="mr-2 h-4 w-4" /> Draw All Winners & Close Auction
            </Button>
          ) : (
            <>
              <p className="text-lg font-semibold text-green-600">Winners have been drawn! Auction is closed.</p>
              <Button onClick={() => router.push('/winners')} variant="outline" className="ml-4">
                <Trophy className="mr-2 h-4 w-4" /> View Winners Display
              </Button>
            </>
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

      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl">User Management</CardTitle>
        </CardHeader>
        <CardContent>
          <FirebaseCSVUpload />
          {Object.keys(allUsers).length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3">Uploaded Users ({Object.keys(allUsers).length})</h3>
              <div className="max-h-60 overflow-y-auto border rounded-lg">
                <div className="grid grid-cols-4 gap-4 p-3 bg-muted font-semibold text-sm">
                  <div>Name</div>
                  <div>Facility</div>
                  <div>Tickets</div>
                  <div>Status</div>
                </div>
                {Object.entries(allUsers).map(([userId, user]) => (
                  <div key={userId} className="grid grid-cols-4 gap-4 p-3 border-t text-sm">
                    <div>{user.name}</div>
                    <div>{user.facilityName || 'N/A'}</div>
                    <div>{user.tickets || 100}</div>
                    <div>
                      {currentUser?.name === user.name ? (
                        <span className="text-green-600 font-medium">Logged In</span>
                      ) : (
                        <span className="text-muted-foreground">Available</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Ticket Allocation Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {prizes.map((prize) => {
              const prizeWinner = winners[prize.id];
              const winnerUser = prizeWinner ? allUsers[prizeWinner] : null;
              
              return (
                <div key={prize.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold">{prize.name}</h4>
                    <div className="flex gap-2">
                      {!prizeWinner && prize.entries.length > 0 && isAuctionOpen && (
                        <Button 
                          size="sm" 
                          onClick={() => handleDrawSingleWinner(prize.id)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Trophy className="mr-1 h-3 w-3" />
                          Draw Winner
                        </Button>
                      )}
                      {prizeWinner && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleRedrawPrize(prize.id)}
                        >
                          <RefreshCcw className="mr-1 h-3 w-3" />
                          Redraw
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {winnerUser && (
                    <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded-md">
                      <div className="flex items-center text-green-800">
                        <Trophy className="h-4 w-4 mr-1" />
                        <span className="font-medium">Winner: {winnerUser.name}</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="text-sm space-y-1">
                    <div>Total Tickets Allocated: <span className="font-medium">{prize.totalTicketsInPrize}</span></div>
                    <div>Number of Participants: <span className="font-medium">{prize.entries.length}</span></div>
                    {prize.entries.length > 0 && (
                      <div className="mt-2">
                        <div className="text-xs text-muted-foreground mb-1">Participants:</div>
                        {prize.entries.map((entry) => {
                          const user = allUsers[entry.userId];
                          return (
                            <div key={entry.userId} className="text-xs flex justify-between">
                              <span>{user?.name || 'Unknown User'}</span>
                              <span>{entry.numTickets} tickets</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {prize.entries.length === 0 && (
                      <div className="text-orange-500 text-xs">No participants yet</div>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <div className="text-sm font-semibold">Overall Stats:</div>
              <div className="text-sm space-y-1 mt-2">
                <div>Total Tickets in Play: <span className="font-medium">{prizes.reduce((sum, p) => sum + p.totalTicketsInPrize, 0)}</span></div>
                <div>Active Participants: <span className="font-medium">{new Set(prizes.flatMap(p => p.entries.map(e => e.userId))).size}</span></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <FirebasePrizeManager />
    </div>
  );
}
