
import { useState, useMemo, useEffect } from 'react';
import { processTicketLayout, getOneToGoNumbers, calculateTicketProgress } from '@/utils/ticketUtils';
import { logWithTimestamp } from '@/utils/logUtils';

// Generate a local ID function that doesn't rely on React hooks
const generateLocalId = (() => {
  let idCounter = 0;
  return (prefix: string = "") => `${prefix}${idCounter++}`;
})();

interface UseTicketProcessorProps {
  numbers: number[];
  layoutMask: number;
  calledNumbers: number[];
  serial: string;
  autoMarking: boolean;
  currentWinPattern?: string | null;
}

/**
 * Hook for processing ticket data and managing ticket state
 */
export function useTicketProcessor({
  numbers,
  layoutMask,
  calledNumbers,
  serial,
  autoMarking,
  currentWinPattern = "oneLine"
}: UseTicketProcessorProps) {
  const [markedCells, setMarkedCells] = useState<Set<string>>(new Set());
  const [recentlyMarked, setRecentlyMarked] = useState<Set<string>>(new Set());
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  
  // Generate a unique ID for this ticket instance
  const ticketId = useMemo(() => generateLocalId(`ticket-${serial}-`), [serial]);
  
  // Log component lifecycle
  useEffect(() => {
    logWithTimestamp(`TicketProcessor mounted for ticket: ${serial}`, 'debug', 'BingoTicket');
    
    return () => {
      logWithTimestamp(`TicketProcessor unmounting for ticket: ${serial}`, 'debug', 'BingoTicket');
    };
  }, [serial]);

  // Process grid layout from mask
  const grid = useMemo(() => {
    try {
      console.log(`Processing ticket layout for ${serial}:`, { 
        numbers: Array.isArray(numbers) ? numbers.length : 'Not an array',
        layoutMask: layoutMask || 0
      });
      
      if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
        console.error(`Missing or invalid numbers array for ticket ${serial}:`, numbers);
        return Array(3).fill(null).map(() => Array(9).fill(null));
      }
      
      if (layoutMask === undefined || layoutMask === null) {
        console.error(`Missing layoutMask for ticket ${serial}, falling back to 0`, { layoutMask });
        return Array(3).fill(null).map(() => Array(9).fill(null));
      }
      
      const processedGrid = processTicketLayout(numbers, layoutMask);
      
      // Debug log for grid processing
      const numbersInGrid = processedGrid.flat().filter(n => n !== null).length;
      console.log(`Grid for ticket ${serial} contains ${numbersInGrid}/${numbers.length} numbers`);
      
      return processedGrid;
    } catch (error) {
      console.error(`Error processing grid for ticket ${serial}:`, error);
      return Array(3).fill(null).map(() => Array(9).fill(null));
    }
  }, [numbers, layoutMask, serial]);
  
  // Calculate one-to-go numbers
  const oneTGNumbers = useMemo(() => {
    try {
      if (!currentWinPattern) return [];
      return getOneToGoNumbers(grid, calledNumbers, currentWinPattern);
    } catch (error) {
      console.error(`Error calculating one-to-go numbers for ticket ${serial}:`, error);
      return [];
    }
  }, [grid, calledNumbers, currentWinPattern, serial]);
  
  // Calculate win progress
  const progress = useMemo(() => {
    try {
      if (!currentWinPattern) return { isWinner: false, numbersToGo: 0, completedLines: 0, linesToGo: 0 };
      return calculateTicketProgress(grid, calledNumbers, currentWinPattern);
    } catch (error) {
      console.error(`Error calculating ticket progress for ticket ${serial}:`, error);
      return { isWinner: false, numbersToGo: 0, completedLines: 0, linesToGo: 0 };
    }
  }, [grid, calledNumbers, currentWinPattern, serial]);
  
  // Effect for auto-marking and animations
  useEffect(() => {
    try {
      if (!autoMarking || calledNumbers.length === 0) return;
      
      const lastCalled = calledNumbers[calledNumbers.length - 1];
      if (lastCalledNumber === lastCalled) return;
      
      setLastCalledNumber(lastCalled);
      
      // Find position of lastCalled in our grid and mark it
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
    } catch (error) {
      console.error(`Error updating marked cells for ticket ${serial}:`, error);
    }
  }, [calledNumbers, grid, autoMarking, lastCalledNumber, serial]);

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

  return {
    grid,
    markedCells,
    recentlyMarked,
    oneTGNumbers,
    progress,
    ticketId,
    toggleMark
  };
}
