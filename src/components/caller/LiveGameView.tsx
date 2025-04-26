
import React from 'react';
import { WinPattern } from '@/types/winPattern';
import { WinPatternStatusDisplay } from '@/components/game/WinPatternStatusDisplay';
import { CallControls } from '@/components/caller/CallControls';
import BingoCard from '@/components/caller/BingoCard';
import { GameType } from '@/types';

interface LiveGameViewProps {
  gameType: GameType;
  winPatterns: WinPattern[];
  selectedPatterns: string[];
  currentWinPattern: string | null;
  onCallNumber: () => void;
  onRecall: () => void;
  lastCalledNumber: number | null;
  calledNumbers: number[];
  pendingClaims: number;
  onViewClaims: () => void;
}

export function LiveGameView({
  gameType,
  winPatterns,
  selectedPatterns,
  currentWinPattern,
  onCallNumber,
  onRecall,
  lastCalledNumber,
  calledNumbers,
  pendingClaims,
  onViewClaims
}: LiveGameViewProps) {
  const numberRange = gameType === 'mainstage' ? 90 : 75;

  return (
    <div className="space-y-6 p-6">
      <WinPatternStatusDisplay 
        patterns={winPatterns.map(p => ({
          id: p.id,
          name: p.name,
          active: selectedPatterns.includes(p.id)
        }))}
        currentActive={currentWinPattern}
        gameIsLive={true}
      />
      
      <div className="grid grid-cols-2 gap-6">
        <CallControls
          gameType={gameType}
          onCallNumber={onCallNumber}
          onRecall={onRecall}
          lastCalledNumber={lastCalledNumber}
          totalCalls={calledNumbers.length}
          pendingClaims={pendingClaims}
          onViewClaims={onViewClaims}
        />
        
        <BingoCard
          numbers={calledNumbers}
          numberRange={numberRange}
        />
      </div>
    </div>
  );
}
