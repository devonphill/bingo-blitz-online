
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
      <h3 className="font-semibold mb-3 text-lg">Bingo Tickets (Debug)</h3>
      <div className="space-y-6">
        {bingoTickets.map((player) => (
          <div key={player.playerId} className="border-t pt-4">
            <div className="font-medium text-lg">
              Player: {player.nickname} ({player.playerCode})
            </div>
            <div className="text-sm mt-1 font-semibold text-blue-600">
              Tickets: {player.tickets.length}
            </div>
            
            <div className="mt-4 space-y-4">
              {player.tickets.map((ticket, idx) => (
                <div key={`${ticket.serial}-${idx}`} className="bg-white p-4 border rounded-md shadow-sm">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-yellow-100 p-3 rounded flex flex-col">
                      <span className="text-xs text-gray-700 font-medium">Serial:</span>
                      <span className="font-mono text-base font-bold">{ticket.serial || 'Unknown'}</span>
                    </div>
                    <div className="bg-blue-100 p-3 rounded flex flex-col">
                      <span className="text-xs text-gray-700 font-medium">Perm:</span>
                      <span className="font-mono text-base font-bold">{ticket.perm || 'Unknown'}</span>
                    </div>
                    <div className="bg-green-100 p-3 rounded flex flex-col">
                      <span className="text-xs text-gray-700 font-medium">Position:</span>
                      <span className="font-mono text-base font-bold">{ticket.position || 'Unknown'}</span>
                    </div>
                    <div className="bg-purple-100 p-3 rounded flex flex-col">
                      <span className="text-xs text-gray-700 font-medium">Layout Mask:</span>
                      <span className="font-mono text-base font-bold">{ticket.layoutMask || 'Unknown'}</span>
                    </div>
                  </div>
                  
                  <details className="mt-3">
                    <summary className="text-sm text-blue-600 cursor-pointer font-medium">
                      View Numbers ({ticket.numbers?.length || 0})
                    </summary>
                    <pre className="text-xs mt-2 max-h-40 overflow-auto bg-gray-100 p-2 rounded">
                      {JSON.stringify(ticket.numbers, null, 2)}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
            
            <details className="mt-4">
              <summary className="text-sm text-blue-600 cursor-pointer font-medium">
                View Raw JSON Data
              </summary>
              <pre className="text-xs mt-2 max-h-40 overflow-auto bg-gray-100 p-2 rounded">
                {JSON.stringify(player, null, 2)}
              </pre>
            </details>
          </div>
        ))}
      </div>
    </div>
  ) : null;

export default TicketsDebugDisplay;
