
import React from 'react';
import WinPatternSelector from './WinPatternSelector';
import CalledNumbers from './CalledNumbers';
import PlayerList from './PlayerList';
import TicketsDebugDisplay from './TicketsDebugDisplay';
import CallerControls from './CallerControls';
import type { Winline } from '@/hooks/useWinPatternManagement';

interface SessionMainContentProps {
  session: any;
  winLines: Array<{ id: number; name: string; active: boolean }>;
  currentActiveWinline: number;
  onToggleWinline: (winlineId: number) => void;
  calledNumbers: number[];
  currentNumber: number | null;
  sessionPlayers: any[];
  handleCallNumber: (number: number) => void;
  handleEndGame: () => void;
  handleGoLive: () => Promise<void>;
  remainingNumbers: number[];
  sessionId: string;
  claimQueue?: Array<{ playerName: string; playerId: string; claimId?: string }>;
  openClaimSheet: () => void;
  gameType?: string;
}

export default function SessionMainContent({
  session,
  winLines,
  currentActiveWinline,
  onToggleWinline,
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
            <WinPatternSelector
              winLines={winLines}
              currentActiveWinline={currentActiveWinline}
              onToggleWinline={onToggleWinline}
            />
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
          winPatterns={[]} // not used anymore
          claimCount={claimQueue?.length || 0}
          openClaimSheet={openClaimSheet}
        />
      </div>
    </div>
  );
}
