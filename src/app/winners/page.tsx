"use client";
import { useAppContext } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Gift, Sparkles, Crown, PartyPopper, Star, Ticket } from 'lucide-react';
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

function BackgroundSparkles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <Sparkles className="absolute top-12 left-8 h-6 w-6 text-yellow-400/40 animate-sparkle" style={{ animationDelay: '0s' }} />
      <Star className="absolute top-32 right-12 h-5 w-5 text-amber-400/40 animate-sparkle" style={{ animationDelay: '0.6s' }} />
      <Sparkles className="absolute top-1/2 left-4 h-7 w-7 text-orange-400/30 animate-sparkle" style={{ animationDelay: '1.1s' }} />
      <Star className="absolute bottom-32 right-8 h-6 w-6 text-yellow-400/40 animate-sparkle" style={{ animationDelay: '1.6s' }} />
      <Sparkles className="absolute bottom-12 left-1/3 h-5 w-5 text-amber-400/40 animate-sparkle" style={{ animationDelay: '0.3s' }} />
      <Star className="absolute top-20 right-1/3 h-4 w-4 text-orange-400/40 animate-sparkle" style={{ animationDelay: '1.3s' }} />
    </div>
  );
}

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-gradient-to-br from-amber-950/40 via-background/85 to-orange-950/40">
          <div className="pointer-events-none absolute inset-0">
            <Sparkles className="absolute top-16 left-12 h-10 w-10 text-yellow-400 animate-sparkle" />
            <Star className="absolute top-24 right-16 h-8 w-8 text-amber-400 animate-sparkle" style={{ animationDelay: '0.4s' }} />
            <Sparkles className="absolute bottom-24 left-20 h-12 w-12 text-orange-400 animate-sparkle" style={{ animationDelay: '0.8s' }} />
            <Star className="absolute bottom-16 right-24 h-9 w-9 text-yellow-400 animate-sparkle" style={{ animationDelay: '1.2s' }} />
            <Sparkles className="absolute top-1/3 left-1/4 h-6 w-6 text-amber-300 animate-sparkle" style={{ animationDelay: '1.6s' }} />
            <Star className="absolute top-1/2 right-1/4 h-7 w-7 text-orange-300 animate-sparkle" style={{ animationDelay: '0.2s' }} />
          </div>
          <div className="relative">
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
      </div>
    );
  }

  if (prizes.length === 0) {
    return (
      <div className="relative min-h-[calc(100vh-150px)] overflow-hidden">
        <BackgroundSparkles />
        <div className="container mx-auto px-4 py-16 relative">
          <div className="text-center space-y-8 max-w-2xl mx-auto">
            <div className="flex justify-center">
              <div className="relative animate-float">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 via-orange-400 to-pink-500 blur-2xl opacity-50 rounded-full" />
                <div className="relative p-8 bg-gradient-to-br from-yellow-400 via-orange-400 to-pink-500 rounded-full shadow-2xl">
                  <Gift className="h-20 w-20 text-white" />
                </div>
              </div>
            </div>
            <div>
              <h1 className="text-5xl md:text-6xl font-extrabold font-headline mb-4 bg-gradient-to-r from-yellow-500 via-orange-500 to-pink-500 bg-clip-text text-transparent" style={{ backgroundSize: '200% 200%' }}>
                Ready for the Drawing
              </h1>
              <p className="text-xl text-muted-foreground">
                The stage is set! Winners will be announced here as their names are drawn.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const lastWinnerFacility = lastWinner ? allUsers[lastWinner.winnerId]?.facilityName : undefined;

  const heading = lastWinner
    ? "🎉 We Have a Winner! 🎉"
    : "🎰 The Lottery is On 🎰";

  const subheading = lastWinner && nextPrize
    ? "Congratulations! Up next, the next prize on the line."
    : lastWinner
    ? "🎊 That's a wrap — every prize has been claimed!"
    : isAuctionOpen
    ? "Place your bets — the next drawing is moments away."
    : "Winners will appear here as the drawing goes on.";

  const showTwoCards = lastWinner && nextPrize;

  return (
    <div className="relative min-h-[calc(100vh-150px)] overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-yellow-50/50 via-background to-orange-50/30 dark:from-amber-950/20 dark:via-background dark:to-orange-950/20" />
      <BackgroundSparkles />

      <div className="container mx-auto px-4 py-12 relative">
        <div className="text-center mb-12 space-y-4">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className={`absolute inset-0 blur-2xl opacity-60 rounded-full ${lastWinner ? 'bg-gradient-to-br from-yellow-400 via-orange-400 to-pink-500' : 'bg-gradient-to-br from-primary via-orange-400 to-yellow-400'}`} />
              <div className={`relative p-5 rounded-full shadow-2xl ${lastWinner ? 'bg-gradient-to-br from-yellow-400 via-orange-400 to-pink-500 animate-pulse-glow' : 'bg-gradient-to-br from-primary via-orange-400 to-yellow-400 animate-float'}`}>
                {lastWinner
                  ? <Trophy className="h-12 w-12 text-white drop-shadow-lg" />
                  : <PartyPopper className="h-12 w-12 text-white drop-shadow-lg" />}
              </div>
            </div>
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold font-headline bg-gradient-to-r from-yellow-500 via-orange-500 to-pink-500 bg-clip-text text-transparent leading-tight pb-2" style={{ backgroundSize: '200% 200%' }}>
            {heading}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            {subheading}
          </p>
        </div>

        <div className={showTwoCards
          ? "grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto"
          : "max-w-md mx-auto"
        }>
          {lastWinner && (
            <div className="relative group">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-yellow-400 via-orange-400 to-amber-500 opacity-75 blur-md group-hover:opacity-100 transition-opacity" style={{ backgroundSize: '200% 200%' }} />
              <Card className="relative overflow-hidden border-0 shadow-2xl animate-pulse-glow bg-gradient-to-br from-card via-card to-yellow-50/50 dark:to-amber-950/30">
                <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-gradient-to-br from-yellow-300/40 to-orange-400/40 blur-2xl" />
                <Sparkles className="absolute top-3 left-3 h-5 w-5 text-yellow-500 animate-sparkle" />
                <Sparkles className="absolute top-3 right-3 h-5 w-5 text-orange-500 animate-sparkle" style={{ animationDelay: '0.7s' }} />
                <Star className="absolute bottom-3 left-3 h-4 w-4 text-amber-500 animate-sparkle" style={{ animationDelay: '1.1s' }} />
                <Star className="absolute bottom-3 right-3 h-4 w-4 text-yellow-500 animate-sparkle" style={{ animationDelay: '0.4s' }} />

                <CardHeader className="text-center pb-2 relative">
                  <CardTitle className="flex items-center justify-center gap-2 text-sm uppercase tracking-[0.25em] font-bold bg-gradient-to-r from-yellow-600 via-orange-500 to-amber-600 bg-clip-text text-transparent">
                    <Trophy className="h-4 w-4 text-orange-500" />
                    Latest Winner
                    <Trophy className="h-4 w-4 text-orange-500" />
                  </CardTitle>
                </CardHeader>

                <CardContent className="px-6 pb-6 space-y-5 text-center relative">
                  <div className="flex justify-center">
                    <div className="relative">
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-300 to-orange-400 blur-xl opacity-80 animate-pulse-glow" />
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-400 via-orange-400 to-amber-500 p-1.5" style={{ backgroundSize: '200% 200%' }}>
                        <div className="h-full w-full rounded-full bg-card" />
                      </div>
                      <Image
                        src={lastWinner.winnerProfilePicture || 'https://placehold.co/160x160.png'}
                        alt={lastWinner.winnerName}
                        width={160}
                        height={160}
                        className="relative rounded-full h-40 w-40 object-cover m-1.5"
                        unoptimized
                      />
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-2 rounded-full shadow-lg animate-bounce-subtle">
                          <Crown className="h-6 w-6 text-white drop-shadow" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h2 className="text-3xl md:text-4xl font-extrabold font-headline bg-gradient-to-r from-yellow-600 via-orange-500 to-amber-600 bg-clip-text text-transparent leading-tight pb-1">
                      {lastWinner.winnerName}
                    </h2>
                    {lastWinnerFacility && (
                      <p className="text-sm text-muted-foreground">{lastWinnerFacility}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-[0.3em] font-semibold text-orange-600/80">
                    <span className="h-px w-8 bg-orange-400/40" />
                    Won
                    <span className="h-px w-8 bg-orange-400/40" />
                  </div>

                  <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border border-orange-200/50 dark:border-orange-900/40">
                    <Image
                      src={lastWinner.prizeImageUrl || 'https://placehold.co/80x80.png'}
                      alt={lastWinner.prizeName}
                      width={80}
                      height={80}
                      className="rounded-lg object-contain h-20 w-20 bg-white dark:bg-card shadow-sm shrink-0"
                      unoptimized
                    />
                    <p className="font-bold text-lg text-left flex-1 leading-tight">{lastWinner.prizeName}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {nextPrize && (
            <div className="relative group">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-primary via-pink-400 to-orange-400 opacity-50 blur-md group-hover:opacity-75 transition-opacity" style={{ backgroundSize: '200% 200%' }} />
              <Card className="relative overflow-hidden border-0 shadow-xl animate-float bg-gradient-to-br from-card via-card to-primary/5">
                <div className="absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-gradient-to-tr from-primary/30 to-pink-300/30 blur-2xl" />
                <Sparkles className="absolute top-3 right-3 h-5 w-5 text-primary/70 animate-sparkle" />
                <Star className="absolute bottom-3 left-3 h-4 w-4 text-pink-400/70 animate-sparkle" style={{ animationDelay: '0.9s' }} />

                <CardHeader className="text-center pb-2 relative">
                  <CardTitle className="flex items-center justify-center gap-2 text-sm uppercase tracking-[0.25em] font-bold bg-gradient-to-r from-primary via-pink-500 to-orange-500 bg-clip-text text-transparent">
                    <Gift className="h-4 w-4 text-primary" />
                    Up Next
                    <Gift className="h-4 w-4 text-primary" />
                  </CardTitle>
                </CardHeader>

                <CardContent className="px-6 pb-6 space-y-4 text-center relative">
                  <div className="flex justify-center">
                    <div className="relative p-2 rounded-2xl bg-gradient-to-br from-primary/20 via-pink-200/40 to-orange-200/40 dark:from-primary/30 dark:via-pink-900/40 dark:to-orange-900/40">
                      <Image
                        src={nextPrize.imageUrl || 'https://placehold.co/300x200.png'}
                        alt={nextPrize.name}
                        width={300}
                        height={200}
                        className="rounded-xl shadow-lg object-contain max-h-52 bg-white dark:bg-card"
                        unoptimized
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl md:text-3xl font-extrabold font-headline bg-gradient-to-r from-primary via-pink-500 to-orange-500 bg-clip-text text-transparent leading-tight pb-1">
                      {nextPrize.name}
                    </h3>
                    {nextPrize.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{nextPrize.description}</p>
                    )}
                  </div>
                  <div className="flex justify-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/15 via-pink-200/30 to-orange-200/30 border border-primary/20 text-sm font-semibold">
                      <Ticket className="h-4 w-4 text-primary" />
                      <span>{nextPrize.totalTicketsInPrize} tickets in the pot</span>
                    </div>
                  </div>
                  {isAuctionOpen && (
                    <p className="text-xs uppercase tracking-[0.3em] font-bold text-primary animate-pulse">
                      Drawing soon
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {!lastWinner && !nextPrize && (
          <div className="text-center text-muted-foreground mt-8">
            <p>No winners yet and no prizes remaining.</p>
          </div>
        )}
      </div>
    </div>
  );
}
