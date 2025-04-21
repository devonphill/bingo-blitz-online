
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
  const [flashState, setFlashState] = useState<'black' | 'white' | null>(null);
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

  // Create flashing effect when a number is called
  useEffect(() => {
    if (!lastCalledNumber) return;
    
    if (ticket.numbers.includes(lastCalledNumber)) {
      // Start flashing between black and white
      const flashInterval = setInterval(() => {
        setFlashState(prev => prev === 'black' ? 'white' : 'black');
      }, 200); // Flash every 200ms
      
      // Stop flashing after 1.5 seconds
      setTimeout(() => {
        clearInterval(flashInterval);
        setFlashState(null);
      }, 1500);
      
      return () => clearInterval(flashInterval);
    }
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
                  ? `${flashState === 'black' ? 'bg-black' : flashState === 'white' ? 'bg-white' : 'bg-green-500'} ${flashState ? 'border border-gray-400' : 'text-white'}`
                  : 'bg-red-500 text-white'}
              ${lastCalledNumber === number 
                ? 'animate-pulse' 
                : ''}
            `}
          >
            {number !== null && (
              <span className={`${flashState ? (flashState === 'black' ? 'text-white' : 'text-black') : 'text-white'}`}>
                {number}
              </span>
            )}
          </div>
        ))
      ))}
    </div>
  );
}
