"use client";
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trophy, Shuffle, Target, Users, Gift, Zap } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import { toast } from '@/hooks/use-toast';
import SlotMachine from '@/components/SlotMachine';
import type { Prize } from '@/lib/types';

export default function WinnerDrawing() {
  const { state, dispatch, isAdmin } = useAppContext();
  const { prizes, prizeTiers, winners, isAuctionOpen, pendingConflict, drawsPaused, allUsers } = state;
  const [selectedTier, setSelectedTier] = useState<string>('');
  const [selectedPrize, setSelectedPrize] = useState<string>('');
  const [isDrawAllDialogOpen, setIsDrawAllDialogOpen] = useState(false);
  const [showSlotMachine, setShowSlotMachine] = useState(false);
  const [currentDrawnWinner, setCurrentDrawnWinner] = useState<{
    winnerName: string;
    prizeName: string;
    winnerProfilePicture?: string;
  } | null>(null);
  const conflictUser = pendingConflict ? allUsers[pendingConflict.userId] : null;
  const existingConflictPrize = pendingConflict ? prizes.find(p => p.id === pendingConflict.existingPrizeId) : null;
  const newConflictPrize = pendingConflict ? prizes.find(p => p.id === pendingConflict.newPrizeId) : null;

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

  if (!isAdmin) {
    return (
      <Alert>
        <AlertDescription>
          Admin access required to draw winners.
        </AlertDescription>
      </Alert>
    );
  }

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
    const prizeName = prize?.name ?? 'selected prize';
    
    // Show slot machine first, then dispatch
    if (prize) {
      setCurrentDrawnWinner({
        winnerName: 'Drawing...',
        prizeName: prize.name,
        winnerProfilePicture: undefined
      });
      setShowSlotMachine(true);
      
      // Dispatch after a small delay to show slot machine first
      setTimeout(() => {
        dispatch({ 
          type: 'DRAW_SINGLE_WINNER', 
          payload: { prizeId: selectedPrize } 
        });
      }, 100);
    } else {
      dispatch({ 
        type: 'DRAW_SINGLE_WINNER', 
        payload: { prizeId: selectedPrize } 
      });
      toast({
        title: "Winner Drawn!",
        description: `Winner has been drawn for ${prizeName}.`
      });
    }
    setSelectedPrize('');
  };

  const handleRedrawPrizeWinner = (prizeId: string) => {
    dispatch({
      type: 'REDRAW_PRIZE_WINNER',
      payload: { prizeId }
    });

    const prize: Prize | undefined = prizes.find((p) => p.id === prizeId);
    const prizeWinners = getPrizeWinners(prizeId);
    const winnerId = prizeWinners[prizeWinners.length - 1];
    const winner = winnerId ? state.allUsers[winnerId] : null;
    
    if (winner && prize) {
      setCurrentDrawnWinner({
        winnerName: winner.name,
        prizeName: prize.name,
        winnerProfilePicture: winner.profilePictureUrl
      });
      setShowSlotMachine(true);
    }
  };

  const handleSlotMachineComplete = () => {
    setShowSlotMachine(false);
    setCurrentDrawnWinner(null);
    if (currentDrawnWinner) {
      toast({
        title: "Winner Announced!",
        description: `${currentDrawnWinner.winnerName} wins ${currentDrawnWinner.prizeName}!`
      });
    }
  };

  const [testLoading, setTestLoading] = useState<string | null>(null);

  const handleSeedTestData = async () => {
    setTestLoading('seed');
    try {
      const { seedTestData } = await import('@/lib/firebaseService');
      const result = await seedTestData();
      const parts = [];
      if (result.tiersCreated) parts.push(`${result.tiersCreated} tiers`);
      if (result.usersCreated) parts.push(`${result.usersCreated} users`);
      if (result.prizesCreated) parts.push(`${result.prizesCreated} prizes`);
      toast({
        title: "Test Data Seeded",
        description: parts.length > 0 ? `Created ${parts.join(', ')}.` : 'Test data already exists.',
      });
    } catch (error) {
      console.error('Error seeding test data:', error);
      toast({ title: "Error", description: "Failed to seed test data.", variant: "destructive" });
    } finally {
      setTestLoading(null);
    }
  };

  const handleBulkAllocate = async () => {
    setTestLoading('allocate');
    try {
      const { bulkAllocateTicketsForTest } = await import('@/lib/firebaseService');
      const result = await bulkAllocateTicketsForTest();
      toast({
        title: "Tickets Allocated",
        description: result.allocationsCreated > 0
          ? `Created ${result.allocationsCreated} allocations across all prizes.`
          : 'No users or prizes found. Seed test data first.',
      });
    } catch (error) {
      console.error('Error bulk allocating:', error);
      toast({ title: "Error", description: "Failed to allocate tickets.", variant: "destructive" });
    } finally {
      setTestLoading(null);
    }
  };

  const handleFullTestSetup = async () => {
    setTestLoading('full');
    try {
      const { seedTestData, bulkAllocateTicketsForTest } = await import('@/lib/firebaseService');
      const seedResult = await seedTestData();
      const allocResult = await bulkAllocateTicketsForTest();
      toast({
        title: "Full Test Setup Complete",
        description: `Seeded ${seedResult.usersCreated} users, ${seedResult.prizesCreated} prizes, ${seedResult.tiersCreated} tiers. Created ${allocResult.allocationsCreated} allocations.`,
      });
    } catch (error) {
      console.error('Error in full test setup:', error);
      toast({ title: "Error", description: "Failed to complete test setup.", variant: "destructive" });
    } finally {
      setTestLoading(null);
    }
  };

  const handleClearTestData = async () => {
    setTestLoading('clear');
    try {
      const { clearTestData } = await import('@/lib/firebaseService');
      await clearTestData();
      toast({ title: "Test Data Cleared", description: "All test users, prizes, and allocations removed." });
    } catch (error) {
      console.error('Error clearing test data:', error);
      toast({ title: "Error", description: "Failed to clear test data.", variant: "destructive" });
    } finally {
      setTestLoading(null);
    }
  };

  // Watch for winner updates and update slot machine display
  useEffect(() => {
    if (showSlotMachine && currentDrawnWinner && currentDrawnWinner.winnerName === 'Drawing...') {
      // Find the prize we're drawing for
      const prizesInProgress = Object.keys(state.winners);
      for (const prizeId of prizesInProgress) {
        const prizeWinnerIds = getPrizeWinners(prizeId);
        const winnerId = prizeWinnerIds[prizeWinnerIds.length - 1];
        const winner = winnerId ? state.allUsers[winnerId] : undefined;
        const prize = prizes.find(p => p.id === prizeId);

        if (winner && prize && prize.name === currentDrawnWinner.prizeName) {
          setCurrentDrawnWinner({
            winnerName: winner.name,
            prizeName: prize.name,
            winnerProfilePicture: winner.profilePictureUrl
          });
          break;
        }
      }
    }
  }, [state.winners, showSlotMachine, currentDrawnWinner, prizes, state.allUsers]);

  useEffect(() => {
    if (pendingConflict) {
      setShowSlotMachine(false);
      setCurrentDrawnWinner(null);
      const conflictUser = allUsers[pendingConflict.userId];
      const existingPrize = prizes.find(p => p.id === pendingConflict.existingPrizeId);
      const newPrize = prizes.find(p => p.id === pendingConflict.newPrizeId);

      toast({
        title: "Winner Choice Needed",
        description: `${conflictUser?.name || 'Selected winner'} already holds ${existingPrize?.name || pendingConflict.existingPrizeId} and was drawn for ${newPrize?.name || pendingConflict.newPrizeId}. Choose which prize they keep.`,
      });
    }
  }, [pendingConflict]);

  const prizesWithEntries = prizes.filter(p => p.entries.length > 0);
  const prizesWithWinners = prizes.filter(p => getPrizeWinners(p.id).length > 0);
  const tiersWithPrizes = prizeTiers.filter(tier => {
    const tierPrizes = prizes.filter(p => p.tierId === tier.id && p.entries.length > 0);
    // Only include tier if it has prizes with entries AND at least one prize doesn't have all winners yet
    return tierPrizes.length > 0 && tierPrizes.some(p => !prizeHasAllWinners(p));
  });

  return (
    <div className="space-y-6">
      {showSlotMachine && currentDrawnWinner && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <SlotMachine
            winnerName={currentDrawnWinner.winnerName}
            prizeName={currentDrawnWinner.prizeName}
            winnerProfilePicture={currentDrawnWinner.winnerProfilePicture}
            allUsers={Object.values(state.allUsers)}
            onComplete={handleSlotMachineComplete}
            autoStart={true}
          />
        </div>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Winner Drawing Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
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
                  const winnerNames = prizeWinnerIds
                    .map(id => state.allUsers[id]?.name || 'Unknown')
                    .join(', ');
                  const tier = prizeTiers.find(t => t.id === prize.tierId);
                  
                  return (
                    <div key={prize.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        {tier && (
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: tier.color }}
                          />
                        )}
                        <div>
                          <p className="font-medium">{prize.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Winner: {winnerNames || 'Pending'}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRedrawPrizeWinner(prize.id)}
                        disabled={isAuctionOpen}
                      >
                        <Shuffle className="h-3 w-3 mr-1" />
                        Redraw
                      </Button>
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
          {/* Testing Helpers */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Testing Helper
            </h3>
            <p className="text-sm text-muted-foreground">
              Seed test data and randomly allocate tickets to test the full lottery flow end-to-end.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Button
                onClick={handleSeedTestData}
                variant="outline"
                disabled={testLoading !== null}
              >
                <Users className="h-4 w-4 mr-2" />
                {testLoading === 'seed' ? 'Seeding...' : 'Seed Test Data'}
              </Button>
              <Button
                onClick={handleBulkAllocate}
                variant="outline"
                disabled={testLoading !== null}
              >
                <Shuffle className="h-4 w-4 mr-2" />
                {testLoading === 'allocate' ? 'Allocating...' : 'Allocate Tickets'}
              </Button>
              <Button
                onClick={handleFullTestSetup}
                variant="default"
                disabled={testLoading !== null}
              >
                <Zap className="h-4 w-4 mr-2" />
                {testLoading === 'full' ? 'Setting up...' : 'Full Test Setup'}
              </Button>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={testLoading !== null}
                >
                  {testLoading === 'clear' ? 'Clearing...' : 'Clear Test Data'}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Clear Test Data?</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  This will remove all test users (TEST-*), test prizes, and their associated allocations and winners.
                </p>
                <div className="flex gap-2 justify-end">
                  <Button variant="destructive" onClick={handleClearTestData}>
                    Confirm Clear
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
