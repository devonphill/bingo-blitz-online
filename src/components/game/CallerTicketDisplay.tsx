
import React, { useState, useEffect, useMemo } from 'react';
import { processTicketLayout } from '@/utils/ticketUtils';

interface CallerTicketDisplayProps {
  ticket: {
    numbers: number[];
    serial: string;
    layoutMask?: number;
    layout_mask?: number;
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
  
  // Debug log the ticket
  console.log(`Caller ticket display:`, {
    serial: ticket.serial,
    perm: ticket.perm,
    position: ticket.position,
    layoutMask: ticket.layoutMask || ticket.layout_mask,
    numbersLength: ticket.numbers?.length || 0
  });
  
  // Process grid layout from mask - memoized to avoid recalculating
  const gridCells = useMemo(() => {
    // Handle both layoutMask and layout_mask property naming
    const layoutMask = ticket.layoutMask ?? ticket.layout_mask ?? 0;
    
    if (!ticket.numbers || !Array.isArray(ticket.numbers) || ticket.numbers.length === 0) {
      console.warn("Missing ticket numbers data for layout", ticket);
      return Array(3).fill(null).map(() => Array(9).fill(null));
    }
    
    console.log(`Processing ticket layout with mask ${layoutMask} for ticket ${ticket.serial}`);
    const processedGrid = processTicketLayout(ticket.numbers, layoutMask);
    
    // Debug log the grid to verify it's correct
    const numbersInGrid = processedGrid.flat().filter(n => n !== null).length;
    console.log(`Grid for ticket ${ticket.serial} contains ${numbersInGrid}/${ticket.numbers.length} numbers`, 
      { row1: processedGrid[0].filter(n => n !== null).length,
        row2: processedGrid[1].filter(n => n !== null).length, 
        row3: processedGrid[2].filter(n => n !== null).length 
      });
    
    return processedGrid;
  }, [ticket]);

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
  if (!gridCells || gridCells.length === 0) {
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
      {/* Highlight ticket information at the top more prominently */}
      <div className="mb-3 p-2 bg-gray-100 rounded-lg shadow-sm">
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="bg-yellow-100 p-2 rounded flex flex-col">
            <span className="text-xs font-medium text-yellow-800">Serial:</span>
            <span className="font-mono font-bold text-black">{ticket.serial || 'Unknown'}</span>
          </div>
          <div className="bg-blue-100 p-2 rounded flex flex-col">
            <span className="text-xs font-medium text-blue-800">Perm:</span>
            <span className="font-mono font-bold text-black">{ticket.perm ?? 'Unknown'}</span>
          </div>
          <div className="bg-green-100 p-2 rounded flex flex-col">
            <span className="text-xs font-medium text-green-800">Position:</span>
            <span className="font-mono font-bold text-black">{ticket.position ?? 'Unknown'}</span>
          </div>
          <div className="bg-purple-100 p-2 rounded flex flex-col">
            <span className="text-xs font-medium text-purple-800">Layout Mask:</span>
            <span className="font-mono font-bold text-black">{ticket.layoutMask ?? ticket.layout_mask ?? 'Unknown'}</span>
          </div>
        </div>
      </div>
      
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
    </div>
  );
}
