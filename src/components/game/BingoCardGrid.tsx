
import React from "react";
import BingoCell from "./BingoCell";

export default function BingoCardGrid({
  card,
  markedCells,
  calledNumbers,
  autoMarking,
  setMarkedCells
}: {
  card: (number | null)[][];
  markedCells: Set<string>;
  calledNumbers: number[];
  autoMarking: boolean;
  setMarkedCells: (f: (prev: Set<string>) => Set<string>) => void;
}) {
  const isCellMarked = (row: number, col: number, value: number | null) => {
    if (value === null) return false;
    if (autoMarking) return calledNumbers.includes(value);
    return markedCells.has(`${row},${col}`);
  };

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
