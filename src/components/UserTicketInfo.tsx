
"use client";
import { useAppContext } from "@/context/AppContext";
import { Badge } from "@/components/ui/badge";
import { Ticket } from "lucide-react";

export default function UserTicketInfo() {
  const { state, remainingTickets } = useAppContext();
  const { currentUser } = state;

  if (!currentUser) {
    return null; // Don't render if no user is logged in
  }

  return (
    <div className="flex items-center gap-2 text-sm p-2 bg-primary-foreground/10 rounded-md">
      <Ticket className="h-5 w-5 text-accent" />
      <span className="font-medium">Your Tickets:</span>
      <Badge variant="secondary" className="text-base">
        {remainingTickets} / {currentUser.totalInitialTickets}
      </Badge>
    </div>
  );
}
