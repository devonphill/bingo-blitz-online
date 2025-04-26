
import React from 'react';
import { GameType, PrizeDetails } from '@/types';
import { WinPattern } from '@/types/winPattern';
import { GameTypeSelector } from './GameTypeSelector';
import { WinPatternSelector } from './WinPatternSelector';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface GameConfigFormProps {
  gameNumber: number;
  gameType: GameType;
  onGameTypeChange: (type: GameType) => void;
  winPatterns: WinPattern[];
  selectedPatterns: string[];
  onPatternSelect?: (pattern: WinPattern) => void;
  prizes: { [patternId: string]: PrizeDetails };
  onPrizeChange?: (patternId: string, prizeDetails: PrizeDetails) => void;
}

export function GameConfigForm({
  gameNumber,
  gameType,
  onGameTypeChange,
  winPatterns,
  selectedPatterns,
  onPatternSelect,
  prizes,
  onPrizeChange,
}: GameConfigFormProps) {
  console.log(`GameConfigForm for Game ${gameNumber} - Prizes:`, prizes);
  
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Game {gameNumber} Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <GameTypeSelector 
          currentGameType={gameType} 
          onGameTypeChange={onGameTypeChange}
        />
        
        <WinPatternSelector 
          patterns={winPatterns}
          selectedPatterns={selectedPatterns}
          onPatternSelect={onPatternSelect}
          prizes={prizes}
          onPrizeChange={onPrizeChange}
        />
      </CardContent>
    </Card>
  );
}
