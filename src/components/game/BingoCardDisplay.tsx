
import React from 'react';
import BingoCell from './BingoCell';

interface BingoCardDisplayProps {
  numbers: number[];
  layoutMask: number;
  calledNumbers: number[];
  autoMarking?: boolean;
  card?: Array<Array<number | null>>;
  markedCells?: Set<string>;
  setMarkedCells?: React.Dispatch<React.SetStateAction<Set<string>>>;
  oneTGNumbers?: number[];
}

export default function BingoCardDisplay({
  numbers,
  layoutMask,
  calledNumbers,
  autoMarking = true,
  card = [],
  markedCells = new Set(),
  setMarkedCells,
  oneTGNumbers = []
}: BingoCardDisplayProps) {
  // Function to toggle cell marking when not in autoMarking mode
  const toggleMark = (row: number, col: number, value: number | null) => {
    if (value === null || autoMarking || !setMarkedCells) return;
    
    setMarkedCells((prev) => {
      const key = `${row},${col}`;
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const isCellMarked = (row: number, col: number, value: number | null) => {
    if (value === null) return false;
    if (autoMarking) return calledNumbers.includes(value);
    return markedCells?.has(`${row},${col}`) || false;
  };

  const isOneTG = (value: number | null) => {
    if (value === null) return false;
    return oneTGNumbers.includes(value);
  };

  if (!card || card.length === 0) return null;

  return (
    <div className="grid grid-cols-9 gap-1">
      {card.map((row, rowIndex) => (
        row.map((cell, colIndex) => (
          <BingoCell
            key={`${rowIndex}-${colIndex}`}
            rowIndex={rowIndex}
            colIndex={colIndex}
            value={cell}
            marked={isCellMarked(rowIndex, colIndex, cell)}
            autoMarking={autoMarking}
            onClick={() => toggleMark(rowIndex, colIndex, cell)}
            isOneTG={isOneTG(cell)}
          />
        ))
      ))}
    </div>
  );
}
