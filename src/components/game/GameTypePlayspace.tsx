
import React from 'react';
import MainstageBingoGame from './MainstageBingoGame';
import PartyBingoGame from './PartyBingoGame';
import QuizBingoGame from './QuizBingoGame';
import LogoBingoGame from './LogoBingoGame';
import MusicBingoGame from './MusicBingoGame';
import BingoClaim from './BingoClaim';
import { logWithTimestamp } from '@/utils/logUtils';

interface GameTypePlayspaceProps {
  gameType: 'mainstage' | 'party' | 'quiz' | 'logo' | 'music';
  tickets: any[];
  calledNumbers: number[];
  lastCalledNumber: number | null;
  autoMarking?: boolean;
  setAutoMarking?: (value: boolean) => void;
  handleClaimBingo: () => Promise<boolean>;
  isClaiming: boolean;
  claimStatus: 'validated' | 'rejected' | 'pending';
  sessionId?: string | null;    // Add sessionId prop
  playerId?: string | null;     // Add playerId prop
  playerName?: string | null;   // Add playerName prop
}

export default function GameTypePlayspace({
  gameType,
  tickets,
  calledNumbers,
  lastCalledNumber,
  autoMarking = true,
  setAutoMarking,
  handleClaimBingo,
  isClaiming,
  claimStatus,
  sessionId,              // Include sessionId in destructuring
  playerId,               // Include playerId in destructuring
  playerName              // Include playerName in destructuring
}: GameTypePlayspaceProps) {
  
  // Log important information for debugging
  console.log('GameTypePlayspace Props:', {
    gameType,
    ticketCount: tickets?.length || 0, 
    calledNumbersCount: calledNumbers?.length || 0,
    lastCalledNumber,
    claimStatus,
    sessionId,
    playerId,
    playerName
  });

  // Map the claim status from GameTypePlayspace format to BingoClaim format
  const bingoClaimStatus = 
    claimStatus === 'validated' ? 'valid' :
    claimStatus === 'rejected' ? 'invalid' :
    'none';

  const renderPlayspace = () => {
    switch (gameType) {
      case 'mainstage':
        return (
          <MainstageBingoGame 
            tickets={tickets} 
            calledNumbers={calledNumbers}
            lastCalledNumber={lastCalledNumber}
            autoMarking={autoMarking}
            setAutoMarking={setAutoMarking}
          />
        );
      case 'party':
        return (
          <PartyBingoGame 
            tickets={tickets} 
            calledNumbers={calledNumbers}
            lastCalledNumber={lastCalledNumber}
            autoMarking={autoMarking}
            setAutoMarking={setAutoMarking}
          />
        );
      case 'quiz':
        return (
          <QuizBingoGame 
            tickets={tickets} 
            calledNumbers={calledNumbers}
            lastCalledNumber={lastCalledNumber}
            autoMarking={autoMarking}
          />
        );
      case 'logo':
        return (
          <LogoBingoGame 
            tickets={tickets} 
            calledNumbers={calledNumbers}
            lastCalledNumber={lastCalledNumber}
            autoMarking={autoMarking}
          />
        );
      case 'music':
        return (
          <MusicBingoGame 
            tickets={tickets} 
            calledNumbers={calledNumbers}
            lastCalledNumber={lastCalledNumber}
            autoMarking={autoMarking}
          />
        );
      default:
        return (
          <div className="flex justify-center items-center p-10">
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              Unknown game type: {gameType}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      {renderPlayspace()}
      
      <div className="mt-4 flex justify-center">
        <BingoClaim
          onClaimBingo={handleClaimBingo}
          claimStatus={bingoClaimStatus}
          isClaiming={isClaiming}
          sessionId={sessionId}         // Pass sessionId to BingoClaim
          playerId={playerId}           // Pass playerId to BingoClaim
          playerName={playerName}       // Pass playerName to BingoClaim
          currentTicket={tickets && tickets.length > 0 ? tickets[0] : null}
          calledNumbers={calledNumbers}
        />
      </div>
    </div>
  );
}
