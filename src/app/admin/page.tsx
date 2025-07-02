
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
import { PlusCircle, Edit3, Trash2, Play, RefreshCcw, Award, ShieldAlert } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

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
    }
  }, [currentUser, isAdmin, router, state.currentUser]);

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
        <CardContent className="flex gap-4">
          {isAuctionOpen ? (
            <Button onClick={handleDrawWinners} disabled={prizes.length === 0}>
              <Award className="mr-2 h-4 w-4" /> Draw All Winners & Close Auction
            </Button>
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

      <Card>
        <CardHeader className="flex flex-row justify-between items-center">
          <CardTitle className="font-headline text-2xl">Manage Prizes</CardTitle>
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNewForm} disabled={!isAuctionOpen && Object.keys(winners).length > 0}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Prize
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{editingPrize ? 'Edit Prize' : 'Add New Prize'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 py-4">
                <div>
                  <Label htmlFor="name">Prize Name</Label>
                  <Input id="name" name="name" value={formData.name} onChange={handleInputChange} required />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" name="description" value={formData.description} onChange={handleInputChange} required />
                </div>
                <div>
                  <Label htmlFor="imageUrl">Image URL</Label>
                  <Input id="imageUrl" name="imageUrl" value={formData.imageUrl} onChange={handleInputChange} placeholder="https://placehold.co/300x200.png" />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button type="submit">{editingPrize ? 'Save Changes' : 'Add Prize'}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {prizes.length === 0 ? (
            <p>No prizes created yet. Add some!</p>
          ) : (
            <ul className="space-y-4">
              {prizes.map((prize) => {
                const currentWinnerId = winners[prize.id];
                const winnerInfo = currentWinnerId ? allUsers[currentWinnerId] : null;
                const canEditOrDelete = isAuctionOpen || !currentWinnerId;

                return (
                  <li key={prize.id} className="flex flex-col sm:flex-row justify-between sm:items-center p-4 border rounded-lg gap-4">
                    <div className="flex-grow">
                      <h3 className="font-semibold">{prize.name}</h3>
                      <p className="text-sm text-muted-foreground truncate max-w-md">{prize.description}</p>
                      {!isAuctionOpen && (
                        <div className="mt-2">
                          {currentWinnerId && winnerInfo ? (
                            <div className="flex items-center gap-2">
                              <p className="text-sm text-green-600 font-medium">
                                Winner: {winnerInfo.name}
                              </p>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="icon" className="h-7 w-7">
                                    <RefreshCcw className="h-3 w-3" />
                                    <span className="sr-only">Re-draw winner for {prize.name}</span>
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Re-draw winner for "{prize.name}"?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will select a new winner for this prize from the original entrants, excluding the current winner ({winnerInfo.name}) and any users who have already won other prizes. If no eligible new winner is found, the prize will become unwon. This action cannot be undone directly, but you can re-draw again if needed.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleRedrawPrize(prize.id)}>Confirm Re-draw</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          ) : prize.entries.length > 0 && prize.entries.some(e => e.numTickets > 0) ? (
                            <div className="flex items-center gap-2">
                              <p className="text-sm text-orange-500 font-medium">No winner selected (or none eligible).</p>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="icon" className="h-7 w-7">
                                    <Play className="h-3 w-3" />
                                    <span className="sr-only">Draw winner for {prize.name}</span>
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Draw winner for "{prize.name}"?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This prize currently has no winner. This will attempt to draw a winner from its entrants, excluding any existing prize winners.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleRedrawPrize(prize.id)}>Confirm Draw</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground font-medium">No entries for this prize.</p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button variant="outline" size="icon" onClick={() => openEditForm(prize)} disabled={!canEditOrDelete}>
                        <Edit3 className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="icon" disabled={!canEditOrDelete}>
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the prize "{prize.name}". If the auction is closed and a winner has been drawn, this action is disabled.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeletePrize(prize.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
