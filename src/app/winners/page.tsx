"use client";
import { useAppContext } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Gift, Users, Calendar } from 'lucide-react';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import SlotMachine from '@/components/SlotMachine';

export default function WinnersPage() {
  const { state } = useAppContext();
  const { prizes, winners, allUsers, isAuctionOpen } = state;
  const [showSlotMachine, setShowSlotMachine] = useState(false);
  const [currentWinner, setCurrentWinner] = useState<{
    winnerName: string;
    prizeName: string;
    winnerProfilePicture?: string;
  } | null>(null);
  const [displayedWinners, setDisplayedWinners] = useState<Set<string>>(new Set());
  const previousWinnersRef = useRef<Record<string, string>>({});
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Get prizes that have winners
  const prizesWithWinners = prizes.filter(prize => winners[prize.id]);
  
  // Get all winners
  const allWinners = Object.entries(winners).map(([prizeId, winnerId]) => {
    const prize = prizes.find(p => p.id === prizeId);
    const winner = allUsers[winnerId];
    return { prize, winner, winnerId };
  }).filter(item => item.prize && item.winner);

  // Watch for new winners and show slot machine
  useEffect(() => {
    const currentWinners = { ...winners };
    const previousWinners = previousWinnersRef.current;

    console.log('Winners page - checking for new winners:', { 
      currentWinners, 
      previousWinners,
      allUsersKeys: Object.keys(allUsers),
      prizesCount: prizes.length,
      prizeIds: prizes.map(p => p.id),
      userIds: Object.keys(allUsers),
      isInitialLoad,
      displayedWinnersSize: displayedWinners.size
    });

    // Skip slot machine on initial load - mark existing winners as displayed
    if (isInitialLoad && Object.keys(currentWinners).length > 0) {
      console.log('Initial load - marking existing winners as displayed:', Object.keys(currentWinners));
      setDisplayedWinners(new Set(Object.keys(currentWinners)));
      previousWinnersRef.current = currentWinners;
      setIsInitialLoad(false);
      return;
    }

    // Find newly drawn winners (only after initial load)
    if (!isInitialLoad) {
      for (const [prizeId, winnerId] of Object.entries(currentWinners)) {
        if (!previousWinners[prizeId] && winnerId && !displayedWinners.has(prizeId)) {
          const prize = prizes.find(p => p.id === prizeId);
          const winner = allUsers[winnerId];
          
          console.log('New winner detected:', { 
            prizeId, 
            winnerId, 
            prize: prize?.name, 
            winner: winner?.name,
            allUserIds: Object.keys(allUsers)
          });
          
          if (prize && winner) {
            console.log('Showing slot machine for:', winner.name, 'winning', prize.name);
            setCurrentWinner({
              winnerName: winner.name,
              prizeName: prize.name,
              winnerProfilePicture: winner.profilePictureUrl
            });
            setShowSlotMachine(true);
            break; // Show one winner at a time
          }
        }
      }
    }

    previousWinnersRef.current = currentWinners;
  }, [winners, prizes, allUsers, displayedWinners, isInitialLoad]);

  const handleSlotMachineComplete = () => {
    setShowSlotMachine(false);
    if (currentWinner) {
      // Add this winner to displayed set
      const prizeId = Object.entries(winners).find(([_, winnerId]) => {
        const winner = allUsers[winnerId];
        return winner?.name === currentWinner.winnerName;
      })?.[0];
      
      if (prizeId) {
        setDisplayedWinners(prev => new Set(prev.add(prizeId)));
      }
    }
    setCurrentWinner(null);
  };

  // Show "lottery in progress" only if auction is open AND no winners have been drawn yet AND not showing slot machine
  if (isAuctionOpen && allWinners.length === 0 && !showSlotMachine) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="p-6 bg-primary/10 rounded-full">
              <Gift className="h-16 w-16 text-primary" />
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-bold font-headline mb-4">Lottery in Progress</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              The lottery is currently active! Winners will be announced here once the drawing begins.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-12">
            <Card>
              <CardContent className="pt-6 text-center">
                <Gift className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="font-semibold">Total Prizes</p>
                <p className="text-2xl font-bold text-primary">{prizes.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <Users className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="font-semibold">Participants</p>
                <p className="text-2xl font-bold text-primary">{Object.keys(allUsers).length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <Calendar className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="font-semibold">Status</p>
                <Badge variant="secondary" className="text-sm">Active</Badge>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // If showing slot machine, show it with a backdrop
  if (showSlotMachine && currentWinner) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <SlotMachine
            winnerName={currentWinner.winnerName}
            prizeName={currentWinner.prizeName}
            winnerProfilePicture={currentWinner.winnerProfilePicture}
            allUsers={Object.values(allUsers)}
            onComplete={handleSlotMachineComplete}
            autoStart={true}
          />
        </div>
        
        {/* Show background content if there are already some winners */}
        {allWinners.length > 0 && (
          <div className="opacity-30 pointer-events-none">
            <div className="text-center mb-12">
              <div className="flex justify-center mb-6">
                <div className="p-6 bg-accent/20 rounded-full">
                  <Trophy className="h-16 w-16 text-accent" />
                </div>
              </div>
              <h1 className="text-4xl font-bold font-headline mb-4">🎉 Congratulations to Our Winners! 🎉</h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Drawing in progress... More winners being announced!
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (allWinners.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="p-6 bg-muted rounded-full">
              <Trophy className="h-16 w-16 text-muted-foreground" />
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-bold font-headline mb-4">No Winners Yet</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              The lottery has been closed, but no winners have been drawn yet. Check back soon!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <div className="flex justify-center mb-6">
          <div className="p-6 bg-accent/20 rounded-full">
            <Trophy className="h-16 w-16 text-accent" />
          </div>
        </div>
        <h1 className="text-4xl font-bold font-headline mb-4">🎉 Congratulations to Our Winners! 🎉</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          The lottery drawing is complete. Here are our lucky winners:
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {allWinners.map(({ prize, winner, winnerId }) => (
          <Card key={prize!.id} className="overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 border-accent/20">
            <CardHeader className="p-0 relative">
              <Image
                src={prize!.imageUrl || 'https://placehold.co/300x200.png'}
                alt={prize!.name}
                width={300}
                height={200}
                className="w-full h-auto object-contain"
              />
              <div className="absolute top-2 right-2 bg-accent text-accent-foreground p-2 rounded-md shadow-lg">
                <Trophy className="h-6 w-6 inline-block mr-1" />
                <span className="font-bold">Winner!</span>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <CardTitle className="text-xl font-headline mb-2">{prize!.name}</CardTitle>
              <p className="text-sm text-muted-foreground mb-4">
                {prize!.description}
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-accent/10 rounded-md">
                  <span className="font-semibold text-accent">Winner:</span>
                  <span className="font-bold">{winner!.name}</span>
                </div>
                {winner!.facilityName && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                    <span className="font-medium">Facility:</span>
                    <span>{winner!.facilityName}</span>
                  </div>
                )}
                <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                  <span className="font-medium">Total Entries:</span>
                  <Badge variant="secondary">{prize!.totalTicketsInPrize} tickets</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              <Trophy className="h-6 w-6 text-accent" />
              Lottery Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{prizes.length}</p>
                <p className="text-sm text-muted-foreground">Total Prizes</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-accent">{allWinners.length}</p>
                <p className="text-sm text-muted-foreground">Winners Drawn</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-secondary-foreground">{Object.keys(allUsers).length}</p>
                <p className="text-sm text-muted-foreground">Participants</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="text-center mt-8 text-muted-foreground">
        <p>Thank you to all participants! 🎊</p>
      </div>
    </div>
  );
}