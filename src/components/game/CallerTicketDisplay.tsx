
import React, { useState, useEffect, useMemo } from 'react';
import { processTicketLayout } from '@/utils/ticketUtils';

interface CallerTicketDisplayProps {
  ticket: {
    numbers: number[];
    serial: string;
    layoutMask?: number;
    perm?: number;
    position?: number;
  };
  calledNumbers: number[];
  lastCalledNumber: number | null;
}

export default function CallerTicketDisplay({ 
  ticket, 
  calledNumbers, 
  lastCalledNumber 
}: CallerTicketDisplayProps) {
  const [flashingNumber, setFlashingNumber] = useState<number | null>(null);
  
  // Process grid layout from mask - memoized to avoid recalculating
  const gridCells = useMemo(() => {
    if (!ticket.numbers || !ticket.layoutMask) {
      console.warn("Missing ticket data for layout", ticket);
      return Array(3).fill(null).map(() => Array(9).fill(null));
    }
    return processTicketLayout(ticket.numbers, ticket.layoutMask);
  }, [ticket.numbers, ticket.layoutMask]);

  // Create flashing effect for the most recent called number
  useEffect(() => {
    if (!lastCalledNumber || !ticket.numbers || !ticket.numbers.includes(lastCalledNumber)) {
      return;
    }
    
    // Flash the last called number
    setFlashingNumber(lastCalledNumber);
    
    // Stop flashing after 1.5 seconds
    const timer = setTimeout(() => {
      setFlashingNumber(null);
    }, 1500);
    
    return () => clearTimeout(timer);
  }, [lastCalledNumber, ticket.numbers]);

  // If grid cells aren't ready yet, show loading state
  if (gridCells.length === 0) {
    return (
      <div className="flex flex-col">
        <div className="grid grid-cols-9 gap-1 p-2 border rounded">
          <div className="col-span-9 p-4 text-center">Loading ticket...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-9 gap-1 p-2 border rounded">
        {gridCells.map((row, rowIndex) => (
          React.Children.toArray(row.map((number, colIndex) => (
            <div
              className={`
                aspect-square flex items-center justify-center text-sm font-medium p-2 rounded
                ${number === null 
                  ? 'bg-gray-100' 
                  : calledNumbers.includes(number)
                    ? number === flashingNumber
                      ? 'bg-black text-white animate-pulse'  
                      : 'bg-green-500 text-white'
                    : 'bg-red-500 text-white'}
              `}
            >
              {number !== null && (
                <span>{number}</span>
              )}
            </div>
          )))
        ))}
      </div>
      
      {/* Make ticket information more visible */}
      <div className="mt-2 text-xs text-gray-700 flex justify-between border-t pt-2">
        <div className="font-semibold">Serial: <span className="font-mono bg-gray-100 px-1 rounded">{ticket.serial}</span></div>
        {ticket.perm && <div className="font-semibold">Perm: <span className="font-mono bg-gray-100 px-1 rounded">{ticket.perm}</span></div>}
        {ticket.position && <div className="font-semibold">Position: <span className="font-mono bg-gray-100 px-1 rounded">{ticket.position}</span></div>}
      </div>
    </div>
  );
}
