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

export default function WinnerDrawing() {
  const { state, dispatch, isAdmin } = useAppContext();
  const { prizes, prizeTiers, winners, isAuctionOpen } = state;
  const [selectedTier, setSelectedTier] = useState<string>('');
  const [selectedPrize, setSelectedPrize] = useState<string>('');
  const [isDrawAllDialogOpen, setIsDrawAllDialogOpen] = useState(false);
  const [showSlotMachine, setShowSlotMachine] = useState(false);
  const [currentDrawnWinner, setCurrentDrawnWinner] = useState<{
    winnerName: string;
    prizeName: string;
    winnerProfilePicture?: string;
  } | null>(null);

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
    dispatch({ type: 'DRAW_WINNERS' });
    setIsDrawAllDialogOpen(false);
    toast({
      title: "Winners Drawn!",
      description: "All winners have been drawn successfully."
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

    dispatch({ 
      type: 'DRAW_TIER_WINNERS', 
      payload: { tierId: selectedTier } 
    });
    
    const tier = prizeTiers.find(t => t.id === selectedTier);
    toast({
      title: "Tier Winners Drawn!",
      description: `Winners have been drawn for ${tier?.name || 'selected tier'}.`
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

    const prize = prizes.find(p => p.id === selectedPrize);
    
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
        description: `Winner has been drawn for ${prize?.name || 'selected prize'}.`
      });
    }
    setSelectedPrize('');
  };

  const handleRedrawPrizeWinner = (prizeId: string) => {
    dispatch({ 
      type: 'REDRAW_PRIZE_WINNER', 
      payload: { prizeId } 
    });
    
    const prize = prizes.find(p => p.id === prizeId);
    const winnerId = state.winners[prizeId];
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

  const handleRandomlyAllocateTickets = async () => {
    console.log('Current allUsers state:', state.allUsers);
    console.log('All user entries:', Object.entries(state.allUsers));

    // First try to load users from Firebase if local state is empty
    if (Object.keys(state.allUsers).length <= 2) { // Only admin users
      try {
        const { getUsers } = await import('@/lib/firebaseService');
        const firebaseUsers = await getUsers();
        console.log('Loaded Firebase users:', firebaseUsers);
        
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

    console.log('Non-admin users found:', nonAdminUsers);

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

  // Watch for winner updates and update slot machine display
  useEffect(() => {
    if (showSlotMachine && currentDrawnWinner && currentDrawnWinner.winnerName === 'Drawing...') {
      // Find the prize we're drawing for
      const prizesInProgress = Object.keys(state.winners);
      for (const prizeId of prizesInProgress) {
        const winnerId = state.winners[prizeId];
        const winner = state.allUsers[winnerId];
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

  const prizesWithEntries = prizes.filter(p => p.entries.length > 0);
  const prizesWithWinners = prizes.filter(p => winners[p.id]);
  const tiersWithPrizes = prizeTiers.filter(tier => 
    prizes.some(p => p.tierId === tier.id && p.entries.length > 0)
  );

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
          {/* Draw All Winners */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Shuffle className="h-4 w-4" />
              Draw All Winners
            </h3>
            <p className="text-sm text-muted-foreground">
              Draw winners for all prizes at once. Each person can only win one prize.
            </p>
            <Dialog open={isDrawAllDialogOpen} onOpenChange={setIsDrawAllDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  className="w-full" 
                  disabled={!isAuctionOpen || prizesWithEntries.length === 0}
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
              Draw winners for all prizes in a specific tier.
            </p>
            <div className="flex gap-2">
              <Select value={selectedTier} onValueChange={setSelectedTier}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a tier" />
                </SelectTrigger>
                <SelectContent>
                  {tiersWithPrizes.map((tier) => {
                    const tierPrizes = prizes.filter(p => p.tierId === tier.id && p.entries.length > 0);
                    return (
                      <SelectItem key={tier.id} value={tier.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: tier.color }}
                          />
                          <span>{tier.name}</span>
                          <Badge variant="secondary" className="ml-2">
                            {tierPrizes.length} prizes
                          </Badge>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Button 
                onClick={handleDrawTierWinners}
                disabled={!selectedTier}
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
              Draw a winner for a specific individual prize.
            </p>
            <div className="flex gap-2">
              <Select value={selectedPrize} onValueChange={setSelectedPrize}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a prize" />
                </SelectTrigger>
                <SelectContent>
                  {prizesWithEntries
                    .filter(prize => !winners[prize.id]) // Only show prizes without winners
                    .map((prize) => {
                      const tier = prizeTiers.find(t => t.id === prize.tierId);
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
                              {prize.totalTicketsInPrize} tickets
                            </Badge>
                          </div>
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
              <Button 
                onClick={handleDrawSingleWinner}
                disabled={!selectedPrize}
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
                  const winnerId = winners[prize.id];
                  const winner = state.allUsers[winnerId];
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
                            Winner: {winner?.name || 'Unknown'}
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