
import React, { useState, useEffect } from 'react';

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
  const [gridCells, setGridCells] = useState<(number | null)[][]>([]);

  // Convert the linear numbers array to a 3x9 grid based on layoutMask
  useEffect(() => {
    if (!ticket.numbers || !ticket.layoutMask) {
      console.error("Ticket missing required data:", ticket);
      return;
    }

    try {
      // Convert layoutMask to binary and pad to 27 bits
      const maskBinary = ticket.layoutMask.toString(2).padStart(27, "0").split("").reverse();
      const cells: (number | null)[][] = [[], [], []];
      let numIdx = 0;
      
      // Process each bit in the layout mask
      for (let i = 0; i < 27; i++) {
        const rowIdx = Math.floor(i / 9);
        const colIdx = i % 9;
        
        // If the bit is 1, place a number from the numbers array
        if (maskBinary[i] === "1") {
          if (numIdx < ticket.numbers.length) {
            cells[rowIdx][colIdx] = ticket.numbers[numIdx++];
          } else {
            console.warn(`Not enough numbers for layout mask at position ${i}`);
            cells[rowIdx][colIdx] = null;
          }
        } else {
          // If the bit is 0, place null (empty cell)
          cells[rowIdx][colIdx] = null;
        }
      }
      
      // Validate for 90-ball bingo (5 numbers per row)
      for (let row = 0; row < 3; row++) {
        const nonNullCount = cells[row].filter(cell => cell !== null).length;
        if (nonNullCount !== 5) {
          console.warn(`Row ${row} has ${nonNullCount} numbers instead of expected 5. Layout mask may be incorrect.`);
        }
      }
      
      setGridCells(cells);
      console.log("Grid cells processed from layout mask:", cells);
    } catch (error) {
      console.error("Error processing ticket layout mask:", error);
    }
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
      <div className="mt-2 text-xs text-gray-600 flex justify-between">
        <div>Serial: <span className="font-mono">{ticket.serial}</span></div>
        {ticket.perm && <div>Perm: <span className="font-mono">{ticket.perm}</span></div>}
      </div>
    </div>
  );
}
