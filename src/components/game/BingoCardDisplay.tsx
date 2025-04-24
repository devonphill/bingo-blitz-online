
import React from "react";
import { useAutoMark } from "./useAutoMark";
import BingoCell from "./BingoCell";

interface BingoCardDisplayProps {
  numbers: number[];
  layoutMask: number;
  calledNumbers: number[];
  autoMarking?: boolean;
}

export default function BingoCardDisplay({
  numbers,
  layoutMask,
  calledNumbers,
  autoMarking = true
}: BingoCardDisplayProps) {
  const {
    card,
    markedCells,
    setMarkedCells,
  } = useAutoMark({ numbers, layoutMask, calledNumbers, autoMarking });
  
  // Function to toggle cell marking when not in autoMarking mode
  const toggleMark = (row: number, col: number, value: number | null) => {
    if (value === null || autoMarking) return;
    
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
          />
        ))
      ))}
    </div>
  );
}
