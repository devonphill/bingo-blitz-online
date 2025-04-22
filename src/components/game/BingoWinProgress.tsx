
import React from "react";
import { getGameRulesForType } from '@/game-rules/gameRulesRegistry';

export default function BingoWinProgress({
  numbers,
  layoutMask,
  calledNumbers,
  activeWinPatterns,
  currentWinPattern,
  gameType = '90-ball'
}: {
  numbers: number[],
  layoutMask: number,
  calledNumbers: number[],
  activeWinPatterns: string[],
  currentWinPattern?: string | null,
  gameType?: string
}) {
  // Get the game rules for this game type
  const gameRules = getGameRulesForType(gameType);
  
  // Create a ticket object to pass to the rules engine
  const ticket = {
    numbers,
    layoutMask
  };
  
  // We'll prioritize the current win pattern if provided
  const patternsToCheck = currentWinPattern 
    ? [currentWinPattern] 
    : activeWinPatterns;
  
  const result: { [pattern: string]: number } = {};
  
  // Calculate distance to win for each pattern
  patternsToCheck.forEach(pattern => {
    const distance = gameRules.getWinDistance(pattern, ticket, calledNumbers);
    result[pattern] = distance;
  });
  
  // Get the distance for the current win pattern, or the minimum of all active patterns
  let minToGo = 15; // Default high value
  
  if (currentWinPattern && result[currentWinPattern] !== undefined) {
    minToGo = result[currentWinPattern];
  } else if (patternsToCheck.length > 0) {
    const distances = patternsToCheck.map(p => result[p] ?? 15);
    minToGo = Math.min(...distances);
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
