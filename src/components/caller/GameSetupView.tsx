
// This is a read-only file, so we need to create a new file that will import and extend it
// Since we can't directly modify this file, let's create a wrapper component

// src/components/caller/GameSetupViewWrapper.tsx
import React from 'react';
import { GameSetupView as OriginalGameSetupView } from './GameSetupView';
import { GameType, PrizeDetails } from '@/types';
import { WinPattern } from '@/types/winPattern';

interface GameSetupViewWrapperProps {
  currentGameType: GameType;
  onGameTypeChange: (type: GameType) => void;
  winPatterns: WinPattern[];
  selectedPatterns: string[];
  onPatternSelect: (pattern: WinPattern) => void;
  onGoLive: () => Promise<void>;
  isGoingLive: boolean;
  prizes?: { [patternId: string]: PrizeDetails };
}

export function GameSetupViewWrapper(props: GameSetupViewWrapperProps) {
  return <OriginalGameSetupView {...props} />;
}
