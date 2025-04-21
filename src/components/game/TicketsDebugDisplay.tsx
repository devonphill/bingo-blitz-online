
import React from "react";

export interface BingoTicket {
  serial: string;
  perm: number;
  position: number;
  layoutMask: number;
  numbers: number[];
}

export interface TicketsDebugDisplayProps {
  bingoTickets: {
    playerId: string;
    playerCode: string;
    nickname: string;
    tickets: BingoTicket[];
  }[];
}

const TicketsDebugDisplay: React.FC<TicketsDebugDisplayProps> = ({ bingoTickets }) =>
  bingoTickets.length > 0 ? (
    <div className="bg-gray-50 rounded-lg p-4 mt-6">
      <h3 className="font-semibold mb-3">Bingo Tickets (Debug)</h3>
      <div className="space-y-4">
        {bingoTickets.map((player) => (
          <div key={player.playerId} className="border-t pt-2">
            <div className="font-medium">
              Player: {player.nickname} ({player.playerCode})
            </div>
            <div className="text-xs mt-1">
              Tickets: {player.tickets.length}
            </div>
            <details className="mt-2">
              <summary className="text-sm text-blue-600 cursor-pointer">
                View Ticket Details
              </summary>
              <pre className="text-xs mt-2 max-h-40 overflow-auto bg-gray-100 p-2 rounded">
                {JSON.stringify(player.tickets, null, 2)}
              </pre>
            </details>
          </div>
        ))}
      </div>
    </div>
  ) : null;

export default TicketsDebugDisplay;
