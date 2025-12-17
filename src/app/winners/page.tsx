"use client";
import { useAppContext } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Gift, Users, Calendar } from 'lucide-react';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import SlotMachine from '@/components/SlotMachine';

const formatWinnerKey = (prizeId: string, winnerId: string) => `${prizeId}:${winnerId}`;

export default function WinnersPage() {
  const { state } = useAppContext();
  const { prizes, winners, allUsers, isAuctionOpen } = state;
  const [showSlotMachine, setShowSlotMachine] = useState(false);
  const [currentWinner, setCurrentWinner] = useState<{
    prizeId: string;
    winnerId: string;
    winnerName: string;
    prizeName: string;
    winnerProfilePicture?: string;
  } | null>(null);
  const [displayedWinners, setDisplayedWinners] = useState<Set<string>>(new Set());
  const previousWinnersRef = useRef<Record<string, string[]>>({});
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [winnerQueue, setWinnerQueue] = useState<Array<{
    prizeId: string;
    winnerId: string;
    winnerName: string;
    prizeName: string;
    winnerProfilePicture?: string;
  }>>([]);

  // Get prizes that have winners
  const prizesWithWinners = prizes.filter(prize => (winners[prize.id] || []).length > 0);

  // Get all winners
  const allWinners = Object.entries(winners)
    .flatMap(([prizeId, winnerIds]) => winnerIds.map((winnerId) => {
      const prize = prizes.find(p => p.id === prizeId);
      const winner = allUsers[winnerId];
      return { prize, winner, winnerId };
    }))
    .filter(item => item.prize && item.winner);

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
      displayedWinnersSize: displayedWinners.size,
      allWinnersLength: allWinners.length,
      winnerResolveDebug: Object.entries(winners).map(([prizeId, winnerId]) => ({
        prizeId,
        winnerId,
        userExists: !!allUsers[winnerId],
        userName: allUsers[winnerId]?.name
      }))
    });

    // Skip slot machine on initial load - mark existing winners as displayed
    if (isInitialLoad && Object.keys(currentWinners).length > 0) {
      const initialKeys = new Set<string>();
      Object.entries(currentWinners).forEach(([prizeId, winnerIds]) => {
        winnerIds.forEach((winnerId) => initialKeys.add(formatWinnerKey(prizeId, winnerId)));
      });

      console.log('Initial load - marking existing winners as displayed:', Array.from(initialKeys));
      setDisplayedWinners(initialKeys);
      previousWinnersRef.current = currentWinners;
      setIsInitialLoad(false);
      return;
    }

    // Find newly drawn winners (only after initial load)
    if (!isInitialLoad) {
      const newWinners = [];
      for (const [prizeId, winnerIds] of Object.entries(currentWinners)) {
        const previousIds = previousWinners[prizeId] || [];
        winnerIds.forEach((winnerId) => {
          const key = formatWinnerKey(prizeId, winnerId);
          const isNewWinner = !previousIds.includes(winnerId) || !displayedWinners.has(key);
          if (isNewWinner) {
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
              newWinners.push({
                prizeId,
                winnerId,
                winnerName: winner.name,
                prizeName: prize.name,
                winnerProfilePicture: winner.profilePictureUrl
              });
            }
          }
        });
      }

      // Add new winners to the queue
      if (newWinners.length > 0) {
        console.log('Adding winners to queue:', newWinners.length);
        setWinnerQueue(prev => [...prev, ...newWinners]);
      }
    }

    previousWinnersRef.current = currentWinners;
  }, [winners, prizes, allUsers, displayedWinners, isInitialLoad]);

  // Process winner queue - show slot machines sequentially
  useEffect(() => {
    if (winnerQueue.length > 0 && !showSlotMachine && !currentWinner) {
      const nextWinner = winnerQueue[0];
      console.log('Processing next winner from queue:', nextWinner.winnerName, 'winning', nextWinner.prizeName);
      setCurrentWinner(nextWinner);
      setShowSlotMachine(true);
      setWinnerQueue(prev => prev.slice(1)); // Remove from queue
    }
  }, [winnerQueue, showSlotMachine, currentWinner]);

  const handleSlotMachineComplete = () => {
    setShowSlotMachine(false);
    if (currentWinner) {
      setDisplayedWinners(prev => new Set([...prev, formatWinnerKey(currentWinner.prizeId, currentWinner.winnerId)]));
    }
    setCurrentWinner(null);
  };

  // Show "lottery in progress" only if no winners have been drawn yet AND not showing slot machine (regardless of auction status)
  if (allWinners.length === 0 && !showSlotMachine) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="p-6 bg-primary/10 rounded-full">
              <Gift className="h-16 w-16 text-primary" />
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-bold font-headline mb-4">Ready for Drawing</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              The lottery setup is complete! Winners will be announced here as they are drawn.
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
                <Badge variant={isAuctionOpen ? "default" : "secondary"} className="text-sm">
                  {isAuctionOpen ? "Ready to Draw" : "Drawing Complete"}
                </Badge>
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
            allUsers={Object.entries(allUsers).map(([id, user]) => ({ id, name: user.name, profilePictureUrl: user.profilePictureUrl }))}
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
                {winnerQueue.length > 0
                  ? `Announcing winners... ${winnerQueue.length + 1} more to go!`
                  : "Drawing in progress... More winners being announced!"
                }
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
