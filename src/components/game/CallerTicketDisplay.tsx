
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

  // Convert the linear numbers array to a 3x9 grid based on layoutMask if provided
  useEffect(() => {
    if (ticket.layoutMask) {
      const maskBinary = ticket.layoutMask.toString(2).padStart(27, "0").split("").reverse();
      const cells: (number | null)[][] = [[], [], []];
      let numIdx = 0;
      
      for (let i = 0; i < 27; i++) {
        const rowIdx = Math.floor(i / 9);
        const colIdx = i % 9;
        
        if (maskBinary[i] === "1") {
          cells[rowIdx][colIdx] = ticket.numbers[numIdx++] ?? null;
        } else {
          cells[rowIdx][colIdx] = null;
        }
      }
      
      // Validate each row has exactly 5 non-null numbers for 90-ball bingo
      for (let row = 0; row < 3; row++) {
        const nonNullCount = cells[row].filter(cell => cell !== null).length;
        if (nonNullCount !== 5) {
          console.warn(`Row ${row} has ${nonNullCount} numbers instead of expected 5. Ticket may not be formatted correctly.`);
        }
      }
      
      setGridCells(cells);
    } else {
      // Fallback to distribute numbers evenly across rows (5 per row for 90-ball)
      const cells: (number | null)[][] = [[], [], []];
      
      // For 90-ball, place 5 numbers in each row
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 9; col++) {
          cells[row][col] = null;
        }
      }
      
      let idx = 0;
      for (let row = 0; row < 3 && idx < ticket.numbers.length; row++) {
        // For each row, place 5 numbers in appropriate columns based on value range
        let placedInRow = 0;
        for (let col = 0; col < 9 && placedInRow < 5 && idx < ticket.numbers.length; col++) {
          const number = ticket.numbers[idx];
          
          // Place number in appropriate column based on value range for 90-ball
          // Column 0: 1-9, Column 1: 10-19, Column 2: 20-29, etc.
          const numCol = number <= 9 ? 0 : Math.floor((number - 1) / 10);
          
          if (numCol === col && cells[row][col] === null) {
            cells[row][col] = number;
            idx++;
            placedInRow++;
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
    <div className="flex flex-col">
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
      <div className="mt-2 text-xs text-gray-600 flex justify-between">
        <div>Serial: <span className="font-mono">{ticket.serial}</span></div>
        {ticket.perm && <div>Perm: <span className="font-mono">{ticket.perm}</span></div>}
      </div>
    </div>
  );
}
