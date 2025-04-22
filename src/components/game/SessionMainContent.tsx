import React from 'react';
import WinPatternSelector from './WinPatternSelector';
import CalledNumbers from './CalledNumbers';
import PlayerList from './PlayerList';
import TicketsDebugDisplay from './TicketsDebugDisplay';
import CallerControls from './CallerControls';
import type { WinPatternConfig } from '@/hooks/useWinPatternManagement';

interface SessionMainContentProps {
  session: any;
  winPatterns: string[];
  winPrizes: { [key: string]: string };
  winPatternConfigs?: WinPatternConfig[];
  currentPattern: string | null;
  onTogglePattern: (pattern: string) => void;
  onPrizeChange: (pattern: string, value: string) => void;
  calledNumbers: number[];
  currentNumber: number | null;
  sessionPlayers: any[];
  handleCallNumber: (number: number) => void;
  handleEndGame: () => void;
  handleGoLive: () => Promise<void>;
  remainingNumbers: number[];
  sessionId: string;
  onCheckClaims?: () => void;
  claimQueue?: Array<{ playerName: string; playerId: string; claimId?: string }>;
  openClaimSheet: () => void;
  gameType?: string;
}

export default function SessionMainContent({
  session,
  winPatterns,
  winPrizes,
  winPatternConfigs = [],
  currentPattern,
  onTogglePattern,
  onPrizeChange,
  calledNumbers,
  currentNumber,
  sessionPlayers,
  handleCallNumber,
  handleEndGame,
  handleGoLive,
  remainingNumbers,
  sessionId,
  claimQueue = [],
  openClaimSheet,
  gameType = '90-ball'
}: SessionMainContentProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Game: {gameType}</h2>
          <div className="mb-4">
            {winPatternConfigs && winPatternConfigs.length > 0 ? (
              <WinPatternSelector
                winPatternConfigs={winPatternConfigs}
                onTogglePattern={onTogglePattern}
                onPrizeChange={onPrizeChange}
                currentPattern={currentPattern}
              />
            ) : (
              // Legacy fallback
              <div className="text-gray-500">Loading win patterns...</div>
            )}
          </div>
          <CalledNumbers 
            calledNumbers={calledNumbers}
            currentNumber={currentNumber}
          />
        </div>
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Players ({sessionPlayers.length})</h2>
          <PlayerList players={sessionPlayers} />
        </div>
        <TicketsDebugDisplay bingoTickets={[]} />
      </div>
      <div>
        <CallerControls 
          onCallNumber={handleCallNumber}
          onEndGame={handleEndGame}
          onGoLive={handleGoLive}
          remainingNumbers={remainingNumbers}
          sessionId={sessionId}
          winPatterns={winPatterns}
          claimCount={claimQueue?.length || 0}
          openClaimSheet={openClaimSheet}
        />
      </div>
    </div>
  );
}
