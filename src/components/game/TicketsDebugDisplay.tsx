
import React from "react";

export interface TicketsDebugDisplayProps {
  bingoTickets: any[];
}

const TicketsDebugDisplay: React.FC<TicketsDebugDisplayProps> = ({ bingoTickets }) =>
  bingoTickets.length > 0 ? (
    <div className="bg-gray-50 rounded-lg p-4 mt-6">
      <h3 className="font-semibold mb-3">Bingo Tickets (Debug)</h3>
      <pre className="text-xs max-h-40 overflow-auto">{JSON.stringify(bingoTickets, null, 2)}</pre>
    </div>
  ) : null;

export default TicketsDebugDisplay;
