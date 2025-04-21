
import React, { useState, useEffect } from "react";
import BingoCell from "./BingoCell";

export default function BingoCardGrid({
  card,
  markedCells,
  calledNumbers,
  autoMarking,
  setMarkedCells,
  oneTGNumbers = []
}: {
  card: (number | null)[][];
  markedCells: Set<string>;
  calledNumbers: number[];
  autoMarking: boolean;
  setMarkedCells: (f: (prev: Set<string>) => Set<string>) => void;
  oneTGNumbers?: number[];
}) {
  const [recentlyMarked, setRecentlyMarked] = useState<Set<string>>(new Set());
  
  // Track recently called numbers for flashing effect
  useEffect(() => {
    if (!autoMarking) return;
    
    // Find newly marked cells
    const newlyMarked = new Set<string>();
    
    card.forEach((row, rowIndex) => {
      row.forEach((value, colIndex) => {
        if (value === null) return;
        
        const key = `${rowIndex},${colIndex}`;
        const isMarked = calledNumbers.includes(value);
        const wasMarked = [...markedCells].some(cellKey => cellKey === key);
        
        // If it's newly marked, add to recentlyMarked set
        if (isMarked && !wasMarked) {
          newlyMarked.add(key);
        }
      });
    });
    
    if (newlyMarked.size > 0) {
      setRecentlyMarked(newlyMarked);
      
      // Clear the recently marked status after animation completes
      setTimeout(() => {
        setRecentlyMarked(new Set());
      }, 2000);
    }
  }, [calledNumbers, card, markedCells, autoMarking]);

  const isCellMarked = (row: number, col: number, value: number | null) => {
    if (value === null) return false;
    if (autoMarking) return calledNumbers.includes(value);
    return markedCells.has(`${row},${col}`);
  };

  const isCell1TG = (value: number | null) => {
    return value !== null && oneTGNumbers.includes(value);
  };
  
  const isCellRecentlyMarked = (row: number, col: number) => {
    return recentlyMarked.has(`${row},${col}`);
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
        // Mark as recently marked for animation
        setRecentlyMarked(new Set([key]));
        setTimeout(() => setRecentlyMarked(new Set()), 2000);
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
            is1TG={isCell1TG(cell)}
            isRecentlyMarked={isCellRecentlyMarked(rowIndex, colIndex)}
          />
        ))
      ))}
    </div>
  );
}
