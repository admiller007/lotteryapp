
"use client";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Ticket, Settings, LogIn, LogOut, UserCircle, ShieldCheck, Trophy, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
          {isHydrated && (
            <Link href="/winners" passHref>
              <Button variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10">
                <Trophy className="mr-2 h-4 w-4" />
                Winners
              </Button>
            </Link>
          )}
          {isHydrated && currentUser ? (
            <>
              <UserTicketInfo />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 hover:bg-primary-foreground/10 text-primary-foreground">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={currentUser.profilePictureUrl || ''} />
                      <AvatarFallback className="bg-primary-foreground text-primary">
                        <UserCircle className="h-6 w-6" />
                      </AvatarFallback>
                    </Avatar>
                    <span>{currentUser.firstName}</span>
                    {isAdmin && <ShieldCheck className="h-5 w-5 text-warning" aria-label="Administrator"/>}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>My Account {isAdmin && "(Admin)"}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => router.push('/profile-picture')}>
                    <Camera className="mr-2 h-4 w-4" />
                    <span>Profile Picture</span>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => router.push('/admin')}>
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Admin Panel</span>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
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
