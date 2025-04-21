
// BingoCard.tsx -- splits to use BingoCardGrid and BingoCell

import React, { useState, useEffect } from 'react';
import BingoCardGrid from './BingoCardGrid';
import { useAutoMark } from './useAutoMark';

interface BingoCardProps {
  numbers?: number[];
  layoutMask?: number;
  calledNumbers?: number[];
  autoMarking?: boolean;
  activeWinPatterns?: string[];
}

export default function BingoCard({
  numbers = [],
  layoutMask,
  calledNumbers = [],
  autoMarking = true,
  activeWinPatterns = []
}: BingoCardProps) {
  const {
    card,
    markedCells,
    setMarkedCells,
    generateCardFromNumbersAndMask,
    generateCardFromNumbers,
    generateCard
  } = useAutoMark({ numbers, layoutMask, calledNumbers, autoMarking });
  
  const [oneTGNumbers, setOneTGNumbers] = useState<number[]>([]);
  
  // Calculate 1TG numbers based on active win patterns
  useEffect(() => {
    if (!card.length || !activeWinPatterns.length) {
      setOneTGNumbers([]);
      return;
    }
    
    const uncalledNumbers = numbers.filter(n => !calledNumbers.includes(n));
    const oneTGs: number[] = [];
    
    // Convert card structure to check rows for win patterns
    const rows: number[][] = [];
    card.forEach((rowData, rowIndex) => {
      const validNumbers = rowData
        .filter((num): num is number => num !== null)
        .filter(num => numbers.includes(num));
      rows.push(validNumbers);
    });
    
    // Check for one line pattern (one away numbers)
    if (activeWinPatterns.includes("oneLine")) {
      rows.forEach(row => {
        const markedInRow = row.filter(num => calledNumbers.includes(num));
        if (markedInRow.length === row.length - 1) {
          // This row is one away from winning
          const oneAway = row.find(num => !calledNumbers.includes(num));
          if (oneAway && !oneTGs.includes(oneAway)) {
            oneTGs.push(oneAway);
          }
        }
      });
    }
    
    // Check for two lines pattern
    if (activeWinPatterns.includes("twoLines")) {
      // Count completed rows
      const completedRowCount = rows.filter(row => 
        row.every(num => calledNumbers.includes(num))
      ).length;
      
      if (completedRowCount === 1) {
        // We have one complete line, looking for rows with all but one marked
        rows.forEach(row => {
          const markedInRow = row.filter(num => calledNumbers.includes(num));
          if (markedInRow.length === row.length - 1 && markedInRow.length > 0) {
            // This row is one away from winning
            const oneAway = row.find(num => !calledNumbers.includes(num));
            if (oneAway && !oneTGs.includes(oneAway)) {
              oneTGs.push(oneAway);
            }
          }
        });
      }
    }
    
    // Check for full house pattern
    if (activeWinPatterns.includes("fullHouse")) {
      // Count completed rows
      const completedRowCount = rows.filter(row => 
        row.every(num => calledNumbers.includes(num))
      ).length;
      
      if (completedRowCount === 2) {
        // We have two complete lines, looking for a row with all but one marked
        rows.forEach(row => {
          const markedInRow = row.filter(num => calledNumbers.includes(num));
          if (markedInRow.length === row.length - 1 && markedInRow.length > 0) {
            // This row is one away from winning
            const oneAway = row.find(num => !calledNumbers.includes(num));
            if (oneAway && !oneTGs.includes(oneAway)) {
              oneTGs.push(oneAway);
            }
          }
        });
      }
    }
    
    setOneTGNumbers(oneTGs);
  }, [card, calledNumbers, activeWinPatterns, numbers]);

  // Reset marked cells when prop changes and not autoMarking
  useEffect(() => {
    if (autoMarking) setMarkedCells(new Set());
  }, [autoMarking, numbers, layoutMask, setMarkedCells]);

  return (
    <BingoCardGrid
      card={card}
      markedCells={markedCells}
      calledNumbers={calledNumbers}
      autoMarking={autoMarking}
      setMarkedCells={setMarkedCells}
      oneTGNumbers={oneTGNumbers}
    />
  );
}
