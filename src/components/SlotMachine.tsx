"use client";

import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RotateCcw, Trophy } from 'lucide-react';
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
  winnerProfilePicture?: string;
  allUsers?: Array<{id: string, name: string, profilePictureUrl?: string}>;
  onComplete?: () => void;
  autoStart?: boolean;
}

export default function SlotMachine({ 
  winnerName, 
  prizeName, 
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
          setTimeout(onComplete, 2000);
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
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-center">
          <Trophy className="h-5 w-5" />
          Winner Announcement
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {winner && <WinningSound />}
        
        <div className="text-center space-y-4">
          {/* Winner Profile Picture */}
          {winner && winnerProfilePicture && (
            <div className="flex justify-center">
              <div className="relative">
                <Image
                  src={winnerProfilePicture}
                  alt={winnerName || "Winner"}
                  width={120}
                  height={120}
                  className="rounded-full border-4 border-accent shadow-lg"
                  unoptimized
                />
                <div className="absolute -top-2 -right-2 bg-accent text-accent-foreground p-2 rounded-full">
                  <Trophy className="h-4 w-4" />
                </div>
              </div>
            </div>
          )}
          
          <div className="text-lg font-semibold p-4 rounded-lg bg-muted">
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
  );
}