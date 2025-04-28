import React, { useState, useEffect } from "react";
import BingoCell from "./BingoCell";
import BingoCard from "./BingoCard";

interface BingoCardGridProps {
  tickets?: any[];
  calledNumbers: number[];
  autoMarking: boolean;
  activeWinPatterns: string[];
  currentWinPattern?: string | null;
  gameType?: string;
  // Legacy props
  card?: (number | null)[][];
  markedCells?: Set<string>;
  setMarkedCells?: (f: (prev: Set<string>) => Set<string>) => void;
  oneTGNumbers?: number[];
}

export default function BingoCardGrid({
  tickets = [],
  calledNumbers = [],
  autoMarking = true,
  activeWinPatterns = [],
  currentWinPattern = null,
  gameType = '90-ball',
  card,
  markedCells,
  setMarkedCells,
  oneTGNumbers = []
}: BingoCardGridProps) {
  // If we're using legacy props, render the legacy card grid
  if (card && markedCells && setMarkedCells) {
    return renderLegacyCard();
  }
  
  // Render the new ticket-based grid
  return (
    <div className="space-y-6">
      {tickets.map((ticket, index) => (
        <div key={ticket.serial || index} className="p-4 bg-white rounded-lg shadow">
          <div className="flex justify-between items-center mb-3">
            <div className="text-sm font-medium">
              Serial: <span className="font-mono">{ticket.serial}</span>
            </div>
            <div className="text-sm font-medium">
              Perm: <span className="font-mono">{ticket.perm}</span>
            </div>
          </div>
          <BingoCard
            numbers={ticket.numbers}
            layoutMask={ticket.layoutMask || ticket.layout_mask}
            calledNumbers={calledNumbers}
            autoMarking={autoMarking}
            activeWinPatterns={activeWinPatterns}
          />
        </div>
      ))}
      
      {tickets.length === 0 && (
        <div className="p-4 bg-white rounded-lg shadow text-center text-gray-500">
          No tickets assigned
        </div>
      )}
    </div>
  );

  // Legacy render function (for backward compatibility)
  function renderLegacyCard() {
    
    const [recentlyMarked, setRecentlyMarked] = useState<Set<string>>(new Set());
    
    // Track recently called numbers for flashing effect
    useEffect(() => {
      if (!autoMarking || !card) return;
      
      // Find newly marked cells
      const newlyMarked = new Set<string>();
      
      card.forEach((row, rowIndex) => {
        row.forEach((value, colIndex) => {
          if (value === null) return;
          
          const key = `${rowIndex},${colIndex}`;
          const isMarked = calledNumbers.includes(value);
          const wasMarked = [...(markedCells || new Set())].some(cellKey => cellKey === key);
          
          // If it's newly marked, add to recentlyMarked set
          if (isMarked && !wasMarked) {
            newlyMarked.add(key);
          }
        });
      });
      
      if (newlyMarked.size > 0) {
        setRecentlyMarked(newlyMarked);
        
        // Clear the recently marked status after animation completes
        setTimeout(() => {
          setRecentlyMarked(new Set());
        }, 2000);
      }
    }, [calledNumbers, card, markedCells, autoMarking]);

    

    const isCellMarked = (row: number, col: number, value: number | null) => {
      if (value === null) return false;
      if (autoMarking) return calledNumbers.includes(value);
      return markedCells?.has(`${row},${col}`) || false;
    };

    const isCell1TG = (value: number | null) => {
      return value !== null && oneTGNumbers.includes(value);
    };
    
    const isCellRecentlyMarked = (row: number, col: number) => {
      return recentlyMarked.has(`${row},${col}`);
    };

    const toggleMark = (row: number, col: number, value: number | null) => {
      if (value === null || autoMarking || !setMarkedCells) return;
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

    if (!card) return null;

    return (
      <div className="grid grid-cols-9 gap-1">
        {card.map((row, rowIndex) => (
          row.map((cell, colIndex) => (
            <BingoCell
              key={`${rowIndex}-${colIndex}`}
              rowIndex={rowIndex}
              colIndex={colIndex}
              value={cell}
              marked={isCellMarked(rowIndex, colIndex, cell)}
              autoMarking={autoMarking}
              onClick={() => toggleMark(rowIndex, colIndex, cell)}
              is1TG={isCell1TG(cell)}
              isRecentlyMarked={isCellRecentlyMarked(rowIndex, colIndex)}
            />
          ))
        ))}
      </div>
    );
  }
}
