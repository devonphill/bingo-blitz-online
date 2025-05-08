import React from 'react';
import BingoCell from './BingoCell';

interface CallerTicketDisplayProps {
  ticket: {
    numbers: number[];
    layoutMask: number;
    serial: string;
    perm: number;
    position: number;
  };
  calledNumbers: number[];
  lastCalledNumber: number | null;
  gameType?: string;
  winPattern?: string;
}

export default function CallerTicketDisplay({
  ticket,
  calledNumbers,
  lastCalledNumber,
  gameType = 'mainstage',
  winPattern
}: CallerTicketDisplayProps) {
  const { numbers, layoutMask } = ticket;
  
  // Convert the layoutMask to a binary string and pad it to ensure it's 27 characters long
  const layoutMaskBinary = layoutMask.toString(2).padStart(27, '0');
  
  // Create the bingo card layout based on the layoutMask
  const card = [];
  let numberIndex = 0;
  for (let i = 0; i < 3; i++) {
    const row = [];
    for (let j = 0; j < 9; j++) {
      const maskIndex = i * 9 + j;
      if (layoutMaskBinary[maskIndex] === '1') {
        row.push(numbers[numberIndex] || null);
        numberIndex++;
      } else {
        row.push(null);
      }
    }
    card.push(row);
  }
  
  // Check if a number was recently called
  const isRecentlyCalled = (number: number) => {
    return number === lastCalledNumber;
  };

  return (
    <div className="grid grid-cols-9 gap-1">
      {card.map((row, rowIndex) => (
        row.map((cell, colIndex) => (
          <BingoCell
            key={`${rowIndex}-${colIndex}`}
            rowIndex={rowIndex}
            colIndex={colIndex}
            value={cell}
            marked={cell !== null && calledNumbers.includes(cell)}
            autoMarking={true}
            onClick={() => {}} // No action on click for caller display
            isRecentlyMarked={cell !== null && isRecentlyCalled(cell)}
          />
        ))
      ))}
    </div>
  );
}
