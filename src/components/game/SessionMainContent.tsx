
import React from 'react';
import WinPatternSelector from './WinPatternSelector';
import CalledNumbers from './CalledNumbers';
import PlayerList from './PlayerList';
import TicketsDebugDisplay from './TicketsDebugDisplay';
import CallerControls from './CallerControls';

interface SessionMainContentProps {
  session: any;
  winPatterns: string[];
  winPrizes: { [key: string]: string };
  onTogglePattern: (pattern: string) => void;
  onPrizeChange: (pattern: string, value: string) => void;
  calledNumbers: number[];
  currentNumber: number | null;
  sessionPlayers: any[];
  handleCallNumber: (number: number) => void;
  verifyPendingClaims: () => void;
  handleEndGame: () => void;
  handleGoLive: () => Promise<void>;
  remainingNumbers: number[];
  sessionId: string;
}

export default function SessionMainContent({
  session,
  winPatterns,
  winPrizes,
  onTogglePattern,
  onPrizeChange,
  calledNumbers,
  currentNumber,
  sessionPlayers,
  handleCallNumber,
  verifyPendingClaims,
  handleEndGame,
  handleGoLive,
  remainingNumbers,
  sessionId,
}: SessionMainContentProps) {
  // Function to handle claim verification that guarantees the callback is triggered
  const handleVerifyClaimClick = () => {
    console.log("Verify claim called from SessionMainContent");
    
    // Use the callback for claim verification
    if (typeof verifyPendingClaims === 'function') {
      console.log("Calling verifyPendingClaims function");
      verifyPendingClaims();
    } else {
      console.error("verifyPendingClaims is not a function!", verifyPendingClaims);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Game: {session.gameType}</h2>
          <div className="mb-4">
            <WinPatternSelector
              selectedPatterns={winPatterns}
              onTogglePattern={onTogglePattern}
              prizeValues={winPrizes}
              onPrizeChange={onPrizeChange}
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
          onVerifyClaim={handleVerifyClaimClick}
          onEndGame={handleEndGame}
          onGoLive={handleGoLive}
          remainingNumbers={remainingNumbers}
          sessionId={sessionId}
          winPatterns={winPatterns}
        />
      </div>
    </div>
  );
}
