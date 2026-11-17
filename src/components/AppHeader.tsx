
"use client";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Settings, LogIn, LogOut, UserCircle, ShieldCheck, Trophy, Camera } from 'lucide-react';
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
  const { state, logout, isAdmin } = useAppContext();
  const { currentUser } = state;
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-4 sm:pt-4">
      <div className="container mx-auto flex justify-between items-center gap-3 rounded-2xl border border-white/40 bg-primary/80 px-4 py-3 text-primary-foreground shadow-[0_10px_40px_-12px_hsl(4_70%_45%/0.55),inset_0_1px_0_hsl(0_0%_100%/0.35)] backdrop-blur-xl backdrop-saturate-150">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <img
            src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS_Co0r39JGCIAOeT0xsgpRoy92u2VljkLfaA&s"
            alt="Heart Logo"
            className="h-8 w-8 shrink-0 sm:h-12 sm:w-12 object-contain"
          />
          <h1 className="whitespace-nowrap text-lg font-bold font-headline sm:text-2xl">ACCO-LOTTERY</h1>
        </Link>
        <div className="flex shrink-0 items-center gap-1 sm:gap-4">
          {isHydrated && (
            <Link href="/winners" passHref>
              <Button variant="ghost" className="px-2 text-primary-foreground hover:bg-primary-foreground/10 sm:px-4">
                <Trophy className="h-4 w-4 sm:mr-2" />
                <span className="sr-only sm:not-sr-only">Winners</span>
              </Button>
            </Link>
          )}
          {isHydrated && currentUser ? (
            <>
              <UserTicketInfo />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 px-1 hover:bg-primary-foreground/10 text-primary-foreground sm:px-4">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={currentUser.profilePictureUrl || ''} />
                      <AvatarFallback className="bg-primary-foreground text-primary">
                        <UserCircle className="h-6 w-6" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:inline">{currentUser.firstName}</span>
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
