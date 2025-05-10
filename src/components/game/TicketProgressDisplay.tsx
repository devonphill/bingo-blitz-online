
import React from 'react';

interface TicketProgressDisplayProps {
  showProgress: boolean;
  currentWinPattern: string | null;
  progress: {
    isWinner: boolean;
    numbersToGo: number;
    completedLines: number;
    linesToGo: number;
  };
  oneTGNumbers: number[];
}

/**
 * Component for displaying ticket progress information
 */
export default function TicketProgressDisplay({
  showProgress,
  currentWinPattern,
  progress,
  oneTGNumbers
}: TicketProgressDisplayProps) {
  if (!showProgress || !currentWinPattern) return null;

  return (
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
  );
}
