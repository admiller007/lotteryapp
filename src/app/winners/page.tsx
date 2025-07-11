"use client";
import { useAppContext } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Gift, Users, Calendar } from 'lucide-react';
import Image from 'next/image';

export default function WinnersPage() {
  const { state } = useAppContext();
  const { prizes, winners, allUsers, isAuctionOpen } = state;

  // Get prizes that have winners
  const prizesWithWinners = prizes.filter(prize => winners[prize.id]);
  
  // Get all winners
  const allWinners = Object.entries(winners).map(([prizeId, winnerId]) => {
    const prize = prizes.find(p => p.id === prizeId);
    const winner = allUsers[winnerId];
    return { prize, winner, winnerId };
  }).filter(item => item.prize && item.winner);

  // Show "lottery in progress" only if auction is open AND no winners have been drawn yet
  if (isAuctionOpen && allWinners.length === 0) {
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