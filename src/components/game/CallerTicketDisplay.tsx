
import React, { useMemo } from 'react';

interface TicketProps {
  numbers: number[];
  layoutMask: number;
  serial: string;
  perm?: number;
  position?: number;
}

interface CallerTicketDisplayProps {
  ticket: TicketProps;
  calledNumbers: number[];
  lastCalledNumber?: number | null;
  gameType?: string;
  winPattern?: string | null;
}

export default function CallerTicketDisplay({
  ticket,
  calledNumbers,
  lastCalledNumber,
  gameType = 'mainstage',
  winPattern
}: CallerTicketDisplayProps) {
  // Format the numbers into a grid based on game type
  const grid = useMemo(() => {
    const { numbers, layoutMask } = ticket;
    
    // For mainstage (90-ball) bingo
    if (gameType === 'mainstage') {
      // 90-ball has 3 rows, 9 columns
      const rows = 3;
      const cols = 9;
      const formattedGrid: Array<Array<number | null>> = [];
      
      // Create empty grid
      for (let i = 0; i < rows; i++) {
        formattedGrid.push(Array(cols).fill(null));
      }
      
      // Determine which cells should have numbers based on layout mask
      // This is a simplified version for display purposes
      let numIndex = 0;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          // Check if this position should have a number based on layoutMask
          const cellShouldHaveNumber = ((layoutMask >> (row * cols + col)) & 1) === 1;
          
          if (cellShouldHaveNumber && numIndex < numbers.length) {
            formattedGrid[row][col] = numbers[numIndex];
            numIndex++;
          }
        }
      }
      
      return formattedGrid;
    }
    
    // For 75-ball bingo (5x5 grid with free center)
    if (gameType === 'variant') {
      const size = 5;
      const formattedGrid: Array<Array<number | null>> = [];
      
      // Create empty grid
      for (let i = 0; i < size; i++) {
        formattedGrid.push(Array(size).fill(null));
      }
      
      // Fill in the numbers
      let numIndex = 0;
      for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
          // Center cell is free
          if (row === 2 && col === 2) {
            formattedGrid[row][col] = 0; // 0 represents FREE
          } else if (numIndex < numbers.length) {
            formattedGrid[row][col] = numbers[numIndex];
            numIndex++;
          }
        }
      }
      
      return formattedGrid;
    }
    
    // Default to simple grid representation
    return [numbers];
  }, [ticket, gameType]);
  
  // Check if a number has been called
  const isNumberCalled = (num: number | null) => {
    if (num === null || num === 0) return false; // Free space or empty
    return calledNumbers.includes(num);
  };
  
  // Check if a number is the last called number
  const isLastCalledNumber = (num: number | null) => {
    if (num === null || num === 0) return false;
    return num === lastCalledNumber;
  };
  
  // Get CSS class based on number status
  const getCellClass = (num: number | null) => {
    if (num === 0) return "bg-green-100 border border-green-300"; // FREE space
    if (num === null) return "bg-gray-100 border border-gray-200"; // Empty space
    
    let classes = "border ";
    
    if (isLastCalledNumber(num)) {
      classes += "bg-yellow-100 border-yellow-500 text-yellow-800 font-bold";
    } else if (isNumberCalled(num)) {
      classes += "bg-green-100 border-green-500 text-green-800 font-semibold";
    } else {
      classes += "bg-white border-gray-300";
    }
    
    return classes;
  };
  
  return (
    <div className="w-full overflow-x-auto">
      <div className="text-xs text-gray-500 mb-1 flex justify-between">
        <span>Serial: {ticket.serial}</span>
        <span>Matches: {calledNumbers.filter(n => ticket.numbers.includes(n)).length}/{ticket.numbers.length}</span>
      </div>
      
      <div className="min-w-[300px]">
        {grid.map((row, rowIndex) => (
          <div key={rowIndex} className="flex">
            {row.map((num, colIndex) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`${getCellClass(num)} flex items-center justify-center ${
                  gameType === 'mainstage' ? 'w-8 h-8' : 'w-10 h-10'
                } text-center`}
              >
                {num === 0 ? 'FREE' : num !== null ? num : ''}
              </div>
            ))}
          </div>
        ))}
      </div>
      
      {winPattern && (
        <div className="text-xs text-gray-500 mt-2">
          Pattern: {winPattern}
        </div>
      )}
    </div>
  );
}
