
"use client";
import Image from 'next/image';
import type { Prize } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import TicketAllocator from './TicketAllocator';
import { useAppContext } from '@/context/AppContext';
import { Trophy, Ticket } from 'lucide-react';

interface PrizeCardProps {
  prize: Prize;
}

export default function PrizeCard({ prize }: PrizeCardProps) {
  const { state } = useAppContext();
  const { isAuctionOpen, winners, currentUser, allUsers, prizeTiers } = state;
  const winnerId = winners[prize.id];
  const winner = winnerId ? allUsers[winnerId] : null;
  const isCurrentUserWinner = currentUser && winnerId === currentUser.id;
  const prizeTier = prize.tierId ? prizeTiers.find(tier => tier.id === prize.tierId) : null;
  // Check if the image URL is from an allowed domain for Next.js Image
  const isAllowedDomain = (url: string) => {
    try {
      const hostname = new URL(url).hostname;
      const allowedDomains = [
        'placehold.co',
        'gstatic.com',
        'accoladehc.com',
        'images.unsplash.com',
        'cdn.media.amplience.net',
        'www.jbl.com',
        'amazonaws.com',
        'cloudfront.net'
      ];

      return allowedDomains.some(domain =>
        hostname === domain ||
        hostname.endsWith('.' + domain) ||
        hostname.includes(domain)
      );
    } catch {
      return false;
    }
  };

  const imageUrl = prize.imageUrl || 'https://placehold.co/300x200.png';
  const useNextImage = isAllowedDomain(imageUrl);


  return (
    <Card className="overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="p-0 relative">
        {useNextImage ? (
          <Image
            src={imageUrl}
            alt={prize.name}
            width={300}
            height={200}
            className="w-full h-auto object-contain"
            data-ai-hint="prize item"
          />
        ) : (
          <img
            src={imageUrl}
            alt={prize.name}
            className="w-full h-48 object-contain"
            data-ai-hint="prize item"
          />
        )}
        {isCurrentUserWinner && (
           <div className="absolute top-2 right-2 bg-success text-success-foreground p-2 rounded-md shadow-lg">
             <Trophy className="h-6 w-6 inline-block mr-1" />
             <span className="font-bold">You Won!</span>
           </div>
        )}
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <CardTitle className="text-xl font-headline">{prize.name}</CardTitle>
          {prizeTier && (
            <Badge 
              variant="outline" 
              className="text-xs" 
              style={{ 
                borderColor: prizeTier.color, 
                color: prizeTier.color,
                backgroundColor: `${prizeTier.color}10`
              }}
            >
              {prizeTier.name}
            </Badge>
          )}
        </div>
        <CardDescription className="text-sm text-muted-foreground mb-3">
          {prize.description}
        </CardDescription>
        <div className="flex items-center text-sm text-muted-foreground">
          <Ticket className="h-4 w-4 mr-1 text-primary" />
          <span>Total Tickets Entered: </span>
          <Badge variant="secondary" className="ml-1">{prize.totalTicketsInPrize}</Badge>
        </div>
      </CardContent>
      <CardFooter className="p-4 border-t">
        {isAuctionOpen && currentUser ? ( // Also check if currentUser exists
          <TicketAllocator prizeId={prize.id} />
        ) : winner ? (
          <div className={`flex items-center p-2 rounded-md w-full ${isCurrentUserWinner ? 'bg-success/20' : 'bg-secondary'}`}>
            <Trophy className={`h-5 w-5 mr-2 ${isCurrentUserWinner ? 'text-success' : 'text-primary'}`} />
            <span className="font-semibold">Winner: {winner.name}</span>
          </div>
        ) : isAuctionOpen && !currentUser ? ( // If auction is open but no user logged in
           <p className="text-sm text-muted-foreground p-2 text-center w-full">Log in to allocate tickets.</p>
        ) : (
          <div className="text-sm text-muted-foreground p-2 rounded-md w-full bg-secondary">
            No winner for this prize.
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
