
import React from 'react';
import BingoCell from './BingoCell';

interface TicketGridProps {
  grid: (number | null)[][];
  markedCells: Set<string>;
  recentlyMarked: Set<string>;
  oneTGNumbers: number[];
  calledNumbers: number[];
  autoMarking: boolean;
  toggleMark: (row: number, col: number, value: number | null) => void;
}

/**
 * Component for rendering the grid of bingo cells
 */
export default function TicketGrid({
  grid,
  markedCells,
  recentlyMarked,
  oneTGNumbers,
  calledNumbers,
  autoMarking,
  toggleMark
}: TicketGridProps) {
  // Determines if a cell should be marked as called
  const isCellMarked = (row: number, col: number, value: number | null) => {
    if (value === null) return false;
    if (autoMarking) return calledNumbers.includes(value);
    return markedCells?.has(`${row},${col}`) || false;
  };

  // Checks if a number is one-to-go
  const isCell1TG = (value: number | null) => {
    return value !== null && oneTGNumbers.includes(value);
  };
  
  // Checks if a cell was recently marked (for animation)
  const isCellRecentlyMarked = (row: number, col: number) => {
    return recentlyMarked.has(`${row},${col}`);
  };

  return (
    <div className="grid grid-cols-9 gap-1">
      {grid.map((row, rowIndex) => (
        React.Children.toArray(row.map((cell, colIndex) => (
          <BingoCell
            rowIndex={rowIndex}
            colIndex={colIndex}
            value={cell}
            marked={isCellMarked(rowIndex, colIndex, cell)}
            autoMarking={autoMarking}
            onClick={() => toggleMark(rowIndex, colIndex, cell)}
            is1TG={isCell1TG(cell)}
            isRecentlyMarked={isCellRecentlyMarked(rowIndex, colIndex)}
          />
        )))
      ))}
    </div>
  );
}
