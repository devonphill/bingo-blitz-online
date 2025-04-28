
import { Ticket } from "@/types";

/**
 * Process a ticket's layout mask to create a proper 3x9 grid
 * with 5 numbers per row as per 90-ball bingo rules.
 */
export function processTicketLayout(numbers: number[], layoutMask?: number): (number | null)[][] {
  // Default empty grid
  const grid: (number | null)[][] = [[], [], []];
  
  if (!numbers || numbers.length === 0) {
    console.error("No numbers provided for ticket");
    // Return empty rows
    return [Array(9).fill(null), Array(9).fill(null), Array(9).fill(null)];
  }
  
  if (!layoutMask) {
    console.error("No layout mask provided for ticket");
    // Fallback to simple grid generation
    return createFallbackGrid(numbers);
  }
  
  try {
    // Convert layoutMask to binary and pad to 27 bits (3 rows x 9 columns)
    const maskBinary = layoutMask.toString(2).padStart(27, "0").split("").reverse();
    let numIdx = 0;
    
    // Process each bit in the layout mask
    for (let i = 0; i < 27; i++) {
      const rowIdx = Math.floor(i / 9);
      const colIdx = i % 9;
      
      // If the bit is 1, place a number from the numbers array
      if (maskBinary[i] === "1") {
        if (numIdx < numbers.length) {
          grid[rowIdx][colIdx] = numbers[numIdx++];
        } else {
          console.warn(`Not enough numbers for layout mask at position ${i}`);
          grid[rowIdx][colIdx] = null;
        }
      } else {
        // If the bit is 0, place null (empty cell)
        grid[rowIdx][colIdx] = null;
      }
    }
    
    // Validate for 90-ball bingo (5 numbers per row)
    for (let row = 0; row < 3; row++) {
      const nonNullCount = grid[row].filter(cell => cell !== null).length;
      if (nonNullCount !== 5) {
        console.warn(`Row ${row} has ${nonNullCount} numbers instead of expected 5. Layout mask may be incorrect.`);
      }
    }
    
    return grid;
  } catch (error) {
    console.error("Error processing ticket layout mask:", error);
    return createFallbackGrid(numbers);
  }
}

/**
 * Create a fallback grid when layout mask is invalid or missing
 */
function createFallbackGrid(numbers: number[]): (number | null)[][] {
  const grid: (number | null)[][] = [
    Array(9).fill(null),
    Array(9).fill(null),
    Array(9).fill(null)
  ];
  
  let numIdx = 0;
  for (let row = 0; row < 3 && numIdx < numbers.length; row++) {
    // Ensure exactly 5 numbers per row
    const placedInRow = 0;
    for (let col = 0; col < 9 && placedInRow < 5 && numIdx < numbers.length; col++) {
      // Try to place numbers in correct columns based on value
      const num = numbers[numIdx];
      const expectedCol = num <= 9 ? 0 : Math.floor((num - 1) / 10);
      if (col === expectedCol) {
        grid[row][col] = num;
        numIdx++;
      }
    }
  }
  
  return grid;
}

/**
 * Calculate how many more numbers are needed for a win pattern
 */
export function calculateTicketProgress(
  grid: (number | null)[][],
  calledNumbers: number[],
  winPattern: string
): { 
  isWinner: boolean;
  numbersToGo: number;
  completedLines: number;
  linesToGo: number;
} {
  // Default response
  const result = {
    isWinner: false,
    numbersToGo: Infinity,
    completedLines: 0,
    linesToGo: 0
  };
  
  if (!grid || grid.length === 0) return result;
  
  // Calculate completed lines
  const completedLineCount = grid.filter(row => {
    const rowNumbers = row.filter(num => num !== null) as number[];
    return rowNumbers.every(num => calledNumbers.includes(num));
  }).length;
  
  result.completedLines = completedLineCount;
  
  // Determine lines needed based on win pattern
  let linesNeeded = 0;
  if (winPattern === "oneLine") linesNeeded = 1;
  else if (winPattern === "twoLines") linesNeeded = 2;
  else if (winPattern === "fullHouse") linesNeeded = 3;
  
  result.linesToGo = Math.max(0, linesNeeded - completedLineCount);
  
  // Check if this is a winning ticket for the current pattern
  result.isWinner = completedLineCount >= linesNeeded;
  
  // Calculate how many more numbers are needed for the win
  if (result.isWinner) {
    result.numbersToGo = 0;
  } else {
    const lineNeededCounts: number[] = [];
    
    grid.forEach(row => {
      // Skip completed lines
      const rowNumbers = row.filter(num => num !== null) as number[];
      const markedCount = rowNumbers.filter(num => calledNumbers.includes(num)).length;
      
      if (markedCount < rowNumbers.length) {
        // This row needs more numbers
        lineNeededCounts.push(rowNumbers.length - markedCount);
      }
    });
    
    // Sort lines by how many numbers they need
    lineNeededCounts.sort((a, b) => a - b);
    
    // How many more lines needed?
    const moreLines = linesNeeded - completedLineCount;
    
    if (moreLines <= 0 || lineNeededCounts.length === 0) {
      result.numbersToGo = 0;
    } else {
      // Get the N easiest lines to complete
      const relevantLines = lineNeededCounts.slice(0, moreLines);
      result.numbersToGo = relevantLines.reduce((sum, count) => sum + count, 0);
    }
  }
  
  return result;
}

/**
 * Get the one-to-go numbers for a ticket based on current win pattern
 */
export function getOneToGoNumbers(
  grid: (number | null)[][],
  calledNumbers: number[],
  winPattern: string
): number[] {
  const oneTGs: number[] = [];
  
  // Determine how many lines are needed for this pattern
  let linesNeeded = 0;
  if (winPattern === "oneLine") linesNeeded = 1;
  else if (winPattern === "twoLines") linesNeeded = 2;
  else if (winPattern === "fullHouse") linesNeeded = 3;
  
  // Count completed lines
  const completedLines = grid.filter(row => {
    const rowNumbers = row.filter(num => num !== null) as number[];
    return rowNumbers.every(num => calledNumbers.includes(num));
  }).length;
  
  if (completedLines >= linesNeeded) {
    // Already a winner, no 1TG numbers
    return [];
  }
  
  // For each uncompleted line, check if it's one away
  grid.forEach(row => {
    const rowNumbers = row.filter(num => num !== null) as number[];
    const unmarkedNumbers = rowNumbers.filter(num => !calledNumbers.includes(num));
    
    // If this row is one number away from completion
    if (unmarkedNumbers.length === 1) {
      oneTGs.push(unmarkedNumbers[0]);
    }
  });
  
  return oneTGs;
}

/**
 * Cache the ticket data in session storage
 */
export function cacheTickets(playerCode: string, sessionId: string, tickets: Ticket[]): void {
  if (!tickets || tickets.length === 0) return;
  
  try {
    const cacheKey = `bingo_tickets_${playerCode}_${sessionId}`;
    window.sessionStorage.setItem(cacheKey, JSON.stringify(tickets));
    console.log(`Cached ${tickets.length} tickets for player ${playerCode}`);
  } catch (error) {
    console.error("Error caching tickets in session storage:", error);
  }
}

/**
 * Retrieve cached ticket data from session storage
 */
export function getCachedTickets(playerCode: string, sessionId: string): Ticket[] | null {
  try {
    const cacheKey = `bingo_tickets_${playerCode}_${sessionId}`;
    const cachedData = window.sessionStorage.getItem(cacheKey);
    
    if (!cachedData) return null;
    
    const tickets = JSON.parse(cachedData) as Ticket[];
    console.log(`Retrieved ${tickets.length} cached tickets for player ${playerCode}`);
    return tickets;
  } catch (error) {
    console.error("Error retrieving cached tickets from session storage:", error);
    return null;
  }
}
