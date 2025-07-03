"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Star, Sparkles, Crown, Gift, ArrowLeft, Users } from 'lucide-react';

export default function WinnersPage() {
  const { state } = useAppContext();
  const router = useRouter();
  const { prizes, winners, allUsers, isAuctionOpen } = state;
  const [animatingPrizes, setAnimatingPrizes] = useState<string[]>([]);

  // Get winners data
  const winnersData = Object.entries(winners).map(([prizeId, winnerId]) => {
    const prize = prizes.find(p => p.id === prizeId);
    const winner = allUsers[winnerId];
    return { prize, winner, prizeId, winnerId };
  }).filter(item => item.prize && item.winner);

  // Animate new winners
  useEffect(() => {
    const newWinners = winnersData.map(w => w.prizeId);
    if (newWinners.length > animatingPrizes.length) {
      const latestWinner = newWinners[newWinners.length - 1];
      setAnimatingPrizes(prev => [...prev, latestWinner]);
      
      // Remove animation after 3 seconds
      setTimeout(() => {
        setAnimatingPrizes(prev => prev.filter(id => id !== latestWinner));
      }, 3000);
    }
  }, [winnersData.length]);

  const getRandomIcon = (index: number) => {
    const icons = [Trophy, Crown, Star, Gift, Sparkles];
    return icons[index % icons.length];
  };

  const getRandomColor = (index: number) => {
    const colors = [
      'from-yellow-400 to-orange-500',
      'from-purple-400 to-pink-500', 
      'from-blue-400 to-cyan-500',
      'from-green-400 to-emerald-500',
      'from-red-400 to-rose-500',
      'from-indigo-400 to-purple-500'
    ];
    return colors[index % colors.length];
  };

  if (isAuctionOpen && winnersData.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              🎊 Winners Display 🎊
            </h1>
          </div>
          
          <Card className="text-center py-16">
            <CardContent>
              <div className="animate-pulse">
                <Trophy className="h-24 w-24 mx-auto mb-6 text-gray-300" />
              </div>
              <h2 className="text-2xl font-semibold mb-4 text-gray-600">
                Waiting for Winners...
              </h2>
              <p className="text-gray-500 mb-6">
                The auction is still open. Winners will appear here once they are drawn!
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                <Users className="h-4 w-4" />
                <span>{Object.keys(allUsers).length} participants registered</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (winnersData.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              🎊 Winners Display 🎊
            </h1>
          </div>
          
          <Card className="text-center py-16">
            <CardContent>
              <Trophy className="h-24 w-24 mx-auto mb-6 text-gray-300" />
              <h2 className="text-2xl font-semibold mb-4 text-gray-600">
                No Winners Yet
              </h2>
              <p className="text-gray-500">
                Winners will be displayed here once the lottery drawing is complete.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            🎊 Congratulations Winners! 🎊
          </h1>
        </div>

        {/* Confetti Animation */}
        <div className="fixed inset-0 pointer-events-none z-0">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            >
              <Sparkles className="h-4 w-4 text-yellow-400 opacity-60" />
            </div>
          ))}
        </div>

        {/* Winners Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
          {winnersData.map((item, index) => {
            const IconComponent = getRandomIcon(index);
            const isAnimating = animatingPrizes.includes(item.prizeId);
            
            return (
              <Card 
                key={item.prizeId} 
                className={`overflow-hidden transition-all duration-500 hover:scale-105 hover:shadow-2xl ${
                  isAnimating ? 'animate-pulse ring-4 ring-yellow-400 shadow-2xl' : ''
                }`}
              >
                <div className={`h-32 bg-gradient-to-br ${getRandomColor(index)} relative overflow-hidden`}>
                  <div className="absolute inset-0 bg-black/10" />
                  <div className="absolute top-4 left-4">
                    <Badge variant="secondary" className="bg-white/90 text-gray-800">
                      Winner!
                    </Badge>
                  </div>
                  <div className="absolute bottom-4 right-4">
                    <IconComponent className="h-12 w-12 text-white/80" />
                  </div>
                  {isAnimating && (
                    <div className="absolute inset-0 bg-yellow-400/20 animate-ping" />
                  )}
                </div>
                
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-bold text-center">
                    {item.prize!.name}
                  </CardTitle>
                </CardHeader>
                
                <CardContent className="text-center">
                  <div className="mb-4">
                    <div className="text-2xl font-bold text-purple-600 mb-1">
                      🏆 {item.winner!.name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {item.winner!.facilityName}
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-600 mb-4">
                    {item.prize!.description}
                  </div>
                  
                  {item.prize!.imageUrl && (
                    <div className="rounded-lg overflow-hidden mb-4">
                      <img 
                        src={item.prize!.imageUrl} 
                        alt={item.prize!.name}
                        className="w-full h-32 object-cover"
                      />
                    </div>
                  )}
                  
                  <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                    <Trophy className="h-3 w-3" />
                    <span>Prize Winner</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Summary Footer */}
        <Card className="mt-12 bg-gradient-to-r from-purple-500 to-blue-500 text-white">
          <CardContent className="text-center py-8">
            <h2 className="text-2xl font-bold mb-4">
              🎉 Lottery Complete! 🎉
            </h2>
            <div className="flex items-center justify-center gap-8 text-lg">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                <span>{winnersData.length} Winners</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <span>{Object.keys(allUsers).length} Participants</span>
              </div>
              <div className="flex items-center gap-2">
                <Gift className="h-5 w-5" />
                <span>{prizes.length} Prizes</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}