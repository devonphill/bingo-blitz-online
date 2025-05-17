import React, { useEffect, useState } from 'react';

interface SimpleBingoTicketDisplayProps {
  numbers: (number | null)[] | (number | null)[][];
  layoutMask?: number;
  calledNumbers: number[];
  serial?: string;
  perm?: number;
  autoMarking?: boolean;
  onNumberClick?: (number: number) => void;
  showHeader?: boolean;
}

// Helper function to convert flat array to grid format
function convertToGrid(numbers: (number | null)[] | (number | null)[][], cols = 9, rows = 3): (number | null)[][] {
  // If numbers is already a 2D array, return it
  if (Array.isArray(numbers) && numbers.length > 0 && Array.isArray(numbers[0])) {
    return numbers as (number | null)[][];
  }
  
  // Otherwise convert from flat array
  const flatNumbers = numbers as (number | null)[];
  const grid: (number | null)[][] = [];
  
  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    for (let c = 0; c < cols; c++) {
      const index = r * cols + c;
      grid[r][c] = index < flatNumbers.length ? flatNumbers[index] : null;
    }
  }
  
  return grid;
}

const SimpleBingoTicketDisplay: React.FC<SimpleBingoTicketDisplayProps> = ({
  numbers,
  layoutMask,
  calledNumbers = [],
  serial = '',
  perm = 0,
  autoMarking = true,
  onNumberClick,
  showHeader = true
}) => {
  const [grid, setGrid] = useState<(number | null)[][]>([]);
  
  // Convert flat array to grid on mount or when numbers change
  useEffect(() => {
    // Check if numbers is an array
    if (Array.isArray(numbers)) {
      setGrid(convertToGrid(numbers));
    }
  }, [numbers]);
  
  if (!grid.length) return <div>Loading ticket...</div>;
  
  return (
    <div className="w-full max-w-md mx-auto">
      {showHeader && (
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <div>Serial: {serial}</div>
          <div>Perm: {perm}</div>
        </div>
      )}
      
      <div className="border border-gray-300 rounded-sm overflow-hidden">
        <table className="w-full border-collapse">
          <tbody>
            {grid.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-gray-200 last:border-b-0">
                {row.map((num, colIndex) => {
                  const cellNumber: number = typeof num === 'number' ? num : 0;
                  const isEmpty = num === null || num === 0;
                  const isCalled = !isEmpty && calledNumbers.includes(cellNumber);
                  
                  return (
                    <td 
                      key={colIndex}
                      className={`
                        border-r border-gray-200 last:border-r-0
                        text-center p-1 text-sm aspect-square
                        ${isEmpty ? 'bg-gray-100' : ''}
                        ${isCalled ? 'bg-green-100 font-bold' : ''}
                        ${autoMarking && isCalled ? 'bg-green-200' : ''}
                      `}
                      onClick={() => {
                        if (!isEmpty && onNumberClick) onNumberClick(cellNumber);
                      }}
                    >
                      {!isEmpty ? num : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SimpleBingoTicketDisplay;
