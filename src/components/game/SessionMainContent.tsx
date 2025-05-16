
import React from 'react';
import WinPatternSelector from './WinPatternSelector';
import CalledNumbers from './CalledNumbers';
import PlayerList from './PlayerList';
import TicketsDebugDisplay from './TicketsDebugDisplay';
import CallerControls from './CallerControls';
import { WinPattern } from '@/types/winPattern';
import { PrizeDetails } from '@/types';
import { useSessionProgress } from '@/hooks/useSessionProgress';

interface SessionMainContentProps {
  session: any;
  winLines: Array<WinPattern>;
  currentActiveWinline: number;
  onToggleWinline: (winline: WinPattern) => void;
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
  selectedPatterns?: string[];
  prizes?: { [patternId: string]: PrizeDetails };
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
  gameType = '90-ball',
  selectedPatterns = [],
  prizes = {}
}: SessionMainContentProps) {
  // Get session progress for the current game number
  const { progress } = useSessionProgress(sessionId);
  
  // Use the game number from session progress if available, otherwise fall back to the session's current_game
  const displayGameNumber = progress?.current_game_number || (session?.current_game || 1);
  const totalGames = session?.numberOfGames || session?.number_of_games || 1;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Game: {gameType} - {displayGameNumber} / {totalGames}
          </h2>
          <div className="mb-4">
            <WinPatternSelector
              winLines={winLines}
              currentActiveWinline={currentActiveWinline}
              onToggleWinline={onToggleWinline}
              selectedPatterns={selectedPatterns}
              prizes={prizes}
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
