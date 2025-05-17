
import React, { useEffect, useState } from 'react';
import { processTicketLayout } from '@/utils/ticketUtils';

interface SimpleBingoTicketDisplayProps {
  numbers: (number | null)[] | number[];
  layoutMask: number;
  calledNumbers: number[];
  serial?: string;
  perm?: number;
  autoMarking?: boolean;
  onNumberClick?: (number: number) => void;
  showHeader?: boolean;
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
  
  // Process the ticket layout using the layout mask
  useEffect(() => {
    if (Array.isArray(numbers) && layoutMask !== undefined) {
      // Convert the flat array of numbers to a grid using the layout mask
      const numbersArray = numbers.filter(n => n !== null) as number[];
      const processedGrid = processTicketLayout(numbersArray, layoutMask);
      setGrid(processedGrid);
      
      console.log(`Processed ticket ${serial} - grid size: ${processedGrid.length}x${processedGrid[0]?.length || 0}`);
    }
  }, [numbers, layoutMask, serial]);
  
  if (!grid.length || grid.some(row => !row.length)) {
    return <div className="p-4 text-center text-gray-500">Processing ticket...</div>;
  }
  
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
                  const isEmpty = num === null;
                  const isCalled = !isEmpty && calledNumbers.includes(num);
                  
                  return (
                    <td 
                      key={`${rowIndex}-${colIndex}`}
                      className={`
                        border-r border-gray-200 last:border-r-0
                        text-center p-1 text-sm aspect-square
                        ${isEmpty ? 'bg-gray-100' : ''}
                        ${isCalled ? 'bg-green-100 font-bold' : ''}
                        ${autoMarking && isCalled ? 'bg-green-200' : ''}
                        ${!isEmpty ? 'cursor-pointer' : ''}
                      `}
                      onClick={() => {
                        if (!isEmpty && onNumberClick) onNumberClick(num);
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
