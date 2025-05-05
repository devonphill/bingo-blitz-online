
import React from 'react';

interface BingoCellProps {
  rowIndex: number;
  colIndex: number;
  value: number | null;
  marked: boolean;
  autoMarking: boolean;
  onClick: () => void;
  isOneTG?: boolean;
}

export default function BingoCell({
  rowIndex,
  colIndex,
  value,
  marked,
  autoMarking,
  onClick,
  isOneTG = false
}: BingoCellProps) {
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
          : isOneTG 
            ? 'bg-amber-100 text-amber-800 border border-amber-300' 
            : 'bg-white border border-gray-200 text-gray-800 hover:bg-gray-50'
        }
        ${!autoMarking && !marked ? 'hover:bg-gray-100' : ''}
      `}
      onClick={onClick}
    >
      {value}
    </div>
  );
}
