
import React from 'react';

interface BingoCardProps {
  numbers: number[];
  numberRange: number;
}

const BingoCard: React.FC<BingoCardProps> = ({ numbers, numberRange }) => {
  // Create a 5x5 grid for visual representation
  const gridSize = 5;
  const grid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null));
  
  // Mark called numbers on the grid
  const markCalledNumbers = () => {
    // Simple display of called numbers in a grid format
    for (let i = 0; i < numbers.length; i++) {
      const num = numbers[i];
      const row = Math.floor((num - 1) / gridSize);
      const col = (num - 1) % gridSize;
      if (row < gridSize && col < gridSize) {
        grid[row][col] = num;
      }
    }
  };
  
  markCalledNumbers();
  
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-medium mb-4">Called Numbers</h3>
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: numberRange }).map((_, idx) => {
          const number = idx + 1;
          return (
            <div 
              key={number}
              className={`aspect-square flex items-center justify-center text-sm font-medium rounded-full p-2
                ${numbers.includes(number) 
                  ? 'bg-green-500 text-white' 
                  : 'bg-gray-100 text-gray-400'}`}
            >
              {number}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BingoCard;
