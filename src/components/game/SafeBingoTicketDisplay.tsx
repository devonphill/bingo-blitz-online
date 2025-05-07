
import React, { useMemo, useState, useEffect } from "react";
import { processTicketLayout, getOneToGoNumbers, calculateTicketProgress } from "@/utils/ticketUtils";
import BingoCell from "./BingoCell";
import { logWithTimestamp } from "@/utils/logUtils";

// Error boundary specifically for ticket display
class TicketErrorBoundary extends React.Component<
  {children: React.ReactNode, serial: string, fallback?: React.ReactNode},
  {hasError: boolean}
> {
  constructor(props: {children: React.ReactNode, serial: string, fallback?: React.ReactNode}) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    logWithTimestamp(`Ticket display error for ticket ${this.props.serial}: ${error.message}`, 'error');
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="bg-red-50 p-4 border border-red-200 rounded-md">
          <p className="text-red-700">Failed to display ticket {this.props.serial}</p>
          <p className="text-sm text-red-600">There was an error rendering this ticket.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// Generate a local ID function that doesn't rely on React hooks
const generateLocalId = (() => {
  let idCounter = 0;
  return (prefix: string = "") => `${prefix}${idCounter++}`;
})();

interface SafeBingoTicketDisplayProps {
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

export default function SafeBingoTicketDisplay(props: SafeBingoTicketDisplayProps) {
  // Use the error boundary to catch any rendering errors
  return (
    <TicketErrorBoundary serial={props.serial}>
      <SimpleBingoTicketDisplay {...props} />
    </TicketErrorBoundary>
  );
}

function SimpleBingoTicketDisplay({
  numbers,
  layoutMask,
  calledNumbers,
  serial,
  perm,
  position,
  autoMarking = true,
  currentWinPattern = "oneLine",
  showProgress = true
}: SafeBingoTicketDisplayProps) {
  const [markedCells, setMarkedCells] = useState<Set<string>>(new Set());
  const [recentlyMarked, setRecentlyMarked] = useState<Set<string>>(new Set());
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  
  // Use a local ID that doesn't rely on React hooks
  const ticketId = useMemo(() => generateLocalId(`ticket-${serial}-`), [serial]);
  
  // Add more detailed logging
  useEffect(() => {
    logWithTimestamp(`SimpleBingoTicketDisplay mounted: ${serial}`, 'debug', 'BingoTicket');
    
    return () => {
      logWithTimestamp(`SimpleBingoTicketDisplay unmounting: ${serial}`, 'debug', 'BingoTicket');
    };
  }, [serial]);

  // Process grid layout from mask - memoized to avoid recalculating
  const grid = useMemo(() => {
    try {
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
    } catch (error) {
      console.error(`Error processing grid for ticket ${serial}:`, error);
      return Array(3).fill(null).map(() => Array(9).fill(null));
    }
  }, [numbers, layoutMask, serial, perm, position]);
  
  // Calculate one-to-go numbers - with error handling
  const oneTGNumbers = useMemo(() => {
    try {
      if (!currentWinPattern) return [];
      return getOneToGoNumbers(grid, calledNumbers, currentWinPattern);
    } catch (error) {
      console.error(`Error calculating one-to-go numbers for ticket ${serial}:`, error);
      return [];
    }
  }, [grid, calledNumbers, currentWinPattern, serial]);
  
  // Calculate win progress - with error handling
  const progress = useMemo(() => {
    try {
      if (!currentWinPattern) return { isWinner: false, numbersToGo: 0, completedLines: 0, linesToGo: 0 };
      return calculateTicketProgress(grid, calledNumbers, currentWinPattern);
    } catch (error) {
      console.error(`Error calculating ticket progress for ticket ${serial}:`, error);
      return { isWinner: false, numbersToGo: 0, completedLines: 0, linesToGo: 0 };
    }
  }, [grid, calledNumbers, currentWinPattern, serial]);
  
  // Effect to detect new called numbers to show flashing effects
  useEffect(() => {
    try {
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
    } catch (error) {
      console.error(`Error updating marked cells for ticket ${serial}:`, error);
    }
  }, [calledNumbers, grid, autoMarking, lastCalledNumber, serial]);
  
  // Determines if a cell should be marked as called
  function isCellMarked(row: number, col: number, value: number | null) {
    if (value === null) return false;
    if (autoMarking) return calledNumbers.includes(value);
    return markedCells?.has(`${row},${col}`) || false;
  }

  // Checks if a number is one-to-go
  function isCell1TG(value: number | null) {
    return value !== null && oneTGNumbers.includes(value);
  }
  
  // Checks if a cell was recently marked (for animation)
  function isCellRecentlyMarked(row: number, col: number) {
    return recentlyMarked.has(`${row},${col}`);
  }

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

  return React.createElement('div', { className: 'flex flex-col' },
    // Ticket Serial & Perm Information
    React.createElement('div', { className: 'mb-2 p-1 bg-gray-100 rounded-md flex justify-between items-center text-sm' },
      React.createElement('div', { className: 'font-bold text-black' }, 
        'Ticket: ',
        React.createElement('span', { className: 'font-mono bg-yellow-100 px-2 py-1 rounded text-black' }, serial || 'Unknown')
      ),
      React.createElement('div', { className: 'text-gray-700' },
        'Perm: ',
        React.createElement('span', { className: 'font-semibold' }, perm || 'Unknown'),
        position ? ` | Pos: ${position}` : ''
      )
    ),
    
    // Grid of cells
    React.createElement('div', { className: 'grid grid-cols-9 gap-1' },
      grid.flatMap((row, rowIndex) => 
        row.map((cell, colIndex) => 
          React.createElement(BingoCell, {
            key: `${rowIndex}-${colIndex}`,
            rowIndex,
            colIndex,
            value: cell,
            marked: isCellMarked(rowIndex, colIndex, cell),
            autoMarking,
            onClick: () => toggleMark(rowIndex, colIndex, cell),
            is1TG: isCell1TG(cell),
            isRecentlyMarked: isCellRecentlyMarked(rowIndex, colIndex)
          })
        )
      )
    ),
    
    // Progress Display (optional)
    showProgress && currentWinPattern && React.createElement('div', { className: 'mt-2 text-sm' },
      progress.isWinner && 
        React.createElement('div', { className: 'text-green-600 font-semibold' }, `Winner! (${currentWinPattern})`),
      
      !progress.isWinner && progress.linesToGo > 0 &&
        React.createElement('div', { className: 'text-gray-600' },
          `${progress.linesToGo} ${progress.linesToGo === 1 ? 'line' : 'lines'} to go`,
          progress.numbersToGo > 0 ? ` (${progress.numbersToGo} numbers needed)` : ''
        ),
      
      oneTGNumbers.length > 0 && 
        React.createElement('div', { className: 'text-orange-500 font-semibold mt-1' },
          'ONE TO GO: ', oneTGNumbers.join(', ')
        )
    )
  );
}
