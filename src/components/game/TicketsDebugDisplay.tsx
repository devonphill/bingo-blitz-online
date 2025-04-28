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
            
            <div className="mt-2 space-y-2">
              {player.tickets.map((ticket, idx) => (
                <div key={`${ticket.serial}-${idx}`} className="bg-white p-3 border rounded-md">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-yellow-50 p-2 rounded flex flex-col">
                      <span className="text-xs text-gray-500">Serial:</span>
                      <span className="font-mono font-bold">{ticket.serial || 'Unknown'}</span>
                    </div>
                    <div className="bg-blue-50 p-2 rounded flex flex-col">
                      <span className="text-xs text-gray-500">Perm:</span>
                      <span className="font-mono font-bold">{ticket.perm || 'Unknown'}</span>
                    </div>
                    <div className="bg-green-50 p-2 rounded flex flex-col">
                      <span className="text-xs text-gray-500">Position:</span>
                      <span className="font-mono font-bold">{ticket.position || 'Unknown'}</span>
                    </div>
                    <div className="bg-purple-50 p-2 rounded flex flex-col">
                      <span className="text-xs text-gray-500">Layout Mask:</span>
                      <span className="font-mono font-bold">{ticket.layoutMask || 'Unknown'}</span>
                    </div>
                  </div>
                  
                  <details className="mt-2">
                    <summary className="text-sm text-blue-600 cursor-pointer">
                      View Numbers
                    </summary>
                    <pre className="text-xs mt-2 max-h-40 overflow-auto bg-gray-100 p-2 rounded">
                      {JSON.stringify(ticket.numbers, null, 2)}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
            
            <details className="mt-2">
              <summary className="text-sm text-blue-600 cursor-pointer">
                View Raw JSON Data
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
