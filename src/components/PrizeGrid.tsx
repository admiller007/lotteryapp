"use client";
import { useAppContext } from "@/context/AppContext";
import PrizeCard from "./PrizeCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";

export default function PrizeGrid() {
  const { state } = useAppContext();
  const { prizes, isAuctionOpen, winners } = state;

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
        <Alert className="mb-6 bg-accent/10 border-accent text-accent-foreground">
          <Info className="h-4 w-4 text-accent" />
          <AlertTitle className="font-headline text-accent">Auction Closed & Winners Announced!</AlertTitle>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {prizes.map((prize) => (
          <PrizeCard key={prize.id} prize={prize} />
        ))}
      </div>
    </div>
  );
}
