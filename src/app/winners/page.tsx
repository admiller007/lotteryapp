"use client";
import { useAppContext } from '@/context/AppContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Gift, Calendar, Clapperboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect, useRef } from 'react';
import WinnerReveal, { PersonAvatar, type RevealPerson } from '@/components/WinnerReveal';
import HoloCard, { HoloSeal } from '@/components/HoloCard';
import NightRecap from '@/components/NightRecap';
import { allPrizesDrawn } from '@/lib/recapStats';

const formatWinnerKey = (prizeId: string, winnerId: string) => `${prizeId}:${winnerId}`;

interface QueuedWinner {
  prizeId: string;
  winnerId: string;
}

const REVEAL_AUTO_ADVANCE_MS = 10000;
const HIGHLIGHT_MS = 8000;
// Pause between the last winner's reveal and the recap starting on its own.
const RECAP_AUTO_START_MS = 4000;

const winnersSignature = (winners: Record<string, string[]>) =>
  Object.keys(winners)
    .sort()
    .map((prizeId) => `${prizeId}=${[...winners[prizeId]].sort().join(',')}`)
    .join(';');

export default function WinnersPage() {
  const { state, isAdmin } = useAppContext();
  const { prizes, prizeTiers, winners, allUsers, isAuctionOpen, winnersSynced, drawStyle } = state;

  const [queue, setQueue] = useState<QueuedWinner[]>([]);
  const [current, setCurrent] = useState<QueuedWinner | null>(null);
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  // Winners that were already drawn when the page loaded (or that we've queued)
  // so each one is only announced once. null until Firestore has synced.
  const seenRef = useRef<Set<string> | null>(null);
  const [showRecap, setShowRecap] = useState(false);
  // Set once a winner has been announced on this screen, so the recap only
  // starts by itself after a live draw (not when the page is merely reopened).
  const announcedRef = useRef(false);
  // The winners the recap last auto-played for; a redraw lets it play again.
  const autoPlayedForRef = useRef<string | null>(null);

  const toPerson = (userId: string): RevealPerson => {
    const user = allUsers[userId];
    return {
      id: userId,
      name: user?.name || 'Unknown',
      profilePictureUrl: user?.profilePictureUrl,
      facilityName: user?.facilityName,
    };
  };

  const isStillWinner = (item: QueuedWinner) => (winners[item.prizeId] || []).includes(item.winnerId);

  // Queue winners that appear after the page has synced with Firestore.
  useEffect(() => {
    if (!winnersSynced) return;
    const keys = Object.entries(winners).flatMap(([prizeId, ids]) =>
      ids.map((winnerId) => ({ prizeId, winnerId, key: formatWinnerKey(prizeId, winnerId) }))
    );

    if (seenRef.current === null) {
      // First sync: these were drawn before the page opened; don't replay them.
      seenRef.current = new Set(keys.map((k) => k.key));
      return;
    }

    const fresh = keys.filter((k) => !seenRef.current!.has(k.key));
    if (fresh.length === 0) return;
    fresh.forEach((k) => seenRef.current!.add(k.key));
    setQueue((prev) => [...prev, ...fresh.map(({ prizeId, winnerId }) => ({ prizeId, winnerId }))]);
  }, [winners, winnersSynced]);

  // Announce queued winners one at a time, skipping any that were redrawn away.
  useEffect(() => {
    if (current || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    if (isStillWinner(next) && prizes.some((p) => p.id === next.prizeId)) {
      setCurrent(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, current]);

  useEffect(() => {
    if (!highlightKey) return;
    const timer = window.setTimeout(() => setHighlightKey(null), HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [highlightKey]);

  const handleRevealComplete = () => {
    announcedRef.current = true;
    if (current) setHighlightKey(formatWinnerKey(current.prizeId, current.winnerId));
    setCurrent(null);
  };

  // A new winner being announced takes over the screen from the recap.
  useEffect(() => {
    if (current) setShowRecap(false);
  }, [current]);

  // Once the last winner has been announced, roll the recap.
  useEffect(() => {
    if (!announcedRef.current || current || queue.length > 0 || showRecap) return;
    if (!allPrizesDrawn(prizes, winners)) return;
    const signature = winnersSignature(winners);
    if (autoPlayedForRef.current === signature) return;
    const timer = window.setTimeout(() => {
      autoPlayedForRef.current = signature;
      setShowRecap(true);
    }, RECAP_AUTO_START_MS);
    return () => window.clearTimeout(timer);
  }, [current, queue.length, showRecap, prizes, winners]);

  const currentPrize = current ? prizes.find((p) => p.id === current.prizeId) : undefined;
  const currentTier = currentPrize ? prizeTiers.find((t) => t.id === currentPrize.tierId) : undefined;
  const pendingCount = queue.filter(isStillWinner).length;

  const reveal = current && currentPrize && (
    <WinnerReveal
      key={formatWinnerKey(current.prizeId, current.winnerId)}
      prize={{
        name: currentPrize.name,
        imageUrl: currentPrize.imageUrl,
        tierName: currentTier?.name,
        tierColor: currentTier?.color,
      }}
      candidates={Array.from(
        new Set(currentPrize.entries.filter((e) => e.numTickets > 0).map((e) => e.userId))
      ).map(toPerson)}
      winner={toPerson(current.winnerId)}
      drawStyle={drawStyle}
      onComplete={handleRevealComplete}
      autoAdvanceMs={REVEAL_AUTO_ADVANCE_MS}
      remainingCount={pendingCount}
    />
  );

  const prizesWithWinners = prizes.filter((prize) => (winners[prize.id] || []).some((id) => allUsers[id]));
  const totalWinners = prizesWithWinners.reduce(
    (sum, prize) => sum + (winners[prize.id] || []).filter((id) => allUsers[id]).length,
    0
  );

  if (totalWinners === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        {reveal}
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="p-6 bg-primary/10 rounded-full">
              <Gift className="h-16 w-16 text-primary" />
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-bold font-headline mb-4">Ready for Drawing</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Winners will be announced here as they are drawn. Keep this screen open!
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mt-12">
            <Card>
              <CardContent className="pt-6 text-center">
                <Gift className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="font-semibold">Total Prizes</p>
                <p className="text-2xl font-bold text-primary">{prizes.length}</p>
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

  return (
    <div className="container mx-auto px-4 py-8">
      {reveal}
      {showRecap && !current && (
        <NightRecap prizes={prizes} winners={winners} allUsers={allUsers} onClose={() => setShowRecap(false)} />
      )}

      <div className="text-center mb-10">
        <div className="flex justify-center mb-5">
          <div className="p-5 rounded-full bg-amber-100 dark:bg-amber-500/15">
            <Trophy className="h-14 w-14 text-amber-500" />
          </div>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold font-headline mb-3">Congratulations to Our Winners!</h1>
        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
          {pendingCount > 0 || current
            ? 'Announcing winners now…'
            : `${totalWinners} ${totalWinners === 1 ? 'winner' : 'winners'} across ${prizesWithWinners.length} ${prizesWithWinners.length === 1 ? 'prize' : 'prizes'}`}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {prizesWithWinners.map((prize) => {
          const tier = prizeTiers.find((t) => t.id === prize.tierId);
          const winnerIds = (winners[prize.id] || []).filter((id) => allUsers[id]);
          const isHighlighted = winnerIds.some((id) => formatWinnerKey(prize.id, id) === highlightKey);
          return (
            <HoloCard key={prize.id} className="h-full">
            <Card
              className={`overflow-hidden flex flex-col h-full transition-shadow duration-500 ${
                isHighlighted ? 'ring-4 ring-amber-400 shadow-[0_0_40px_rgba(247,201,72,0.45)]' : 'shadow-md hover:shadow-lg'
              }`}
            >
              <div className="relative aspect-[4/3] bg-muted">
                {prize.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={prize.imageUrl} alt={prize.name} className="absolute inset-0 h-full w-full object-contain p-4" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Gift className="h-16 w-16 text-muted-foreground/50" />
                  </div>
                )}
                {tier && (
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-xs font-semibold shadow">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tier.color }} />
                    {tier.name}
                  </span>
                )}
                <HoloSeal className="absolute right-3 top-3" />
              </div>
              <CardContent className="flex flex-1 flex-col gap-4 p-5">
                <div>
                  <h2 className="text-xl font-bold font-headline leading-tight">{prize.name}</h2>
                  {prize.description && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{prize.description}</p>
                  )}
                </div>
                <ul className="mt-auto space-y-2">
                  {winnerIds.map((winnerId) => {
                    const person = toPerson(winnerId);
                    const isNew = formatWinnerKey(prize.id, winnerId) === highlightKey;
                    return (
                      <li
                        key={winnerId}
                        className={`flex items-center gap-3 rounded-xl p-2.5 ${isNew ? 'bg-amber-100 dark:bg-amber-500/15' : 'bg-muted/60'}`}
                      >
                        <PersonAvatar person={person} size={48} className="ring-2 ring-amber-400" />
                        <div className="min-w-0">
                          <p className="font-bold leading-tight truncate">{person.name}</p>
                          {person.facilityName && (
                            <p className="text-sm text-muted-foreground truncate">{person.facilityName}</p>
                          )}
                        </div>
                        <Trophy className="ml-auto h-5 w-5 shrink-0 text-amber-500" aria-label="Winner" />
                      </li>
                    );
                  })}
                </ul>
                <p className="text-xs text-muted-foreground">{prize.totalTicketsInPrize} tickets entered</p>
              </CardContent>
            </Card>
            </HoloCard>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-4 text-center text-muted-foreground">
        <p>Thank you to everyone who took part!</p>
        {isAdmin && (
          <Button variant="outline" onClick={() => setShowRecap(true)} disabled={!!current}>
            <Clapperboard className="mr-2 h-4 w-4" />
            Play the night recap
          </Button>
        )}
      </div>
    </div>
  );
}
