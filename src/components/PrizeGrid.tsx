"use client";
import { useAppContext } from "@/context/AppContext";
import PrizeCard from "./PrizeCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";

export default function PrizeGrid() {
  const { state } = useAppContext();
  const { prizes, isAuctionOpen, winners, prizeTiers } = state;

  if (prizes.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>No Prizes Available</AlertTitle>
        <AlertDescription>
          The administrator hasn't added any prizes yet. Check back later!
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div>
      {!isAuctionOpen && Object.keys(winners).length > 0 && (
        <Alert className="mb-6 bg-success/10 border-success text-success-foreground">
          <Info className="h-4 w-4 text-success" />
          <AlertTitle className="font-headline text-success">Auction Closed & Winners Announced!</AlertTitle>
          <AlertDescription>
            Congratulations to the winners! Check below to see who won each prize.
          </AlertDescription>
        </Alert>
      )}
       {!isAuctionOpen && Object.keys(winners).length === 0 && (
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertTitle className="font-headline">Auction Closed</AlertTitle>
          <AlertDescription>
            The auction is currently closed. Winners will be announced soon if not already.
          </AlertDescription>
        </Alert>
      )}
      <div className="space-y-8">
        {/* Prizes grouped by tier */}
        {prizeTiers
          .sort((a, b) => a.order - b.order)
          .map((tier) => {
            const tierPrizes = prizes.filter(prize => prize.tierId === tier.id);
            if (tierPrizes.length === 0) return null;
            
            return (
              <div key={tier.id} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: tier.color }}
                  />
                  <h2 className="text-2xl font-bold">{tier.name}</h2>
                  <p className="text-muted-foreground">{tier.description}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                  {tierPrizes.map((prize) => (
                    <PrizeCard key={prize.id} prize={prize} />
                  ))}
                </div>
              </div>
            );
          })}
        
        {/* Ungrouped prizes */}
        {(() => {
          const ungroupedPrizes = prizes.filter(prize => !prize.tierId);
          if (ungroupedPrizes.length === 0) return null;
          
          return (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Other Prizes</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                {ungroupedPrizes.map((prize) => (
                  <PrizeCard key={prize.id} prize={prize} />
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
