
import React from "react";
import MainstageBingoGame from "./MainstageBingoGame";
import PartyBingoGame from "./PartyBingoGame";
import QuizBingoGame from "./QuizBingoGame";
import LogoBingoGame from "./LogoBingoGame";
import MusicBingoGame from "./MusicBingoGame";

interface GameTypePlayspaceProps {
  gameType: 'mainstage' | 'party' | 'quiz' | 'logo' | 'music';
  tickets: any[];
  calledNumbers: number[];
  lastCalledNumber: number | null;
  autoMarking?: boolean;
  setAutoMarking?: (value: boolean) => void;
  handleClaimBingo?: () => Promise<boolean>;
  isClaiming?: boolean;
  claimStatus?: 'validated' | 'rejected' | 'pending';
  sessionId?: string | null;
  playerId?: string | null;
  playerName?: string | null;
}

export default function GameTypePlayspace({
  gameType,
  tickets,
  calledNumbers,
  lastCalledNumber,
  autoMarking = true,
  setAutoMarking,
  handleClaimBingo,
  isClaiming = false,
  claimStatus = 'pending',
  sessionId,
  playerId,
  playerName
}: GameTypePlayspaceProps) {
  // Render the appropriate game component based on game type
  switch (gameType) {
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
    case 'mainstage':
    default:
      return (
        <MainstageBingoGame
          tickets={tickets}
          calledNumbers={calledNumbers}
          lastCalledNumber={lastCalledNumber}
          autoMarking={autoMarking}
          setAutoMarking={setAutoMarking}
        />
      );
  }
}
