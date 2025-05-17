
import React, { useMemo } from 'react';

interface SimpleBingoTicketDisplayProps {
  numbers: number[] | number[][];  // Allow either format
  layoutMask: number;
  calledNumbers: number[];
  serial: string;
  perm: number;
  position?: number;
  autoMarking?: boolean;
  currentWinPattern?: string | null;
  showProgress?: boolean;
}

/**
 * Display a bingo ticket with the given properties
 */
export default function SimpleBingoTicketDisplay({
  numbers,
  layoutMask,
  calledNumbers,
  serial,
  perm,
  position = 0,
  autoMarking = true,
  currentWinPattern = null,
  showProgress = false
}: SimpleBingoTicketDisplayProps) {
  
  // Log incoming data for debugging
  console.log(`SimpleBingoTicketDisplay - Rendering ticket ${serial}, perm: ${perm}, pos: ${position}`);
  console.log(`Numbers type: ${Array.isArray(numbers) ? 
    (Array.isArray(numbers[0]) ? '2D array' : '1D array') : 'not array'}, length: ${Array.isArray(numbers) ? numbers.length : 0}`);
  console.log(`Called numbers: ${calledNumbers.length}`);
  
  // Format the ticket data into a 2D grid
  const numbersGrid = useMemo(() => {
    // If already a 2D array, use it directly
    if (Array.isArray(numbers) && Array.isArray(numbers[0])) {
      return numbers as number[][];
    }
    
    // If it's a flat array, convert to 2D grid based on layout mask
    if (Array.isArray(numbers)) {
      // For 90-ball bingo, default to 3 rows, 9 columns
      const rows = 3;
      const cols = 9;
      
      // Create the grid and fill with zeros (for empty cells)
      const grid: number[][] = Array(rows).fill(0).map(() => Array(cols).fill(0));
      
      // Populate grid from the flat array based on position
      let flatIndex = 0;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          // Check if this position should have a number based on layout mask
          // This is a simplification and might need adjustment
          const shouldHaveNumber = true; // In a real implementation, check the layout mask
          
          if (shouldHaveNumber && flatIndex < numbers.length) {
            grid[row][col] = numbers[flatIndex];
            flatIndex++;
          }
        }
      }
      
      return grid;
    }
    
    // Fallback to empty grid
    return [[0]]; 
  }, [numbers, layoutMask]);
  
  // Determine if a cell should be marked
  const isCalled = (number: number) => {
    return number > 0 && calledNumbers.includes(number);
  };
  
  // Render the ticket
  return (
    <div className="bg-white rounded-lg shadow p-2 max-w-md mx-auto">
      <div className="text-xs text-gray-600 flex justify-between mb-2">
        <span>Serial: {serial}</span>
        <span>Perm: {perm}</span>
        {position !== undefined && <span>Pos: {position}</span>}
      </div>
      
      <div className="grid grid-cols-9 gap-1">
        {numbersGrid.map((row, rowIndex) => (
          row.map((num, colIndex) => (
            <div 
              key={`${rowIndex}-${colIndex}`}
              className={`
                aspect-square flex items-center justify-center text-sm font-medium rounded
                ${num === 0 ? 'bg-gray-100' : 'bg-white border border-gray-300'} 
                ${isCalled(num) ? 'bg-green-100 border-green-500' : ''}
              `}
            >
              {num > 0 ? num : ''}
            </div>
          ))
        ))}
      </div>
      
      {showProgress && currentWinPattern && (
        <div className="mt-2 text-xs text-center text-gray-600">
          {/* Progress indicators would go here */}
          Pattern: {currentWinPattern}
        </div>
      )}
    </div>
  );
}
