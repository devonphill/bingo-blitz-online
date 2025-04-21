
import React, { useEffect, useState } from 'react';
import CurrentNumberDisplay from './CurrentNumberDisplay';

interface CalledNumbersProps {
  calledNumbers: number[];
  currentNumber: number | null;
}

export default function CalledNumbers({ calledNumbers, currentNumber }: CalledNumbersProps) {
  const [isFlashing, setIsFlashing] = useState(false);
  
  // Flash effect for current number
  useEffect(() => {
    if (currentNumber) {
      setIsFlashing(true);
      const timer = setInterval(() => {
        setIsFlashing(prev => !prev);
      }, 500);
      
      // Stop flashing after 3 seconds
      const stopTimer = setTimeout(() => {
        clearInterval(timer);
        setIsFlashing(true); // Keep visible
      }, 3000);
      
      return () => {
        clearInterval(timer);
        clearTimeout(stopTimer);
      };
    }
  }, [currentNumber]);
  
  // Group called numbers by tens (1-9, 10-19, etc.)
  const groupedNumbers: { [key: string]: number[] } = {};
  
  for (let i = 0; i < 9; i++) {
    const min = i * 10 + 1;
    const max = i === 8 ? 90 : (i + 1) * 10;
    const label = `${min}-${max}`;
    
    groupedNumbers[label] = calledNumbers.filter(n => n >= min && n <= max);
  }

  // Color map for number balls based on their range
  const getColor = (number: number) => {
    if (number <= 9) return 'bg-red-500';
    if (number <= 19) return 'bg-yellow-500';
    if (number <= 29) return 'bg-green-500';
    if (number <= 39) return 'bg-blue-500';
    if (number <= 49) return 'bg-indigo-500';
    if (number <= 59) return 'bg-purple-500';
    if (number <= 69) return 'bg-pink-500';
    if (number <= 79) return 'bg-orange-500';
    return 'bg-teal-500';
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4 text-center">Called Numbers</h2>
      
      {currentNumber && (
        <div className="mb-6 flex justify-center">
          <div className={isFlashing ? "opacity-100" : "opacity-50"} style={{ transition: "opacity 0.3s ease" }}>
            <CurrentNumberDisplay number={currentNumber} sizePx={90} />
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(groupedNumbers).map(([range, numbers]) => (
          <div key={range} className="border rounded-md p-2">
            <div className="text-sm font-semibold mb-1">{range}</div>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: Math.min(10, parseInt(range.split('-')[1])) - parseInt(range.split('-')[0]) + 1 }, (_, i) => {
                const number = parseInt(range.split('-')[0]) + i;
                const isCalled = numbers.includes(number);
                
                return (
                  <div 
                    key={number}
                    className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold
                      ${isCalled ? `${getColor(number)} text-white` : 'bg-gray-100 text-gray-500'}`}
                  >
                    {number}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
