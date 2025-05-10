
import React from 'react';

interface TicketHeaderInfoProps {
  serial: string;
  perm: number;
  position?: number;
}

/**
 * Component for displaying ticket header information
 */
export default function TicketHeaderInfo({ serial, perm, position }: TicketHeaderInfoProps) {
  return (
    <div className="mb-2 p-1 bg-gray-100 rounded-md flex justify-between items-center text-sm">
      <div className="font-bold text-black">
        Ticket: <span className="font-mono bg-yellow-100 px-2 py-1 rounded text-black">{serial || 'Unknown'}</span>
      </div>
      <div className="text-gray-700">
        Perm: <span className="font-semibold">{perm || 'Unknown'}</span>
        {position ? ` | Pos: ${position}` : ''}
      </div>
    </div>
  );
}
