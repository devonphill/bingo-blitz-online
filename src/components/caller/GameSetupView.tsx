
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { WinPattern } from '@/types/winPattern';
import { GameType } from '@/types';
import { WinPatternSelector } from '@/components/caller/WinPatternSelector';
import { GameTypeSelector } from '@/components/caller/GameTypeSelector';
import { Play } from 'lucide-react';

interface GameSetupViewProps {
  currentGameType: GameType;
  onGameTypeChange: (type: GameType) => void;
  winPatterns: WinPattern[];
  selectedPatterns: string[];
  onPatternSelect?: (pattern: WinPattern) => void;
  onGoLive: () => void;
  isGoingLive?: boolean;
}

export function GameSetupView({
  currentGameType,
  onGameTypeChange,
  winPatterns,
  selectedPatterns,
  onPatternSelect,
  onGoLive,
  isGoingLive
}: GameSetupViewProps) {
  return (
    <div className="space-y-6 p-6">
      <GameTypeSelector 
        currentGameType={currentGameType} 
        onGameTypeChange={onGameTypeChange}
      />
      
      <WinPatternSelector 
        patterns={winPatterns}
        selectedPatterns={selectedPatterns}
        onPatternSelect={onPatternSelect}
      />
      
      <Button 
        onClick={onGoLive}
        className="w-full"
        disabled={isGoingLive || selectedPatterns.length === 0}
      >
        <Play className="w-4 h-4 mr-2" />
        Go Live
      </Button>
    </div>
  );
}
