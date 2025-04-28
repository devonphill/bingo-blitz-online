
import React, { useMemo, useState, useEffect } from "react";
import { processTicketLayout, getOneToGoNumbers, calculateTicketProgress } from "@/utils/ticketUtils";
import BingoCell from "./BingoCell";

interface BingoTicketDisplayProps {
  numbers: number[];
  layoutMask: number;
  calledNumbers: number[];
  serial: string;
  perm: number;
  position?: number;
  autoMarking?: boolean;
  currentWinPattern?: string | null;
  showProgress?: boolean;
}

export default function BingoTicketDisplay({
  numbers,
  layoutMask,
  calledNumbers,
  serial,
  perm,
  position,
  autoMarking = true,
  currentWinPattern = "oneLine",
  showProgress = true
}: BingoTicketDisplayProps) {
  const [markedCells, setMarkedCells] = useState<Set<string>>(new Set());
  const [recentlyMarked, setRecentlyMarked] = useState<Set<string>>(new Set());
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  
  // Process grid layout from mask - memoized to avoid recalculating
  const grid = useMemo(() => {
    if (!numbers || layoutMask === undefined || layoutMask === null) {
      console.error("Missing numbers or layoutMask for ticket", { serial, perm, numbers, layoutMask });
      return Array(3).fill(null).map(() => Array(9).fill(null));
    }
    return processTicketLayout(numbers, layoutMask);
  }, [numbers, layoutMask, serial, perm]);
  
  // Calculate one-to-go numbers
  const oneTGNumbers = useMemo(() => {
    if (!currentWinPattern) return [];
    return getOneToGoNumbers(grid, calledNumbers, currentWinPattern);
  }, [grid, calledNumbers, currentWinPattern]);
  
  // Calculate win progress
  const progress = useMemo(() => {
    if (!currentWinPattern) return { isWinner: false, numbersToGo: 0, completedLines: 0, linesToGo: 0 };
    return calculateTicketProgress(grid, calledNumbers, currentWinPattern);
  }, [grid, calledNumbers, currentWinPattern]);
  
  // Effect to detect new called numbers to show flashing effects
  useEffect(() => {
    if (!autoMarking || calledNumbers.length === 0) return;
    
    const lastCalled = calledNumbers[calledNumbers.length - 1];
    if (lastCalledNumber === lastCalled) return;
    
    setLastCalledNumber(lastCalled);
    
    // Find position of lastCalled in our grid
    grid.forEach((row, rowIdx) => {
      row.forEach((cell, colIdx) => {
        if (cell === lastCalled) {
          setRecentlyMarked(prev => {
            const next = new Set(prev);
            next.add(`${rowIdx},${colIdx}`);
            return next;
          });
          
          // Clear flashing after animation completes
          setTimeout(() => {
            setRecentlyMarked(prev => {
              const next = new Set(prev);
              next.delete(`${rowIdx},${colIdx}`);
              return next;
            });
          }, 2000);
        }
      });
    });
  }, [calledNumbers, grid, autoMarking, lastCalledNumber]);
  
  // Function to handle cell clicking for manual marking
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
    <div className="flex flex-col">
      <div className="grid grid-cols-9 gap-1">
        {grid.map((row, rowIndex) => (
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
      
      {/* Ticket Information - Improve visibility of serial and perm numbers */}
      <div className="mt-2 text-xs text-gray-700 flex justify-between border-t pt-2">
        <div className="font-semibold">Serial: <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">{serial}</span></div>
        <div className="font-semibold">Perm: <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">{perm}</span>{position ? ` | Pos: ${position}` : ''}</div>
      </div>
      
      {/* Progress Display (optional) */}
      {showProgress && currentWinPattern && (
        <div className="mt-2 text-sm">
          {progress.isWinner ? (
            <div className="text-green-600 font-semibold">Winner! ({currentWinPattern})</div>
          ) : progress.linesToGo > 0 ? (
            <div className="text-gray-600">
              {progress.linesToGo} {progress.linesToGo === 1 ? 'line' : 'lines'} to go 
              {progress.numbersToGo > 0 ? ` (${progress.numbersToGo} numbers needed)` : ''}
            </div>
          ) : null}
          
          {oneTGNumbers.length > 0 && (
            <div className="text-orange-500 font-semibold mt-1">
              ONE TO GO: {oneTGNumbers.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
