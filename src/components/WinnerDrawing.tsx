"use client";
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Trophy, Shuffle, Target, Users, Gift, Zap, UserCheck, Lock, LockOpen } from 'lucide-react';
import { useAppContext, buildDrawingPool } from '@/context/AppContext';
import { toast } from '@/hooks/use-toast';
import WinnerReveal, { type RevealPerson } from '@/components/WinnerReveal';
import type { Prize } from '@/lib/types';

interface ActiveDraw {
  prizeId: string;
  /** Winners of the prize before this draw, so we can spot the new one. */
  baseline: string[];
  /** Known up front for manual assignment; otherwise found by diffing. */
  winnerId?: string;
  candidates: RevealPerson[];
  /** lastAction when the draw started; a newer error means the draw failed. */
  startAction: unknown;
}

export default function WinnerDrawing() {
  const { state, dispatch, isAdmin } = useAppContext();
  const { prizes, prizeTiers, winners, isAuctionOpen, allocationsOpen, pendingConflict, drawsPaused, allUsers } = state;
  const [savingAllocationLock, setSavingAllocationLock] = useState(false);

  const handleToggleAllocations = async (open: boolean) => {
    setSavingAllocationLock(true);
    try {
      const { setAllocationsOpen } = await import('@/lib/firebaseService');
      await setAllocationsOpen(open);
      toast({
        title: open ? "Ticket allocation opened" : "Ticket allocation closed",
        description: open ? "Everyone can change their tickets again." : "Nobody can change tickets until you reopen it.",
      });
    } catch (error) {
      console.error('Failed to update allocation setting:', error);
      toast({ title: "Couldn't change ticket allocation", description: "Please try again.", variant: "destructive" });
    } finally {
      setSavingAllocationLock(false);
    }
  };
  const [selectedTier, setSelectedTier] = useState<string>('');
  const [selectedPrize, setSelectedPrize] = useState<string>('');
  const [manualPrizeId, setManualPrizeId] = useState<string>('');
  const [manualWinnerId, setManualWinnerId] = useState<string>('');
  const [isDrawAllDialogOpen, setIsDrawAllDialogOpen] = useState(false);
  const [activeDraw, setActiveDraw] = useState<ActiveDraw | null>(null);
  const conflictUser = pendingConflict ? allUsers[pendingConflict.userId] : null;
  const existingConflictPrize = pendingConflict ? prizes.find(p => p.id === pendingConflict.existingPrizeId) : null;
  const newConflictPrize = pendingConflict ? prizes.find(p => p.id === pendingConflict.newPrizeId) : null;
  const manualPrize = prizes.find((p) => p.id === manualPrizeId);
  const manualPrizeEntrants = manualPrize ? manualPrize.entries.filter((entry) => entry.numTickets > 0) : [];
  const manualEligibleUsers = Array.from(new Set(manualPrizeEntrants.map((entry) => entry.userId)))
    .map((userId) => ({
      id: userId,
      name: state.allUsers[userId]?.name || userId,
      facility: state.allUsers[userId]?.facilityName
    }));

  const resolveConflict = (choice: 'keepExisting' | 'keepNew') => {
    if (!pendingConflict) return;
    const keepPrizeId = choice === 'keepNew' ? pendingConflict.newPrizeId : pendingConflict.existingPrizeId;
    const dropPrizeId = choice === 'keepNew' ? pendingConflict.existingPrizeId : pendingConflict.newPrizeId;

    dispatch({
      type: 'RESOLVE_WINNER_CONFLICT',
      payload: {
        conflictId: pendingConflict.id,
        keepPrizeId,
        dropPrizeId,
        userId: pendingConflict.userId,
      },
    });
  };

  const getPrizeWinners = (prizeId: string) => winners[prizeId] || [];
  const prizeHasAllWinners = (prize: Prize) => getPrizeWinners(prize.id).length >= (prize.numberOfWinners || 1);

  const toPerson = (userId: string): RevealPerson => {
    const user = allUsers[userId];
    return {
      id: userId,
      name: user?.name || userId,
      profilePictureUrl: user?.profilePictureUrl,
      facilityName: user?.facilityName,
    };
  };

  // Everyone who could still win this prize, for the reel.
  const reelCandidates = (prize: Prize, excluded: Set<string>) =>
    Array.from(new Set(buildDrawingPool(prize, excluded, allUsers))).map(toPerson);

  const startReveal = (prize: Prize, candidates: RevealPerson[], winnerId?: string) => {
    setActiveDraw({
      prizeId: prize.id,
      baseline: [...(winners[prize.id] || [])],
      winnerId,
      candidates,
      startAction: state.lastAction,
    });
  };

  const activeDrawPrize = activeDraw ? prizes.find((p) => p.id === activeDraw.prizeId) : undefined;
  const activeDrawTier = activeDrawPrize ? prizeTiers.find((t) => t.id === activeDrawPrize.tierId) : undefined;
  const activeDrawWinnerId = activeDraw
    ? activeDraw.winnerId ?? (winners[activeDraw.prizeId] || []).find((id) => !activeDraw.baseline.includes(id))
    : undefined;
  const activeDrawWinner = activeDrawWinnerId ? toPerson(activeDrawWinnerId) : null;

  const handleDrawAllWinners = () => {
    if (pendingConflict || drawsPaused) {
      toast({
        title: "Resolve Winner Choice",
        description: "Finish the pending winner conflict before drawing more prizes.",
        variant: "destructive",
      });
      return;
    }
    dispatch({ type: 'DRAW_WINNERS' });
    setIsDrawAllDialogOpen(false);
    toast({
      title: "Drawing Winners",
      description: "Drawing winners and pausing if someone already holds a prize."
    });
  };

  const handleDrawTierWinners = () => {
    if (!selectedTier) {
      toast({
        title: "Error",
        description: "Please select a tier to draw winners for.",
        variant: "destructive"
      });
      return;
    }

    if (pendingConflict || drawsPaused) {
      toast({
        title: "Resolve Winner Choice",
        description: "Finish the pending winner conflict before drawing more prizes.",
        variant: "destructive",
      });
      return;
    }

    dispatch({ 
      type: 'DRAW_TIER_WINNERS', 
      payload: { tierId: selectedTier } 
    });
    
    const tier = prizeTiers.find(t => t.id === selectedTier);
    toast({
      title: "Drawing Tier Winners",
      description: `Drawing winners for ${tier?.name || 'selected tier'}. Drawing will pause if a conflict appears.`
    });
    setSelectedTier('');
  };

  const handleDrawSingleWinner = () => {
    if (!selectedPrize) {
      toast({
        title: "Error",
        description: "Please select a prize to draw a winner for.",
        variant: "destructive"
      });
      return;
    }

    if (pendingConflict || drawsPaused) {
      toast({
        title: "Resolve Winner Choice",
        description: "Finish the pending winner conflict before drawing more prizes.",
        variant: "destructive",
      });
      return;
    }

    const prize: Prize | undefined = prizes.find((p) => p.id === selectedPrize);
    if (prize) {
      // Same pool the reducer draws from: nobody who already holds a prize.
      const excluded = new Set<string>(Object.values(winners).flat());
      startReveal(prize, reelCandidates(prize, excluded));
    }
    dispatch({
      type: 'DRAW_SINGLE_WINNER',
      payload: { prizeId: selectedPrize }
    });
    setSelectedPrize('');
  };

  const handleRedrawPrizeWinner = (prizeId: string, winnerId: string) => {
    if (pendingConflict || drawsPaused) {
      toast({
        title: "Resolve Winner Choice",
        description: "Finish the pending winner conflict before redrawing.",
        variant: "destructive",
      });
      return;
    }

    const prize: Prize | undefined = prizes.find((p) => p.id === prizeId);
    if (!prize) return;

    const replacedName = state.allUsers[winnerId]?.name || 'this winner';
    if (!window.confirm(`Redraw ${prize.name}?\n\n${replacedName} will lose this prize and a new winner will be drawn.`)) {
      return;
    }

    // Same eligibility rule the reducer uses: nobody who holds a prize, and
    // not the person being replaced.
    const excluded = new Set<string>([...Object.values(winners).flat(), winnerId]);
    const candidates = reelCandidates(prize, excluded);

    if (candidates.length > 0) {
      startReveal(prize, candidates);
    }

    dispatch({
      type: 'REDRAW_PRIZE_WINNER',
      payload: { prizeId, winnerId }
    });
  };

  const handleAssignSpecificWinner = () => {
    if (!manualPrizeId || !manualWinnerId) {
      toast({
        title: "Error",
        description: "Please select both a prize and a winner.",
        variant: "destructive",
      });
      return;
    }

    if (pendingConflict || drawsPaused) {
      toast({
        title: "Resolve Winner Choice",
        description: "Finish the pending winner conflict before assigning winners.",
        variant: "destructive",
      });
      return;
    }

    const prize = prizes.find((p) => p.id === manualPrizeId);
    if (!prize) {
      toast({
        title: "Prize Not Found",
        description: "Select a valid prize to assign a winner.",
        variant: "destructive",
      });
      return;
    }

    const hasEntries = prize.entries.some((entry) => entry.userId === manualWinnerId && entry.numTickets > 0);
    if (!hasEntries) {
      toast({
        title: "No Entries",
        description: "The selected winner has no entries for this prize.",
        variant: "destructive",
      });
      return;
    }

    const entrants = Array.from(
      new Set(prize.entries.filter((entry) => entry.numTickets > 0).map((entry) => entry.userId))
    ).map(toPerson);
    startReveal(prize, entrants, manualWinnerId);

    dispatch({
      type: 'ASSIGN_SPECIFIC_WINNER',
      payload: { prizeId: manualPrizeId, userId: manualWinnerId },
    });

    setManualPrizeId('');
    setManualWinnerId('');
  };

  const handleRevealComplete = () => {
    if (activeDrawWinner && activeDrawPrize) {
      toast({
        title: "Winner Announced!",
        description: `${activeDrawWinner.name} wins ${activeDrawPrize.name}!`
      });
    }
    setActiveDraw(null);
  };

  const handleRandomlyAllocateTickets = async () => {
    // First try to load users from Firebase if local state is empty
    if (Object.keys(state.allUsers).length <= 2) { // Only admin users
      try {
        const { getUsers } = await import('@/lib/firebaseService');
        const firebaseUsers = await getUsers();
        
        if (firebaseUsers.length > 0) {
          dispatch({
            type: 'UPLOAD_USERS',
            payload: firebaseUsers.map(user => ({
              firstName: user.firstName,
              lastName: user.lastName,
              employeeId: user.employeeId,
              facilityName: user.facilityName,
              tickets: user.tickets,
              pin: user.pin
            }))
          });
          
          toast({
            title: "Users Loaded",
            description: `Loaded ${firebaseUsers.length} users from Firebase. Try again.`,
          });
          return;
        }
      } catch (error) {
        console.error('Error loading Firebase users:', error);
        toast({
          title: "Error",
          description: "Failed to load users from Firebase.",
          variant: "destructive"
        });
        return;
      }
    }

    // Get all non-admin users
    const nonAdminUsers = Object.entries(state.allUsers).filter(([userId, user]) => {
      // Exclude admin users (assuming admin users have 'ADMIN' in their ID or name)
      return !userId.includes('ADMIN') && !user.name?.includes('ADMIN');
    });

    if (nonAdminUsers.length === 0) {
      toast({
        title: "No Users Found",
        description: "No non-admin users found to allocate tickets. Try loading users first.",
        variant: "destructive"
      });
      return;
    }

    if (prizes.length === 0) {
      toast({
        title: "No Prizes Found", 
        description: "No prizes available for ticket allocation.",
        variant: "destructive"
      });
      return;
    }

    // For each user, randomly distribute their tickets across prizes
    nonAdminUsers.forEach(([userId, user]) => {
      const totalTickets = user.tickets || 10; // Default to 10 if not specified
      let remainingTickets = totalTickets;
      
      // Randomly select how many prizes this user will enter
      const maxPrizes = Math.min(prizes.length, Math.ceil(Math.random() * 3) + 1); // 1-4 prizes max
      const selectedPrizes = prizes
        .sort(() => Math.random() - 0.5) // Shuffle
        .slice(0, maxPrizes);

      selectedPrizes.forEach((prize, index) => {
        if (remainingTickets <= 0) return;
        
        // For the last prize, use all remaining tickets
        // For others, use 1-50% of remaining tickets
        let ticketsForThisPrize;
        if (index === selectedPrizes.length - 1) {
          ticketsForThisPrize = remainingTickets;
        } else {
          const maxForThis = Math.floor(remainingTickets * 0.5);
          ticketsForThisPrize = Math.max(1, Math.floor(Math.random() * maxForThis) + 1);
        }
        
        // Allocate tickets to this prize
        dispatch({
          type: 'ALLOCATE_TICKETS',
          payload: {
            prizeId: prize.id,
            userId: userId,
            userName: user.name || 'Unknown',
            count: ticketsForThisPrize
          }
        });
        
        remainingTickets -= ticketsForThisPrize;
      });
    });

    toast({
      title: "Tickets Allocated!",
      description: `Randomly allocated tickets for ${nonAdminUsers.length} users across ${prizes.length} prizes.`
    });
  };

  // If the draw failed (no eligible entrants, etc.), close the reveal now
  // instead of spinning until it times out. The admin page toasts the error.
  useEffect(() => {
    if (!activeDraw || activeDrawWinnerId) return;
    const action = state.lastAction;
    if (action && action !== activeDraw.startAction && (action.type === 'ERROR' || action.type === 'NO_ENTRIES_ERROR')) {
      setActiveDraw(null);
    }
  }, [state.lastAction, activeDraw, activeDrawWinnerId]);

  useEffect(() => {
    if (pendingConflict) {
      setActiveDraw(null);
      const conflictUser = allUsers[pendingConflict.userId];
      const existingPrize = prizes.find(p => p.id === pendingConflict.existingPrizeId);
      const newPrize = prizes.find(p => p.id === pendingConflict.newPrizeId);

      toast({
        title: "Winner Choice Needed",
        description: `${conflictUser?.name || 'Selected winner'} already holds ${existingPrize?.name || pendingConflict.existingPrizeId} and was drawn for ${newPrize?.name || pendingConflict.newPrizeId}. Choose which prize they keep.`,
      });
    }
  }, [pendingConflict]);

  if (!isAdmin) {
    return (
      <Alert>
        <AlertDescription>
          Admin access required to draw winners.
        </AlertDescription>
      </Alert>
    );
  }

  const prizesWithEntries = prizes.filter(p => p.entries.length > 0);
  const prizesWithWinners = prizes.filter(p => getPrizeWinners(p.id).length > 0);
  const tiersWithPrizes = prizeTiers.filter(tier => {
    const tierPrizes = prizes.filter(p => p.tierId === tier.id && p.entries.length > 0);
    // Only include tier if it has prizes with entries AND at least one prize doesn't have all winners yet
    return tierPrizes.length > 0 && tierPrizes.some(p => !prizeHasAllWinners(p));
  });

  return (
    <div className="space-y-6">
      {activeDraw && activeDrawPrize && (
        <WinnerReveal
          key={`${activeDraw.prizeId}:${activeDraw.baseline.join(',')}`}
          prize={{
            name: activeDrawPrize.name,
            imageUrl: activeDrawPrize.imageUrl,
            tierName: activeDrawTier?.name,
            tierColor: activeDrawTier?.color,
          }}
          candidates={activeDraw.candidates}
          winner={activeDrawWinner}
          onComplete={handleRevealComplete}
          autoAdvanceMs={12000}
        />
      )}
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Winner Drawing Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Ticket allocation lock */}
          <div className={`flex items-center justify-between gap-4 p-4 rounded-lg border ${allocationsOpen ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/30' : 'border-green-300 bg-green-50 dark:bg-green-950/30'}`}>
            <div className="flex items-start gap-3">
              {allocationsOpen ? <LockOpen className="h-5 w-5 mt-0.5 text-amber-600" /> : <Lock className="h-5 w-5 mt-0.5 text-green-600" />}
              <div>
                <p className="font-semibold">Ticket allocation is {allocationsOpen ? 'open' : 'closed'}</p>
                <p className="text-sm text-muted-foreground">
                  {allocationsOpen
                    ? 'People can still move tickets. Close it before you start drawing.'
                    : 'Tickets are locked for everyone. Safe to draw.'}
                </p>
              </div>
            </div>
            <Switch
              checked={allocationsOpen}
              onCheckedChange={handleToggleAllocations}
              disabled={savingAllocationLock}
              aria-label="Ticket allocation open"
            />
          </div>

          {pendingConflict && (
            <div className="p-4 border border-yellow-300/70 bg-yellow-50 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-yellow-600" />
                <span className="font-semibold">Winner choice required</span>
                <Badge variant="outline">Draws Paused</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {conflictUser?.name || 'A winner'} already holds {existingConflictPrize?.name || pendingConflict.existingPrizeId} and was drawn for {newConflictPrize?.name || pendingConflict.newPrizeId}. Choose which prize they keep; the other prize will redraw without them.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => resolveConflict('keepExisting')}
                  className="flex-1"
                >
                  Keep {existingConflictPrize?.name || 'existing prize'} (redraw {newConflictPrize?.name || 'new prize'})
                </Button>
                <Button
                  onClick={() => resolveConflict('keepNew')}
                  className="flex-1"
                >
                  Keep {newConflictPrize?.name || 'new prize'} (redraw {existingConflictPrize?.name || 'existing prize'})
                </Button>
              </div>
            </div>
          )}

          {/* Draw All Winners */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Shuffle className="h-4 w-4" />
              Draw All Winners
            </h3>
            <p className="text-sm text-muted-foreground">
              Draw winners for all prizes at once. If someone already has a prize, drawing pauses so you can choose which prize they keep.
            </p>
            <Dialog open={isDrawAllDialogOpen} onOpenChange={setIsDrawAllDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  className="w-full" 
                  disabled={!isAuctionOpen || prizesWithEntries.length === 0 || drawsPaused}
                >
                  <Shuffle className="h-4 w-4 mr-2" />
                  Draw All Winners
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirm Draw All Winners</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p>
                    This will draw winners for all {prizesWithEntries.length} prizes with entries. 
                    The auction will be closed after drawing.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Each person can only win one prize. Winners are drawn randomly based on ticket allocations.
                  </p>
                  <div className="flex gap-2">
                    <Button onClick={handleDrawAllWinners} className="flex-1">
                      Confirm Draw
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setIsDrawAllDialogOpen(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Draw by Tier */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Target className="h-4 w-4" />
              Draw Winners by Tier
            </h3>
            <p className="text-sm text-muted-foreground">
              Draw winners for all prizes in a specific tier. Drawing pauses if a winner already holds another prize until you choose which to keep.
            </p>
            <div className="flex gap-2">
              <Select value={selectedTier} onValueChange={setSelectedTier}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a tier" />
                </SelectTrigger>
                <SelectContent>
                  {tiersWithPrizes.map((tier) => {
                    const tierPrizes = prizes.filter(p => p.tierId === tier.id && p.entries.length > 0);
                    const prizesWithoutWinners = tierPrizes.filter(p => !prizeHasAllWinners(p));
                    return (
                      <SelectItem key={tier.id} value={tier.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: tier.color }}
                          />
                          <span>{tier.name}</span>
                          <Badge variant="secondary" className="ml-2">
                            {prizesWithoutWinners.length} left
                          </Badge>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Button 
                onClick={handleDrawTierWinners}
                disabled={!selectedTier || drawsPaused}
              >
                <Target className="h-4 w-4 mr-2" />
                Draw Tier
              </Button>
            </div>
          </div>

          {/* Draw Single Prize */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Gift className="h-4 w-4" />
              Draw Single Prize Winner
            </h3>
            <p className="text-sm text-muted-foreground">
              Draw a winner for a specific individual prize. If they already won elsewhere, we’ll pause so you can pick which prize they keep.
            </p>
            <div className="flex gap-2">
              <Select value={selectedPrize} onValueChange={setSelectedPrize}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a prize" />
                </SelectTrigger>
                <SelectContent>
                  {prizesWithEntries
                    .filter(prize => !prizeHasAllWinners(prize)) // Only show prizes without winners
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((prize) => {
                      const tier = prizeTiers.find(t => t.id === prize.tierId);
                      const currentCount = getPrizeWinners(prize.id).length;
                      const totalNeeded = prize.numberOfWinners || 1;
                      return (
                        <SelectItem key={prize.id} value={prize.id}>
                          <div className="flex items-center gap-2">
                            {tier && (
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: tier.color }}
                              />
                            )}
                            <span>{prize.name}</span>
                            <Badge variant="secondary" className="ml-2">
                              {currentCount}/{totalNeeded} winners
                            </Badge>
                          </div>
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
              <Button 
                onClick={handleDrawSingleWinner}
                disabled={!selectedPrize || drawsPaused}
              >
                <Gift className="h-4 w-4 mr-2" />
                Draw Winner
              </Button>
            </div>
          </div>

          {/* Assign Specific Winner */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Choose a Specific Winner
            </h3>
            <p className="text-sm text-muted-foreground">
              Manually select the winner for a prize from users who have entries for it. Conflicts are handled just like random draws.
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <Select value={manualPrizeId} onValueChange={(value) => { setManualPrizeId(value); setManualWinnerId(''); }}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a prize" />
                  </SelectTrigger>
                  <SelectContent>
                    {prizesWithEntries
                      .filter(prize => !prizeHasAllWinners(prize))
                      .map((prize) => {
                      const tier = prizeTiers.find(t => t.id === prize.tierId);
                      const currentCount = getPrizeWinners(prize.id).length;
                      const totalNeeded = prize.numberOfWinners || 1;
                      return (
                        <SelectItem key={prize.id} value={prize.id}>
                          <div className="flex items-center gap-2">
                            {tier && (
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: tier.color }}
                              />
                            )}
                            <span>{prize.name}</span>
                            <Badge variant="secondary" className="ml-2">
                              {currentCount}/{totalNeeded} winners
                            </Badge>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Select
                  value={manualWinnerId}
                  onValueChange={setManualWinnerId}
                  disabled={!manualPrizeId || manualEligibleUsers.length === 0}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={manualPrizeId ? "Select an eligible user" : "Choose a prize first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {manualEligibleUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex flex-col">
                          <span>{user.name}</span>
                          {user.facility && (
                            <span className="text-xs text-muted-foreground">{user.facility}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                    {manualPrizeId && manualEligibleUsers.length === 0 && (
                      <SelectItem value="__none" disabled>
                        No users with entries for this prize
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={handleAssignSpecificWinner}
                disabled={!manualPrizeId || !manualWinnerId || drawsPaused}
              >
                <UserCheck className="h-4 w-4 mr-2" />
                Assign Winner
              </Button>
            </div>
          </div>

          {/* Current Winners */}
          {prizesWithWinners.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" />
                Current Winners
              </h3>
              <div className="grid gap-3">
                {prizesWithWinners.map((prize) => {
                  const prizeWinnerIds = getPrizeWinners(prize.id);
                  const tier = prizeTiers.find(t => t.id === prize.tierId);
                  
                  return (
                    <div key={prize.id} className="p-3 border rounded-lg space-y-2">
                      <div className="flex items-center gap-2">
                        {tier && (
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: tier.color }}
                          />
                        )}
                        <p className="font-medium">{prize.name}</p>
                        <span className="text-xs text-muted-foreground">
                          {prizeWinnerIds.length}/{prize.numberOfWinners || 1} winners
                        </span>
                      </div>
                      {prizeWinnerIds.map((winnerId) => (
                        <div key={winnerId} className="flex items-center justify-between gap-2 pl-5">
                          <span className="text-sm">{state.allUsers[winnerId]?.name || 'Unknown'}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRedrawPrizeWinner(prize.id, winnerId)}
                            disabled={drawsPaused}
                            title="Replace this winner with a new random draw"
                          >
                            <Shuffle className="h-3 w-3 mr-1" />
                            Redraw
                          </Button>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Status Information */}
          <div className="space-y-2 p-4 bg-muted rounded-lg">
            <h4 className="font-medium">Drawing Status</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Auction Status: </span>
                <Badge variant={isAuctionOpen ? "default" : "secondary"}>
                  {isAuctionOpen ? "Open" : "Closed"}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Draw State: </span>
                <Badge variant={pendingConflict ? "destructive" : "outline"}>
                  {pendingConflict ? "Paused - resolve conflict" : "Ready"}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Prizes with Entries: </span>
                <Badge variant="outline">{prizesWithEntries.length}</Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Winners Drawn: </span>
                <Badge variant="outline">{prizesWithWinners.length}</Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Available Tiers: </span>
                <Badge variant="outline">{tiersWithPrizes.length}</Badge>
              </div>
            </div>
          </div>
          {/* Random Ticket Allocation (Testing) */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Testing Helper
            </h3>
            <p className="text-sm text-muted-foreground">
              Randomly allocate tickets from all non-admin users across all prizes for testing.
            </p>
            <Button 
              onClick={handleRandomlyAllocateTickets}
              variant="outline"
              className="w-full"
            >
              <Zap className="h-4 w-4 mr-2" />
              Randomly Allocate All Tickets
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
