
import React, { useState, useEffect } from "react";
import OneTouchAnimation from "./OneTouchAnimation";

export default function BingoCell({
  rowIndex,
  colIndex,
  value,
  marked,
  autoMarking,
  onClick,
  is1TG = false,
  isRecentlyMarked = false
}: {
  rowIndex: number,
  colIndex: number,
  value: number | null,
  marked: boolean,
  autoMarking: boolean,
  onClick: () => void,
  is1TG?: boolean,
  isRecentlyMarked?: boolean
}) {
  const [flashState, setFlashState] = useState<'black' | 'white' | null>(null);
  
  // Create flashing effect when a cell is newly marked
  useEffect(() => {
    if (marked && isRecentlyMarked) {
      // Start flashing between black and white
      const flashInterval = setInterval(() => {
        setFlashState(prev => prev === 'black' ? 'white' : 'black');
      }, 200); // Flash every 200ms
      
      // Stop flashing after 1.5 seconds
      setTimeout(() => {
        clearInterval(flashInterval);
        setFlashState(null);
      }, 1500);
      
      return () => clearInterval(flashInterval);
    }
  }, [marked, isRecentlyMarked]);

  return (
    <div
      className={`relative aspect-square flex items-center justify-center text-sm font-medium border rounded
        ${value !== null ? (autoMarking ? 'cursor-default' : 'cursor-pointer hover:bg-gray-50') : 'bg-gray-100'}
        ${is1TG && !marked ? 'border-green-500 border-2' : ''}
        ${marked ? `${flashState === 'black' ? 'bg-black' : flashState === 'white' ? 'bg-white' : ''}` : ''}
      `}
      onClick={onClick}
      style={{
        overflow: "hidden",
        minHeight: 32,
        minWidth: 32,
        position: "relative"
      }}
      tabIndex={value !== null && !autoMarking ? 0 : -1}
      aria-pressed={marked}
    >
      {value !== null ? (
        <>
          <span
            className={`relative z-10 select-none ${
              marked 
                ? flashState 
                  ? (flashState === 'black' ? 'text-white' : 'text-black') 
                  : 'text-white' 
                : is1TG 
                  ? "text-green-600 font-bold" 
                  : ""
            }`}
          >
            {value}
          </span>
          {marked && !flashState && (
            <span
              className="absolute inset-0 z-20 flex items-center justify-center rounded bg-black"
              style={{ opacity: 0.6 }}
            />
          )}
          {is1TG && !marked && <OneTouchAnimation />}
        </>
      ) : ""}
    </div>
  );
}
