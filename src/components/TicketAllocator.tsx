
"use client";
import { useState, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { MinusCircle, PlusCircle, Send } from 'lucide-react';

interface TicketAllocatorProps {
  prizeId: string;
}

export default function TicketAllocator({ prizeId }: TicketAllocatorProps) {
  const { state, dispatch, remainingTickets } = useAppContext();
  const { currentUser } = state;

  // Ensure currentUser is available before proceeding
  const currentAllocation = currentUser ? currentUser.allocatedTickets[prizeId] || 0 : 0;
  const [numTickets, setNumTickets] = useState(currentAllocation);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  // Only update from external sources if user hasn't interacted yet, or if the allocation actually changed
  useEffect(() => {
    if (!currentUser) {
      setNumTickets(0);
      setHasUserInteracted(false);
      return;
    }

    const newAllocation = currentUser.allocatedTickets[prizeId] || 0;
    
    // Only update if user hasn't interacted, or if the external value actually changed
    if (!hasUserInteracted || (hasUserInteracted && newAllocation !== numTickets && newAllocation !== 0)) {
      setNumTickets(newAllocation);
    }
  }, [currentUser?.allocatedTickets, prizeId]); // Remove currentUser from deps to avoid constant re-renders


  if (!currentUser) {
    return <p className="text-xs text-muted-foreground text-center">Please log in to allocate tickets.</p>;
  }

  const handleAllocate = () => {
    if (numTickets < 0) {
      toast({ title: "Invalid Input", description: "Number of tickets cannot be negative.", variant: "destructive" });
      return;
    }

    const diff = numTickets - currentAllocation;
    if (diff > remainingTickets) {
      toast({ title: "Not Enough Tickets", description: `You only have ${remainingTickets} tickets remaining.`, variant: "destructive" });
      return;
    }
    
    dispatch({
      type: 'ALLOCATE_TICKETS',
      payload: { prizeId, userId: currentUser.id, userName: currentUser.name, count: numTickets },
    });
    toast({ title: "Tickets Allocated!", description: `You've allocated ${numTickets} tickets to this prize.` });
  };

  const maxAffordable = currentAllocation + remainingTickets;

  const handleIncrement = () => {
    setHasUserInteracted(true);
    if (numTickets < maxAffordable) {
      setNumTickets(prev => prev + 1);
    } else {
      toast({ title: "Max tickets reached", description: "You don't have enough tickets to add more.", variant: "destructive" });
    }
  };

  const handleDecrement = () => {
    setHasUserInteracted(true);
    if (numTickets > 0) {
      setNumTickets(prev => prev - 1);
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHasUserInteracted(true);
    const inputValue = e.target.value;
    
    // Allow empty input while typing
    if (inputValue === '') {
        setNumTickets(0);
        return;
    }
    
    const value = parseInt(inputValue, 10);
    
    if (isNaN(value) || value < 0) {
        setNumTickets(0);
    } else if (value > maxAffordable) {
        setNumTickets(maxAffordable);
        toast({ title: "Max tickets reached", description: `Cannot exceed available tickets. Max is ${maxAffordable}.`, variant: "destructive" });
    } else {
        setNumTickets(value);
    }
  };

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Ensure valid value on blur
    const value = parseInt(e.target.value, 10);
    if (isNaN(value) || value < 0) {
      setNumTickets(0);
    } else if (value > maxAffordable) {
      setNumTickets(maxAffordable);
    }
  };

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={handleDecrement} disabled={numTickets <= 0}>
          <MinusCircle className="h-4 w-4" />
        </Button>
        <Input
          type="number"
          value={numTickets}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          min="0"
          max={maxAffordable}
          className="text-center w-16"
          aria-label="Number of tickets to allocate"
        />
        <Button variant="outline" size="icon" onClick={handleIncrement} disabled={numTickets >= maxAffordable}>
          <PlusCircle className="h-4 w-4" />
        </Button>
        <Button onClick={handleAllocate} className="flex-grow bg-accent hover:bg-accent/90 text-accent-foreground">
          <Send className="h-4 w-4 mr-2"/> Allocate
        </Button>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        You have allocated {currentAllocation} tickets here. Max affordable: {maxAffordable}.
      </p>
    </div>
  );
}
