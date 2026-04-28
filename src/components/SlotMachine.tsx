"use client";

import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RotateCcw, Trophy, Sparkles, Crown, Star } from 'lucide-react';
import Image from 'next/image';
import styles from './SlotMachine.module.css';

const ICON_HEIGHT = 60;
const WINNER_MESSAGES = [
  "🎉 Congratulations! 🎉",
  "🏆 Winner! 🏆",
  "🎊 You Won! 🎊",
  "⭐ Amazing! ⭐",
  "🎯 Perfect! 🎯",
];

const LOSER_MESSAGES = [
  "Not this time",
  "Try again",
  "So close!",
  "Almost there",
  "Keep trying",
];

interface SpinnerProps {
  onFinish: (position: number) => void;
  timer: number;
  winnerName?: string;
  allUsers?: Array<{id: string, name: string, profilePictureUrl?: string}>;
  winnerProfilePicture?: string;
  showWinner?: boolean;
}

const WinningSound = () => (
  <audio autoPlay className="player" preload="none">
    <source src="/sounds/winning_slot.wav" />
  </audio>
);

const Spinner = forwardRef<{ reset: () => void }, SpinnerProps>(({ onFinish, timer, winnerName, allUsers = [], winnerProfilePicture, showWinner = false }, ref) => {
  const [position, setPosition] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(timer);
  const [isSpinning, setIsSpinning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout>();
  const multiplierRef = useRef(Math.floor(Math.random() * (4 - 1) + 1));
  const startPositionRef = useRef(Math.floor(Math.random() * 9) * ICON_HEIGHT * -1);
  const speedRef = useRef(ICON_HEIGHT * multiplierRef.current);

  const reset = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // Reset values for new spin
    const itemCount = allUsers.length > 0 ? Math.min(allUsers.length, 9) : 9;
    startPositionRef.current = Math.floor(Math.random() * itemCount) * ICON_HEIGHT * -1;
    multiplierRef.current = Math.floor(Math.random() * (4 - 1) + 1);
    speedRef.current = ICON_HEIGHT * multiplierRef.current;

    setPosition(startPositionRef.current);
    setTimeRemaining(timer);
    setIsSpinning(true);

    timerRef.current = setInterval(() => {
      tick();
    }, 100);
  }, [timer, allUsers]);

  const getSymbolFromPosition = useCallback(() => {
    // If we have a predetermined winner, land on winner's position
    if (showWinner && winnerProfilePicture) {
      const finalPosition = 0; // Land on first position (winner)
      setPosition(finalPosition);
      setTimeout(() => onFinish(finalPosition), 0);
      return;
    }

    // For random ending, choose a position that keeps an icon visible
    const totalSymbols = allUsers.length > 0 ? Math.min(allUsers.length, 9) : 9;
    const randomIndex = Math.floor(Math.random() * totalSymbols);
    const finalPosition = randomIndex * ICON_HEIGHT * -1;
    
    setPosition(finalPosition);
    setTimeout(() => onFinish(finalPosition), 0);
  }, [onFinish, showWinner, winnerProfilePicture, allUsers]);

  const tick = useCallback(() => {
    setTimeRemaining((prev) => {
      if (prev <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        setIsSpinning(false);
        getSymbolFromPosition();
        return 0;
      }

      setPosition((prevPosition) => prevPosition - speedRef.current);
      return prev - 100;
    });
  }, [getSymbolFromPosition]);

  useEffect(() => {
    reset();
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [reset]);

  useImperativeHandle(
    ref,
    () => ({
      reset,
    }),
    [reset]
  );

  // Use profile pictures if available, otherwise fallback to emojis
  const defaultImage = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face&auto=format';
  
  let displayItems;
  if (showWinner && winnerProfilePicture) {
    // Show only winner's profile picture repeated
    displayItems = Array(12).fill({ 
      type: 'image', 
      content: winnerProfilePicture,
      name: winnerName 
    });
  } else if (allUsers.length > 0) {
    // Show all user profile pictures
    const userImages = allUsers.map(user => ({
      type: 'image',
      content: user.profilePictureUrl || defaultImage,
      name: user.name
    }));
    
    // Repeat users to fill enough slots for smooth animation
    const repeatedUsers = [];
    while (repeatedUsers.length < 15) {
      repeatedUsers.push(...userImages);
    }
    displayItems = repeatedUsers.slice(0, 15);
  } else {
    // Fallback to emoji icons
    const icons = ['🍒', '🍊', '🍋', '🍇', '🔔', '💎', '⭐', '🍀', '🎰'];
    displayItems = Array(12).fill(null).map((_, i) => ({ 
      type: 'emoji', 
      content: icons[i % icons.length], 
      name: '' 
    }));
  }

  return (
    <div className={styles['slot-spinner']}>
      <div
        style={{ transform: `translateY(${position}px)` }}
        className={styles['slot-icons']}
      >
        {displayItems.map((item, index) => (
          <div key={index} className={styles['slot-icon']}>
            {item.type === 'image' ? (
              <Image
                src={item.content}
                alt={item.name || 'User'}
                width={50}
                height={50}
                className={styles['profile-pic']}
                unoptimized
              />
            ) : (
              item.content
            )}
          </div>
        ))}
      </div>
    </div>
  );
});

Spinner.displayName = "Spinner";

interface SlotMachineProps {
  winnerName?: string;
  prizeName?: string;
  prizeImageUrl?: string;
  winnerProfilePicture?: string;
  allUsers?: Array<{id: string, name: string, profilePictureUrl?: string}>;
  onComplete?: () => void;
  autoStart?: boolean;
}

export default function SlotMachine({
  winnerName,
  prizeName,
  prizeImageUrl,
  winnerProfilePicture,
  allUsers = [],
  onComplete,
  autoStart = false
}: SlotMachineProps) {
  const [winner, setWinner] = useState<boolean | null>(null);
  const [matches, setMatches] = useState<number[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const spinnerRefs = useRef<Array<{ reset: () => void } | null>>([null, null, null]);

  const handleFinish = (value: number) => {
    setMatches((prev) => {
      const newMatches = [...prev, value];
      if (newMatches.length === 3) {
        // For profile picture slots, we always want to show a "win" (all matching winner)
        const results = allUsers.length > 0 ? true : newMatches.every((match) => match === newMatches[0]);
        setWinner(results);
        setShowResult(true);
        setIsSpinning(false);
        if (onComplete) {
          setTimeout(onComplete, 5500);
        }
      }
      return newMatches;
    });
  };

  const handleSpin = () => {
    setWinner(null);
    setMatches([]);
    setShowResult(false);
    setIsSpinning(true);
    spinnerRefs.current.forEach((spinner) => spinner?.reset());
  };

  const getWinnerMessage = () => {
    if (winnerName && prizeName) {
      return `${winnerName} wins ${prizeName}!`;
    }
    return WINNER_MESSAGES[Math.floor(Math.random() * WINNER_MESSAGES.length)];
  };

  const getLoserMessage = () => {
    return LOSER_MESSAGES[Math.floor(Math.random() * LOSER_MESSAGES.length)];
  };

  // Auto-start the slot machine if autoStart is true
  useEffect(() => {
    if (autoStart && !showResult && !isSpinning) {
      handleSpin();
    }
  }, [autoStart, showResult, isSpinning]);

  return (
    <div className="relative w-full max-w-lg mx-auto">
      <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-yellow-400 via-orange-400 to-amber-500 opacity-80 blur-md animate-pulse-glow" style={{ backgroundSize: '200% 200%' }} />
      <Card className="relative w-full overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-card via-card to-yellow-50/40 dark:to-amber-950/30">
        <Sparkles className="absolute top-3 left-3 h-5 w-5 text-yellow-500 animate-sparkle" />
        <Sparkles className="absolute top-3 right-3 h-5 w-5 text-orange-500 animate-sparkle" style={{ animationDelay: '0.7s' }} />
        <Star className="absolute bottom-3 left-3 h-4 w-4 text-amber-500 animate-sparkle" style={{ animationDelay: '1.1s' }} />
        <Star className="absolute bottom-3 right-3 h-4 w-4 text-yellow-500 animate-sparkle" style={{ animationDelay: '0.4s' }} />

        <CardHeader className="text-center pb-2">
          <CardTitle className="flex items-center justify-center gap-2 text-sm uppercase tracking-[0.25em] font-bold bg-gradient-to-r from-yellow-600 via-orange-500 to-amber-600 bg-clip-text text-transparent">
            <Trophy className="h-4 w-4 text-orange-500" />
            Winner Announcement
            <Trophy className="h-4 w-4 text-orange-500" />
          </CardTitle>
        </CardHeader>
      <CardContent className="space-y-6">
        {winner && <WinningSound />}

        {prizeName && (
          <div className="text-center space-y-2 p-4 rounded-xl bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border border-orange-200/50 dark:border-orange-900/40">
            <p className="text-xs uppercase tracking-[0.3em] font-bold text-orange-600/80">
              Drawing for
            </p>
            {prizeImageUrl && (
              <div className="flex justify-center">
                <Image
                  src={prizeImageUrl}
                  alt={prizeName}
                  width={200}
                  height={140}
                  className="rounded-lg shadow-md object-contain max-h-36 bg-white dark:bg-card"
                  unoptimized
                />
              </div>
            )}
            <h3 className="text-2xl font-extrabold font-headline bg-gradient-to-r from-yellow-600 via-orange-500 to-amber-600 bg-clip-text text-transparent leading-tight pb-1">
              {prizeName}
            </h3>
          </div>
        )}

        <div className="text-center space-y-4">
          {winner && winnerProfilePicture && (
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-300 to-orange-400 blur-xl opacity-80 animate-pulse-glow" />
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-400 via-orange-400 to-amber-500 p-1.5">
                  <div className="h-full w-full rounded-full bg-card" />
                </div>
                <Image
                  src={winnerProfilePicture}
                  alt={winnerName || "Winner"}
                  width={120}
                  height={120}
                  className="relative rounded-full h-[120px] w-[120px] object-cover m-1.5"
                  unoptimized
                />
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-2 rounded-full shadow-lg animate-bounce-subtle">
                    <Crown className="h-5 w-5 text-white drop-shadow" />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className={`text-lg font-bold p-4 rounded-xl ${
            winner
              ? 'bg-gradient-to-r from-yellow-100 via-orange-100 to-amber-100 dark:from-amber-950/50 dark:via-orange-950/50 dark:to-yellow-950/50 text-orange-700 dark:text-orange-300 border border-orange-300/60 dark:border-orange-800/60'
              : 'bg-muted'
          }`}>
            {winner === null
              ? isSpinning ? "Drawing winner..." : "Ready to draw..."
              : winner
              ? getWinnerMessage()
              : getLoserMessage()}
          </div>
        </div>

        <div className={styles['slot-machine-container']}>
          <div className={styles['spinner-container']}>
            <Spinner
              onFinish={handleFinish}
              timer={1000}
              winnerName={winnerName}
              allUsers={allUsers}
              winnerProfilePicture={winnerProfilePicture}
              showWinner={winner === true}
              ref={(el) => {
                spinnerRefs.current[0] = el;
              }}
            />
            <Spinner
              onFinish={handleFinish}
              timer={1400}
              winnerName={winnerName}
              allUsers={allUsers}
              winnerProfilePicture={winnerProfilePicture}
              showWinner={winner === true}
              ref={(el) => {
                spinnerRefs.current[1] = el;
              }}
            />
            <Spinner
              onFinish={handleFinish}
              timer={2200}
              winnerName={winnerName}
              allUsers={allUsers}
              winnerProfilePicture={winnerProfilePicture}
              showWinner={winner === true}
              ref={(el) => {
                spinnerRefs.current[2] = el;
              }}
            />
            <div className={styles['gradient-fade']} />
          </div>
        </div>

        {showResult && (
          <div className="text-center">
            <Button onClick={handleSpin} className="w-full">
              <RotateCcw className="h-4 w-4 mr-2" />
              Spin Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
}