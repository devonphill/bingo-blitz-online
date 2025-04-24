// src/game-rules/ninetyBallRules.ts

// Correctly import the interfaces from the updated types file
import type { GameRules, TicketStatus, DefaultWinPattern } from './types';

// Helper function to parse 90-ball ticket data (assuming layoutMask and numbers array)
// (Keep the improved helper function from the previous step)
function parseNinetyBallTicket(ticketData: any): { numbers: number[]; rows: (number | null)[][]; isValid: boolean } {
    const layoutMask = ticketData?.layout_mask;
    const numbers = ticketData?.numbers;

    // Ensure the ticket data has the expected structure
    if (typeof layoutMask !== 'number' || !Array.isArray(numbers) || numbers.some(n => typeof n !== 'number' && n !== null)) {
      console.error("Invalid 90-ball ticket data format:", ticketData);
      return { numbers: [], rows: [[], [], []], isValid: false };
    }

    // Ensure numbers array isn't empty if layout mask expects numbers
    const expectedNumberCount = layoutMask.toString(2).split('').filter(bit => bit === '1').length;
    if (expectedNumberCount > 0 && numbers.length === 0) {
        console.error("Ticket numbers array is empty but layout mask expects numbers:", ticketData);
        return { numbers: [], rows: [[], [], []], isValid: false };
    }
     // Ensure the number of actual numbers matches the expectation from the mask
    if (numbers.filter(n => n !== null).length !== expectedNumberCount) {
        console.error(`Number count mismatch: Mask expects ${expectedNumberCount}, but received ${numbers.filter(n => n !== null).length} numbers.`, ticketData);
        // Allow processing if length matches total slots (including nulls potentially?) - needs review based on data source
        // For now, let's treat it as invalid if counts don't match exactly for non-null numbers
        // return { numbers: [], rows: [[], [], []], isValid: false };
    }


    const maskBits = layoutMask.toString(2).padStart(27, "0").split("").reverse();
    const rows: (number | null)[][] = Array(3).fill(null).map(() => Array(9).fill(null)); // Pre-fill 3x9 grid with nulls
    let numIndex = 0;
    let placedCount = 0;

    for (let i = 0; i < 27; i++) {
      const row = Math.floor(i / 9);
      const col = i % 9;

      if (maskBits[i] === '1') {
        if (numIndex < numbers.length) {
          rows[row][col] = numbers[numIndex]; // Place number at correct column index
          numIndex++;
          placedCount++;
        } else {
           // This case should ideally be caught by the initial length check
           console.error(`Mask processing error: Not enough numbers in array for mask at index ${i}`, ticketData);
           return { numbers: [], rows: [[], [], []], isValid: false };
        }
      }
      // No 'else' needed as the grid is pre-filled with nulls
    }

    // Final check: Did we place the expected number of items based on the mask?
    if (placedCount !== expectedNumberCount) {
       console.error(`Mask processing error: Placed ${placedCount} numbers, but mask expected ${expectedNumberCount}.`, ticketData);
       return { numbers: [], rows: [[], [], []], isValid: false };
    }

    // Extract only the non-null numbers from the original numbers array for validation consistency
    const actualTicketNumbers = numbers.filter(n => n !== null) as number[];

    return { numbers: actualTicketNumbers, rows, isValid: true };
}


export class NinetyBallRules implements GameRules {
  getGameTypeName(): string {
    return '90-ball';
  }

  // Correctly implement the return type DefaultWinPattern[]
  getDefaultWinPatterns(): DefaultWinPattern[] {
    // No description or validate needed based on corrected type
    return [
      {
        id: "oneLine",
        name: "One Line",
      },
      {
        id: "twoLines",
        name: "Two Lines",
      },
      {
        id: "fullHouse",
        name: "Full House",
      }
    ];
  }

  // Correctly implement getTicketStatus using the interface signature
  getTicketStatus(ticketData: any, calledItems: Array<any>, activePatternId: string): TicketStatus {
    // Assume calledItems for 90-ball are numbers
    const calledNumbers = calledItems.filter(item => typeof item === 'number') as number[];

    // Use the parsing helper
    const { numbers: ticketNumbers, rows, isValid } = parseNinetyBallTicket(ticketData);

    // Handle invalid ticket structure gracefully
    if (!isValid || ticketNumbers.length === 0) {
      return { distance: Infinity, isWinner: false };
    }

    // --- Calculate Line Status ---
    const lineDetails = rows.map(line => {
      // Filter only non-null numbers actually present on the ticket line
      const numsInLine = line.filter(num => num !== null) as number[];
      // Count how many of *those* numbers have been called
      const matchedCount = numsInLine.filter(num => calledNumbers.includes(num)).length;
      const neededCount = numsInLine.length; // Total non-null numbers on this line
      const isComplete = neededCount > 0 && matchedCount === neededCount;
      // Distance is how many more numbers on this line need to be called
      const distance = neededCount - matchedCount;
      return { numsInLine, matchedCount, neededCount, isComplete, distance };
    });

    const completedLines = lineDetails.filter(line => line.isComplete).length;
    // Total matched on the ticket = count how many of the ticket's numbers are in calledNumbers
    const totalMatchedOnTicket = ticketNumbers.filter(num => calledNumbers.includes(num)).length;
    const totalNumbersOnTicket = ticketNumbers.length; // Should be 15 for a standard 90-ball ticket

    // --- Determine Status Based on Active Pattern ---
    switch (activePatternId) {
      case "oneLine": {
        // If 1 or more lines are complete, it's a winner
        if (completedLines >= 1) return { distance: 0, isWinner: true };
        // Otherwise, find the minimum distance among all lines
        const minDistance = Math.min(...lineDetails.map(line => line.distance));
        // Return Infinity if something went wrong (e.g., no lines)
        return { distance: (minDistance === Infinity ? Infinity : minDistance), isWinner: false };
      }
      case "twoLines": {
        // If 2 or more lines are complete, it's a winner
        if (completedLines >= 2) return { distance: 0, isWinner: true };
        // If 1 line is complete, distance is the minimum distance of the remaining lines
        if (completedLines === 1) {
           const minDistanceRemaining = Math.min(...lineDetails.filter(line => !line.isComplete).map(line => line.distance));
           return { distance: (minDistanceRemaining === Infinity ? Infinity : minDistanceRemaining), isWinner: false };
        }
        // If 0 lines are complete, distance is sum of the two smallest distances
        const sortedDistances = lineDetails.map(line => line.distance).sort((a, b) => a - b);
        // Handle cases with fewer than 2 lines, though unlikely for 90-ball
        const distance = (sortedDistances[0] ?? Infinity) + (sortedDistances[1] ?? Infinity);
        return { distance: (distance === Infinity ? Infinity : distance), isWinner: false };
      }
      case "fullHouse": {
        // Distance is total numbers needed minus total matched
        const distance = totalNumbersOnTicket - totalMatchedOnTicket;
        return { distance: distance, isWinner: distance === 0 };
      }
      default:
        console.warn(`Unknown pattern ID "${activePatternId}" for 90-ball calculation.`);
        return { distance: Infinity, isWinner: false }; // Unknown pattern
    }
  }
}
