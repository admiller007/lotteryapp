"use client";
import { useAppContext } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Gift } from 'lucide-react';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import SlotMachine from '@/components/SlotMachine';

type WinnerInfo = {
  prizeId: string;
  winnerId: string;
  winnerName: string;
  prizeName: string;
  prizeImageUrl?: string;
  winnerProfilePicture?: string;
};

const formatWinnerKey = (prizeId: string, winnerId: string) => `${prizeId}:${winnerId}`;

export default function WinnersPage() {
  const { state } = useAppContext();
  const { prizes, winners, allUsers, isAuctionOpen } = state;
  const [showSlotMachine, setShowSlotMachine] = useState(false);
  const [currentWinner, setCurrentWinner] = useState<WinnerInfo | null>(null);
  const [lastWinner, setLastWinner] = useState<WinnerInfo | null>(null);
  const [displayedWinners, setDisplayedWinners] = useState<Set<string>>(new Set());
  const previousWinnersRef = useRef<Record<string, string[]>>({});
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [winnerQueue, setWinnerQueue] = useState<WinnerInfo[]>([]);

  const prizesMap = new Map(prizes.map(p => [p.id, p]));

  const allWinners = Object.entries(winners)
    .flatMap(([prizeId, winnerIds]) => winnerIds.map((winnerId) => {
      const prize = prizesMap.get(prizeId);
      const winner = allUsers[winnerId];
      return { prize, winner, winnerId, prizeId };
    }))
    .filter(item => item.prize && item.winner);

  const nextPrize = prizes.find(p => !(winners[p.id]?.length));

  useEffect(() => {
    const currentWinners = { ...winners };
    const previousWinners = previousWinnersRef.current;

    if (isInitialLoad && Object.keys(currentWinners).length > 0) {
      const initialKeys = new Set<string>();
      let mostRecent: WinnerInfo | null = null;
      Object.entries(currentWinners).forEach(([prizeId, winnerIds]) => {
        winnerIds.forEach((winnerId) => {
          initialKeys.add(formatWinnerKey(prizeId, winnerId));
          const prize = prizesMap.get(prizeId);
          const winner = allUsers[winnerId];
          if (prize && winner) {
            mostRecent = {
              prizeId,
              winnerId,
              winnerName: winner.name,
              prizeName: prize.name,
              prizeImageUrl: prize.imageUrl,
              winnerProfilePicture: winner.profilePictureUrl,
            };
          }
        });
      });

      setDisplayedWinners(initialKeys);
      if (mostRecent) setLastWinner(mostRecent);
      previousWinnersRef.current = currentWinners;
      setIsInitialLoad(false);
      return;
    }

    if (!isInitialLoad) {
      const newWinners: WinnerInfo[] = [];
      for (const [prizeId, winnerIds] of Object.entries(currentWinners)) {
        const previousIds = previousWinners[prizeId] || [];
        winnerIds.forEach((winnerId) => {
          const key = formatWinnerKey(prizeId, winnerId);
          const isNewWinner = !previousIds.includes(winnerId) || !displayedWinners.has(key);
          if (isNewWinner) {
            const prize = prizesMap.get(prizeId);
            const winner = allUsers[winnerId];

            if (prize && winner) {
              newWinners.push({
                prizeId,
                winnerId,
                winnerName: winner.name,
                prizeName: prize.name,
                prizeImageUrl: prize.imageUrl,
                winnerProfilePicture: winner.profilePictureUrl,
              });
            }
          }
        });
      }

      if (newWinners.length > 0) {
        setWinnerQueue(prev => [...prev, ...newWinners]);
      }
    }

    previousWinnersRef.current = currentWinners;
  }, [winners, prizes, allUsers, displayedWinners, isInitialLoad]);

  useEffect(() => {
    if (winnerQueue.length > 0 && !showSlotMachine && !currentWinner) {
      const nextWinner = winnerQueue[0];
      setCurrentWinner(nextWinner);
      setShowSlotMachine(true);
      setWinnerQueue(prev => prev.slice(1));
    }
  }, [winnerQueue, showSlotMachine, currentWinner]);

  const handleSlotMachineComplete = () => {
    setShowSlotMachine(false);
    if (currentWinner) {
      setDisplayedWinners(prev => new Set([...prev, formatWinnerKey(currentWinner.prizeId, currentWinner.winnerId)]));
      setLastWinner(currentWinner);
    }
    setCurrentWinner(null);
  };

  if (showSlotMachine && currentWinner) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <SlotMachine
            winnerName={currentWinner.winnerName}
            prizeName={currentWinner.prizeName}
            prizeImageUrl={currentWinner.prizeImageUrl}
            winnerProfilePicture={currentWinner.winnerProfilePicture}
            allUsers={Object.entries(allUsers).map(([id, user]) => ({ id, name: user.name, profilePictureUrl: user.profilePictureUrl }))}
            onComplete={handleSlotMachineComplete}
            autoStart={true}
          />
        </div>
      </div>
    );
  }

  if (prizes.length === 0) {
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
              No prizes have been configured yet. Winners will be announced here as they are drawn.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const heading = lastWinner
    ? "🎉 Congratulations to Our Winners! 🎉"
    : "🎯 Lottery Drawing";

  const subheading = lastWinner && nextPrize
    ? "The drawing is underway. Here's the most recent winner and what's coming up next."
    : lastWinner
    ? "🎊 All prizes have been drawn! Thank you to everyone who participated."
    : isAuctionOpen
    ? "The lottery is ready! Here's the next prize up for grabs."
    : "Winners will be announced here as they are drawn.";

  const showTwoCards = lastWinner && nextPrize;
  const layoutClass = showTwoCards
    ? "grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto"
    : "max-w-md mx-auto";

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <div className="flex justify-center mb-6">
          <div className={`p-6 rounded-full ${lastWinner ? "bg-accent/20" : "bg-primary/10"}`}>
            {lastWinner
              ? <Trophy className="h-16 w-16 text-accent" />
              : <Gift className="h-16 w-16 text-primary" />}
          </div>
        </div>
        <h1 className="text-4xl font-bold font-headline mb-4">{heading}</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">{subheading}</p>
      </div>

      <div className={layoutClass}>
        {lastWinner && (
          <Card className="overflow-hidden shadow-lg border-accent/30">
            <CardHeader className="bg-accent/10">
              <CardTitle className="flex items-center gap-2 text-accent">
                <Trophy className="h-5 w-5" />
                Last Prize Won
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-center">
                <div className="relative">
                  <Image
                    src={lastWinner.winnerProfilePicture || 'https://placehold.co/120x120.png'}
                    alt={lastWinner.winnerName}
                    width={120}
                    height={120}
                    className="rounded-full border-4 border-accent shadow-lg object-cover h-[120px] w-[120px]"
                    unoptimized
                  />
                  <div className="absolute -top-2 -right-2 bg-accent text-accent-foreground p-2 rounded-full shadow-md">
                    <Trophy className="h-4 w-4" />
                  </div>
                </div>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{lastWinner.winnerName}</p>
                {allUsers[lastWinner.winnerId]?.facilityName && (
                  <p className="text-sm text-muted-foreground">
                    {allUsers[lastWinner.winnerId].facilityName}
                  </p>
                )}
              </div>
              <div className="border-t pt-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground text-center mb-2">
                  Won
                </p>
                <div className="flex items-center gap-3">
                  <Image
                    src={lastWinner.prizeImageUrl || 'https://placehold.co/80x80.png'}
                    alt={lastWinner.prizeName}
                    width={80}
                    height={80}
                    className="rounded-md object-contain h-20 w-20 bg-muted"
                    unoptimized
                  />
                  <p className="font-semibold text-lg flex-1">{lastWinner.prizeName}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {nextPrize && (
          <Card className="overflow-hidden shadow-lg border-primary/30">
            <CardHeader className="bg-primary/10">
              <CardTitle className="flex items-center gap-2 text-primary">
                <Gift className="h-5 w-5" />
                Up Next
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-center">
                <Image
                  src={nextPrize.imageUrl || 'https://placehold.co/300x200.png'}
                  alt={nextPrize.name}
                  width={300}
                  height={200}
                  className="rounded-lg shadow-md object-contain max-h-48"
                  unoptimized
                />
              </div>
              <div className="text-center space-y-2">
                <p className="text-2xl font-bold font-headline">{nextPrize.name}</p>
                {nextPrize.description && (
                  <p className="text-sm text-muted-foreground">{nextPrize.description}</p>
                )}
                <Badge variant="secondary" className="mt-2">
                  {nextPrize.totalTicketsInPrize} tickets entered
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {!lastWinner && !nextPrize && allWinners.length === 0 && (
        <div className="text-center text-muted-foreground mt-8">
          <p>No winners yet and no prizes remaining.</p>
        </div>
      )}
    </div>
  );
}
