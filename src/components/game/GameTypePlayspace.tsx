
import React from "react";
import BingoCardDisplay from "./BingoCardDisplay";
import { GameType } from "@/types";

interface GameTypePlayspaceProps {
  gameType: GameType;
  tickets: any[];
  calledNumbers: number[];
  lastCalledNumber?: number | null;
  autoMarking: boolean;
  setAutoMarking?: (value: boolean) => void;
  handleClaimBingo?: () => Promise<boolean>;
  isClaiming?: boolean;
  claimStatus?: 'pending' | 'validated' | 'rejected';
}

export default function GameTypePlayspace({
  gameType,
  tickets,
  calledNumbers,
  lastCalledNumber,
  autoMarking,
  setAutoMarking,
  handleClaimBingo,
  isClaiming,
  claimStatus
}: GameTypePlayspaceProps) {
  // If it's 90-ball bingo, show the regular card display
  if (gameType === 'mainstage') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tickets.map((ticket: any) => (
          <div key={ticket.id} className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500 mb-2">Ticket #{ticket.ticket_number}</p>
            <BingoCardDisplay
              numbers={ticket.numbers}
              layoutMask={ticket.layout_mask}
              calledNumbers={calledNumbers}
              autoMarking={autoMarking}
            />
          </div>
        ))}
      </div>
    );
  }

  // For other game types, show a placeholder
  return (
    <div className="flex items-center justify-center h-full min-h-[400px] bg-white rounded-lg shadow-lg p-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">{gameType.toUpperCase()}</h2>
        <p className="text-gray-600">PLACEHOLDER</p>
      </div>
    </div>
  );
}
