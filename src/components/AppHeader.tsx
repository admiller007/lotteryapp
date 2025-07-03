
"use client";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Ticket, Settings, LogIn, LogOut, UserCircle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import UserTicketInfo from './UserTicketInfo';
import { useAppContext } from '@/context/AppContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function AppHeader() {
  const { state, dispatch, isAdmin } = useAppContext();
  const { currentUser } = state;
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const handleLogout = () => {
    dispatch({ type: 'LOGOUT_USER' });
    router.push('/login');
  };

  return (
    <header className="bg-primary text-primary-foreground shadow-md">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2">
          <Ticket className="h-8 w-8" />
          <h1 className="text-2xl font-bold font-headline">TicketToss</h1>
        </Link>
        <div className="flex items-center gap-4">
          {isHydrated && currentUser ? (
            <>
              <UserTicketInfo />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 hover:bg-primary-foreground/10 text-primary-foreground">
                    <UserCircle className="h-6 w-6" />
                    <span>{currentUser.firstName}</span>
                    {isAdmin && <ShieldCheck className="h-5 w-5 text-accent" title="Administrator"/>}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>My Account {isAdmin && "(Admin)"}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isAdmin && (
                    <DropdownMenuItem onSelect={() => router.push('/admin')}>
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Admin Panel</span>
                    </DropdownMenuItem>
                  )}
                  {isAdmin && <DropdownMenuSeparator />}
                  <DropdownMenuItem onSelect={handleLogout} className="text-red-500 focus:text-red-500 focus:bg-red-500/10">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : isHydrated ? (
            <Link href="/login" passHref>
              <Button variant="secondary">
                <LogIn className="mr-2 h-4 w-4" /> Login
              </Button>
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
