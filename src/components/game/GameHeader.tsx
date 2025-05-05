
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Trophy } from 'lucide-react';

export interface GameHeaderProps {
  gameNumber: number;
  totalGames: number;
  pattern: string;
  prize: string;
  claimStatus?: 'none' | 'pending' | 'valid' | 'invalid';
  isClaiming?: boolean;
  onClaimBingo?: () => Promise<boolean>;
  // Add the following properties to fix type errors
  gameType?: string;
  playerName?: string;
  playerCode?: string;
  currentGameNumber?: number;
  numberOfGames?: number;
}

export default function GameHeader({
  gameNumber,
  totalGames,
  pattern,
  prize,
  claimStatus = 'none',
  isClaiming = false,
  onClaimBingo,
  // Add the new props (with defaults)
  gameType,
  playerName,
  playerCode,
  currentGameNumber,
  numberOfGames
}: GameHeaderProps) {
  // We'll use the provided gameNumber/totalGames, but if they're not available,
  // we'll fall back to currentGameNumber/numberOfGames
  const effectiveGameNumber = gameNumber || currentGameNumber || 1;
  const effectiveTotalGames = totalGames || numberOfGames || 1;

  return (
    <div className="bg-bingo-muted p-2">
      <div className="container mx-auto">
        <Card className="border-none shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-2">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-xs text-gray-500">Game</div>
                  <div className="font-bold text-lg">{effectiveGameNumber} / {effectiveTotalGames}</div>
                </div>
                
                <Separator orientation="vertical" className="h-10 hidden md:block" />
                
                <div>
                  <div className="text-xs text-gray-500">Current Pattern</div>
                  <div className="font-semibold">{pattern}</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                <div>
                  <div className="text-xs text-gray-500">Prize</div>
                  <div className="font-semibold">{prize}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
