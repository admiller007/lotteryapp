"use client";
import { useAppContext } from "@/context/AppContext";
import { useEffect, useState } from "react";
import TicketStub from "./TicketStub";

export default function UserTicketInfo() {
  const { state, remainingTickets } = useAppContext();
  const { currentUser } = state;
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  if (!isHydrated || !currentUser) {
    return null; // Don't render during SSR or if no user is logged in
  }

  return (
    <TicketStub
      remaining={remainingTickets}
      total={currentUser.totalInitialTickets}
      seed={currentUser.id}
    />
  );
}
