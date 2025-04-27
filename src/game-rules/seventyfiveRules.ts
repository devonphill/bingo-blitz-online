
// src/game-rules/seventyfiveRules.ts

// Ensure interfaces are imported correctly
import type { GameRules, TicketStatus, DefaultWinPattern } from './types';

// Make sure the class is exported and the name matches EXACTLY 'SeventyfiveRules'
export class SeventyfiveRules implements GameRules {
  getGameTypeName(): string {
    // Conventionally might be '75-ball Pattern' or '75-ball Blackout' depending on game mode
    // Using '75-ball' for now as a general type
    return '75-ball';
  }

  getDefaultWinPatterns(): DefaultWinPattern[] {
    // Provide default patterns suitable for 75-ball
    return [
      {
        id: "pattern", // Example ID, might need more specific IDs later
        name: "Pattern",
      },
      {
        id: "blackout",
        name: "Blackout / Coverall",
      },
      // Add others as needed: 'fourCorners', 'lineHorizontal', etc.
    ];
  }

  // Implement the getWinPatterns method required by GameRules interface
  getWinPatterns(): { id: string; name: string; gameType: string; available: boolean; }[] {
    return [
      { id: "pattern", name: "Pattern", gameType: "75ball", available: true },
      { id: "blackout", name: "Blackout / Coverall", gameType: "75ball", available: true }
    ];
  }
  
  // Implement the generateNewNumber method required by GameRules interface
  generateNewNumber(calledItems: number[]): number {
    // Generate a number between 1 and 75 that hasn't been called yet
    const possibleNumbers = Array.from({ length: 75 }, (_, i) => i + 1)
      .filter(num => !calledItems.includes(num));
    
    if (possibleNumbers.length === 0) {
      throw new Error("All numbers have been called already");
    }
    
    const randomIndex = Math.floor(Math.random() * possibleNumbers.length);
    return possibleNumbers[randomIndex];
  }

  // Placeholder implementation - needs real logic for 75-ball
  getTicketStatus(ticketData: any, calledItems: Array<any>, activePatternId: string): TicketStatus {
    const calledNumbers = calledItems.filter(item => typeof item === 'number') as number[];
    // Adjust based on actual 75-ball ticket structure (e.g., 5x5 grid with free space)
    const numbers = ticketData?.numbers; // Placeholder

    if (!Array.isArray(numbers)) {
         console.error("Invalid 75-ball ticket data:", ticketData);
         return { distance: Infinity, isWinner: false };
    }

    if (activePatternId === "blackout") {
      // Assuming 'numbers' contains all non-free-space numbers on the card
      const uncalledCount = numbers.filter(num => !calledNumbers.includes(num)).length;
      return { distance: uncalledCount, isWinner: uncalledCount === 0 };
    }

    // Placeholder for pattern wins
    console.warn(`Pattern validation for "${activePatternId}" not implemented for 75-ball.`);
    return { distance: Infinity, isWinner: false };
  }
}
