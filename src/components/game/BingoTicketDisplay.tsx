
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
  
  console.log(`Rendering BingoTicketDisplay:`, { 
    serial, 
    perm, 
    position, 
    layoutMask, 
    numbers: Array.isArray(numbers) ? numbers.length : 'Not an array',
    effectiveLayoutMask: layoutMask || 0 // Use 0 as fallback
  });
  
  // Process grid layout from mask - memoized to avoid recalculating
  const grid = useMemo(() => {
    // Log more detailed information about the inputs
    console.log(`Processing ticket layout for ${serial}:`, { 
      numbers: Array.isArray(numbers) ? numbers.length : 'Not an array',
      layoutMask: layoutMask || 0,
      perm: perm || 'Unknown',
      position: position || 'Unknown'
    });
    
    if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
      console.error(`Missing or invalid numbers array for ticket ${serial}:`, numbers);
      return Array(3).fill(null).map(() => Array(9).fill(null));
    }
    
    if (layoutMask === undefined || layoutMask === null) {
      console.error(`Missing layoutMask for ticket ${serial}, falling back to 0`, { layoutMask });
      return Array(3).fill(null).map(() => Array(9).fill(null));
    }
    
    // Use the refactored processTicketLayout function
    const processedGrid = processTicketLayout(numbers, layoutMask);
    
    // Debug log the grid to see if it's correct
    const numbersInGrid = processedGrid.flat().filter(n => n !== null).length;
    console.log(`Grid for ticket ${serial} contains ${numbersInGrid}/${numbers.length} numbers`, 
      { 
        row1: processedGrid[0].filter(n => n !== null).length,
        row2: processedGrid[1].filter(n => n !== null).length, 
        row3: processedGrid[2].filter(n => n !== null).length,
        allNumbers: processedGrid.flat().filter(n => n !== null)
      });
    
    return processedGrid;
  }, [numbers, layoutMask, serial, perm, position]);
  
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

  // If there's an issue with the grid, show a valid empty grid
  if (!grid || grid.length !== 3) {
    console.error(`Invalid grid for ticket ${serial}`, grid);
    return (
      <div className="flex flex-col">
        <div className="bg-red-100 text-red-800 p-2 rounded-md mb-2">
          Error displaying ticket
        </div>
        <div className="grid grid-cols-9 gap-1">
          {Array(27).fill(null).map((_, i) => (
            <div key={i} className="aspect-square bg-gray-100"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
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
      
      {/* Ticket Information - Make serial and perm numbers very visible */}
      <div className="mt-2 text-xs text-gray-700 flex justify-between border-t pt-2">
        <div className="font-semibold">Serial: <span className="font-mono bg-gray-100 px-1 py-0.5 rounded text-black">{serial || 'Unknown'}</span></div>
        <div className="font-semibold">Perm: <span className="font-mono bg-gray-100 px-1 py-0.5 rounded text-black">{perm || 'Unknown'}</span>{position ? ` | Pos: ${position}` : ''}</div>
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
