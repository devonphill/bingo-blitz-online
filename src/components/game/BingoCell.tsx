
import React from 'react';

interface BingoCellProps {
  rowIndex: number;
  colIndex: number;
  value: number | null;
  marked: boolean;
  autoMarking: boolean;
  onClick: () => void;
  isOneTG?: boolean;
  is1TG?: boolean;  // Added for compatibility with BingoTicketDisplay
  isRecentlyMarked?: boolean;  // Added for recently called numbers animation
}

export default function BingoCell({
  rowIndex,
  colIndex,
  value,
  marked,
  autoMarking,
  onClick,
  isOneTG = false,
  is1TG = false,  // Add default value
  isRecentlyMarked = false  // Add default value
}: BingoCellProps) {
  // Use either isOneTG or is1TG (for backward compatibility)
  const isOneToGo = isOneTG || is1TG;
  
  if (value === null) {
    return (
      <div className="aspect-square bg-gray-100 rounded-sm flex items-center justify-center">
        <span className="text-transparent select-none">X</span>
      </div>
    );
  }

  return (
    <div
      className={`
        aspect-square rounded-sm flex items-center justify-center cursor-pointer
        text-sm font-medium transition-colors
        ${marked 
          ? 'bg-blue-600 text-white' 
          : isOneToGo 
            ? 'bg-amber-100 text-amber-800 border border-amber-300' 
            : 'bg-white border border-gray-200 text-gray-800 hover:bg-gray-50'
        }
        ${!autoMarking && !marked ? 'hover:bg-gray-100' : ''}
        ${isRecentlyMarked ? 'animate-pulse ring-2 ring-yellow-400' : ''}
      `}
      onClick={onClick}
    >
      {value}
    </div>
  );
}
