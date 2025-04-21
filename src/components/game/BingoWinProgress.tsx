
import React from "react";

const WIN_PATTERNS: { [key: string]: { label: string; lines: number } } = {
  oneLine: { label: "One Line", lines: 1 },
  twoLines: { label: "Two Lines", lines: 2 },
  fullHouse: { label: "Full House", lines: 3 }
};

export default function BingoWinProgress({
  numbers,
  layoutMask,
  calledNumbers,
  activeWinPatterns,
  currentWinPattern
}: {
  numbers: number[],
  layoutMask: number,
  calledNumbers: number[],
  activeWinPatterns: string[],
  currentWinPattern?: string | null
}) {
  // Replicates calcTicketProgress logic
  const maskBits = layoutMask.toString(2).padStart(27, "0").split("").reverse();
  const rows: (number | null)[][] = [[], [], []];
  let nIdx = 0;

  for (let i = 0; i < 27; i++) {
    const row = Math.floor(i / 9);
    if (maskBits[i] === '1') {
      rows[row].push(numbers[nIdx]);
      nIdx++;
    } else {
      rows[row].push(null);
    }
  }

  const lineCounts = rows.map(line => line.filter(num => num !== null && calledNumbers.includes(num as number)).length);
  const lineNeeded = rows.map(line => line.filter(num => num !== null).length);
  const completedLines = lineCounts.filter((count, idx) => count === lineNeeded[idx]).length;

  const result: { [pattern: string]: number } = {};
  
  // We'll prioritize the current win pattern if provided
  const patternsToCheck = currentWinPattern 
    ? [currentWinPattern] 
    : activeWinPatterns;
  
  patternsToCheck.forEach(pattern => {
    if (!WIN_PATTERNS[pattern]) return;
    
    const { lines } = WIN_PATTERNS[pattern];
    const linesToGo = Math.max(0, lines - completedLines);
    let minNeeded = Infinity;
    
    if (linesToGo === 0) {
      minNeeded = 0;
    } else {
      const incompleteLines = rows
        .map((line, idx) => lineNeeded[idx] - lineCounts[idx])
        .filter(n => n > 0);
        
      minNeeded = incompleteLines.length > 0 
        ? Math.min(...incompleteLines) 
        : 0;
    }
    
    result[pattern] = minNeeded;
  });

  // Get the value for the current win pattern, or the minimum of all active patterns
  let minToGo = 15; // Default high value
  
  if (currentWinPattern && result[currentWinPattern] !== undefined) {
    minToGo = result[currentWinPattern];
  } else if (patternsToCheck.length > 0) {
    minToGo = Math.min(...patternsToCheck.map(p => result[p] ?? 15));
  }
  
  return (
    <span className={minToGo <= 3 ? "font-bold text-green-600" : "font-medium text-gray-700"}>
      {minToGo === 0 
        ? "Bingo!" 
        : minToGo === 1 
          ? "1TG" 
          : minToGo === 2 
            ? "2TG" 
            : minToGo === 3 
              ? "3TG" 
              : `${minToGo} to go`}
    </span>
  );
}
