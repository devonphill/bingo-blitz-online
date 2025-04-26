
import React from 'react';
import { GameType, PrizeDetails } from '@/types';
import { WinPattern } from '@/types/winPattern';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GameTypeSelector } from './GameTypeSelector';
import { WinPatternSelector } from './WinPatternSelector';

interface GameSetupViewProps {
  currentGameType: GameType;
  onGameTypeChange: (type: GameType) => void;
  winPatterns: WinPattern[];
  selectedPatterns: string[];
  onPatternSelect: (pattern: WinPattern) => void;
  onGoLive: () => Promise<void>;
  isGoingLive: boolean;
  prizes?: { [patternId: string]: PrizeDetails };
  onPrizeChange?: (patternId: string, prizeDetails: PrizeDetails) => void;
}

export function GameSetupView({
  currentGameType,
  onGameTypeChange,
  winPatterns,
  selectedPatterns,
  onPatternSelect,
  onGoLive,
  isGoingLive,
  prizes = {},
  onPrizeChange
}: GameSetupViewProps) {
  console.log("GameSetupView - prizes:", prizes);
  console.log("GameSetupView - selectedPatterns:", selectedPatterns);
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Game Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <GameTypeSelector 
            currentGameType={currentGameType} 
            onGameTypeChange={onGameTypeChange}
          />
          
          <WinPatternSelector
            patterns={winPatterns}
            selectedPatterns={selectedPatterns}
            onPatternSelect={onPatternSelect}
            prizes={prizes}
            onPrizeChange={onPrizeChange}
          />
          
          <Button 
            onClick={onGoLive}
            disabled={isGoingLive || selectedPatterns.length === 0}
            className="w-full"
          >
            {isGoingLive ? "Starting Game..." : "Go Live"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
