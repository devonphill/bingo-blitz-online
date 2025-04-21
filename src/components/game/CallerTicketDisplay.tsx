
import React, { useState, useEffect } from 'react';

interface CallerTicketDisplayProps {
  ticket: {
    numbers: number[];
    serial: string;
    layoutMask?: number;
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

  // Convert the linear numbers array to a 3x9 grid based on layoutMask if provided
  useEffect(() => {
    if (ticket.layoutMask) {
      const maskBinary = ticket.layoutMask.toString(2).padStart(27, "0").split("").reverse();
      const cells: (number | null)[][] = [[], [], []];
      let numIdx = 0;
      
      for (let i = 0; i < 27; i++) {
        const rowIdx = Math.floor(i / 9);
        if (maskBinary[i] === "1") {
          cells[rowIdx].push(ticket.numbers[numIdx++] ?? null);
        } else {
          cells[rowIdx].push(null);
        }
      }
      setGridCells(cells);
    } else {
      // Fallback to distribute numbers evenly across rows
      const cells: (number | null)[][] = [[], [], []];
      let idx = 0;
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 9; col++) {
          if (idx < ticket.numbers.length) {
            const number = ticket.numbers[idx];
            // Place number in appropriate column based on value range
            const numCol = number <= 9 ? 0 : Math.floor((number - 1) / 10);
            if (numCol === col) {
              cells[row][col] = number;
              idx++;
            } else {
              cells[row][col] = null;
            }
          } else {
            cells[row][col] = null;
          }
        }
      }
      setGridCells(cells);
    }
  }, [ticket]);

  // Create flashing effect ONLY for the most recent called number
  useEffect(() => {
    if (!lastCalledNumber || !ticket.numbers.includes(lastCalledNumber)) return;
    
    // Only flash the last called number, not all called numbers
    setFlashingNumber(lastCalledNumber);
    
    // Stop flashing after 1.5 seconds
    const timer = setTimeout(() => {
      setFlashingNumber(null);
    }, 1500);
    
    return () => clearTimeout(timer);
  }, [lastCalledNumber, ticket.numbers]);

  return (
    <div className="grid grid-cols-9 gap-1 p-2 border rounded">
      {gridCells.map((row, rowIndex) => (
        row.map((number, colIndex) => (
          <div
            key={`${ticket.serial}-${rowIndex}-${colIndex}`}
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
              <span>
                {number}
              </span>
            )}
          </div>
        ))
      ))}
    </div>
  );
}
