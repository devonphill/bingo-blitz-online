import { toast } from 'sonner';

/**
 * Cache tickets in session storage
 */
export function cacheTickets(playerCode: string, sessionId: string, tickets: any[]) {
  try {
    const key = `tickets_${playerCode}_${sessionId}`;
    sessionStorage.setItem(key, JSON.stringify(tickets));
  } catch (err) {
    console.error('Error caching tickets:', err);
  }
}

/**
 * Get cached tickets from session storage
 */
export function getCachedTickets(playerCode: string, sessionId: string): any[] | null {
  try {
    const key = `tickets_${playerCode}_${sessionId}`;
    const cached = sessionStorage.getItem(key);
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    console.error('Error getting cached tickets:', err);
    return null;
  }
}

/**
 * Process a bingo ticket layout using a mask
 * @param numbers Array of numbers to place in the grid
 * @param layoutMask Mask defining which cells contain numbers (1) vs empty cells (0)
 * @returns A 3x9 grid with numbers positioned according to the mask
 */
export function processTicketLayout(numbers: number[], layoutMask: number): (number | null)[][] {
  // Always create a 3x9 grid initialized with null values
  const grid: (number | null)[][] = [
    Array(9).fill(null),
    Array(9).fill(null),
    Array(9).fill(null)
  ];
  
  console.log(`Processing layout with mask ${layoutMask} and ${numbers?.length || 0} numbers`);
  
  // Check for invalid inputs
  if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
    console.error('Invalid numbers array provided to processTicketLayout:', numbers);
    return grid;
  }
  
  if (layoutMask === undefined || layoutMask === null) {
    console.error('Invalid layout mask provided to processTicketLayout:', layoutMask);
    return grid;
  }
  
  // Convert mask to binary string with leading zeros (27 bits for 3x9 grid)
  // IMPORTANT: Removed .reverse() to ensure consistent processing with useAutoMark.ts
  const maskBinary = layoutMask.toString(2).padStart(27, '0');
  console.log(`Mask binary: ${maskBinary}`);
  
  // Place numbers into the grid according to the mask
  let numberIndex = 0;
  
  // Process each row independently to ensure correct number placement
  for (let row = 0; row < 3; row++) {
    // Get mask bits for this row
    const startBitPosition = row * 9;
    const endBitPosition = startBitPosition + 9;
    const rowMaskBits = maskBinary.substring(startBitPosition, endBitPosition);
    
    // Count how many numbers we need in this row
    const numbersInRow = rowMaskBits.split('1').length - 1;
    console.log(`Row ${row} mask: ${rowMaskBits}, needs ${numbersInRow} numbers`);
    
    // Place numbers in the row where mask bit is 1
    for (let col = 0; col < 9; col++) {
      // Check if this position should have a number (1 in the mask)
      const bitPosition = startBitPosition + col;
      const shouldHaveNumber = maskBinary.charAt(bitPosition) === '1';
      
      if (shouldHaveNumber && numberIndex < numbers.length) {
        grid[row][col] = numbers[numberIndex];
        numberIndex++;
      }
    }
  }

  // Log success and counts
  const totalNumbers = grid.flat().filter(Boolean).length;
  console.log(`Successfully processed ${totalNumbers} numbers into grid. Layout mask: ${layoutMask}`);
  console.log(`Distribution of numbers in grid: Row1=${grid[0].filter(n => n !== null).length}, Row2=${grid[1].filter(n => n !== null).length}, Row3=${grid[2].filter(n => n !== null).length}`);
  
  return grid;
}

/**
 * Calculate progress of a ticket toward winning
 */
export function calculateTicketProgress(
  grid: (number | null)[][],
  calledNumbers: number[],
  winPattern: string
): { isWinner: boolean; numbersToGo: number; completedLines: number; linesToGo: number } {
  // Default result
  const result = { 
    isWinner: false, 
    numbersToGo: 0, 
    completedLines: 0, 
    linesToGo: 0 
  };
  
  if (!grid || !calledNumbers || !winPattern) {
    console.warn('Missing input to calculateTicketProgress', { grid, calledNumbers, winPattern });
    return result;
  }
  
  // Count marked numbers in each row
  const rowCounts: number[] = [0, 0, 0];
  let totalNumbersInGrid = 0;
  let totalMarkedNumbers = 0;
  
  // Calculate marked numbers per row
  grid.forEach((row, rowIndex) => {
    row.forEach(number => {
      if (number !== null) {
        totalNumbersInGrid++;
        if (calledNumbers.includes(number)) {
          totalMarkedNumbers++;
          rowCounts[rowIndex]++;
        }
      }
    });
  });
  
  // Count numbers in each row
  const numbersInRow: number[] = grid.map(row => row.filter(cell => cell !== null).length);
  
  // Calculate patterns based on win pattern type
  switch (winPattern.replace('MAINSTAGE_', '')) {
    case 'oneLine': {
      // Check if any row is complete
      const completedLines = rowCounts.filter((marked, index) => marked === numbersInRow[index] && marked > 0).length;
      const isWinner = completedLines >= 1;
      
      // Find row closest to completion
      let minNumbersToGo = Infinity;
      for (let i = 0; i < 3; i++) {
        if (numbersInRow[i] > 0) {
          const remaining = numbersInRow[i] - rowCounts[i];
          if (remaining < minNumbersToGo) {
            minNumbersToGo = remaining;
          }
        }
      }
      
      return { 
        isWinner,
        numbersToGo: isWinner ? 0 : minNumbersToGo,
        completedLines,
        linesToGo: isWinner ? 0 : 1 - completedLines
      };
    }
    
    case 'twoLines': {
      // Check if at least two rows are complete
      const completedLines = rowCounts.filter((marked, index) => marked === numbersInRow[index] && marked > 0).length;
      const isWinner = completedLines >= 2;
      
      return {
        isWinner,
        numbersToGo: isWinner ? 0 : (numbersInRow[0] + numbersInRow[1] + numbersInRow[2]) - (rowCounts[0] + rowCounts[1] + rowCounts[2]),
        completedLines,
        linesToGo: isWinner ? 0 : 2 - completedLines
      };
    }
    
    case 'fullHouse':
    case 'blackout': {
      // Check if all numbers are marked
      const isWinner = totalMarkedNumbers === totalNumbersInGrid;
      
      return {
        isWinner,
        numbersToGo: totalNumbersInGrid - totalMarkedNumbers,
        completedLines: rowCounts.filter((marked, index) => marked === numbersInRow[index] && marked > 0).length,
        linesToGo: 3 - rowCounts.filter((marked, index) => marked === numbersInRow[index] && marked > 0).length
      };
    }
    
    default:
      console.warn('Unknown win pattern:', winPattern);
      return result;
  }
}

/**
 * Get numbers that would complete a line if called
 */
export function getOneToGoNumbers(
  grid: (number | null)[][],
  calledNumbers: number[],
  winPattern: string
): number[] {
  if (!grid || !calledNumbers || !winPattern) {
    return [];
  }

  const oneToGoNumbers: number[] = [];
  
  // Get winPattern without "MAINSTAGE_" prefix if present
  const pattern = winPattern.replace('MAINSTAGE_', '');
  
  // For oneLine, check each row to see if it's one number away from completion
  if (pattern === 'oneLine') {
    grid.forEach(row => {
      const numbersInRow = row.filter(n => n !== null);
      const markedInRow = numbersInRow.filter(n => calledNumbers.includes(n!));
      
      // If this row is one number away from completion
      if (markedInRow.length === numbersInRow.length - 1 && numbersInRow.length > 0) {
        // Find the unmarked number
        const unmarked = numbersInRow.find(n => n !== null && !calledNumbers.includes(n));
        if (unmarked) {
          oneToGoNumbers.push(unmarked);
        }
      }
    });
  } 
  // For twoLines, if we already have one complete line, check remaining lines
  else if (pattern === 'twoLines') {
    const completedLines = grid.filter(row => {
      const numbersInRow = row.filter(n => n !== null);
      const markedInRow = numbersInRow.filter(n => calledNumbers.includes(n!));
      return numbersInRow.length > 0 && markedInRow.length === numbersInRow.length;
    }).length;
    
    // If we already have one line complete, check for one-away in other lines
    if (completedLines === 1) {
      grid.forEach(row => {
        const numbersInRow = row.filter(n => n !== null);
        const markedInRow = numbersInRow.filter(n => calledNumbers.includes(n!));
        
        // If not complete but one away
        if (markedInRow.length === numbersInRow.length - 1 && markedInRow.length < numbersInRow.length) {
          // Find the unmarked number
          const unmarked = numbersInRow.find(n => n !== null && !calledNumbers.includes(n));
          if (unmarked) {
            oneToGoNumbers.push(unmarked);
          }
        }
      });
    }
  }
  // For fullHouse, check if we're one number away from all numbers marked
  else if (pattern === 'fullHouse' || pattern === 'blackout') {
    const allNumbers = grid.flat().filter(n => n !== null) as number[];
    const unmarkedNumbers = allNumbers.filter(n => !calledNumbers.includes(n));
    
    // If there's exactly one number left to be called
    if (unmarkedNumbers.length === 1) {
      oneToGoNumbers.push(unmarkedNumbers[0]);
    }
  }
  
  return oneToGoNumbers;
}

/**
 * Calculate a score for a ticket based on how close it is to winning
 * Negative scores indicate missed claims (should have claimed earlier)
 */
export function calculateTicketScore(
  grid: (number | null)[][],
  calledNumbers: number[],
  winPattern: string,
  lastCalledNumber: number | null = null
): number {
  const progress = calculateTicketProgress(grid, calledNumbers, winPattern);
  
  // If this is a winner, check if it's a "missed claim"
  if (progress.isWinner) {
    // Find the number that completed the winning pattern
    let completingNumberIndex = -1;
    
    // For a winning ticket, simulate removing the last few numbers to find when it became a winner
    for (let i = calledNumbers.length - 1; i >= 0; i--) {
      const testNumbers = calledNumbers.slice(0, i);
      const testProgress = calculateTicketProgress(grid, testNumbers, winPattern);
      
      if (!testProgress.isWinner) {
        // We found the number that completed the winning pattern
        completingNumberIndex = i;
        break;
      }
    }
    
    // If the completing number is not the last called number, this is a missed claim
    if (completingNumberIndex >= 0 && completingNumberIndex < calledNumbers.length - 1) {
      // Calculate how many calls were missed (negative score)
      return -(calledNumbers.length - completingNumberIndex - 1);
    }
    
    return 0; // Perfect timing on the claim
  }
  
  // Not a winner, return positive to-go count (lower is better)
  return progress.numbersToGo;
}

/**
 * Sort tickets by win proximity, handling both positive and negative scores
 */
export function sortTicketsByWinProximity(
  tickets: any[],
  calledNumbers: number[],
  currentWinPattern: string | null
): any[] {
  if (!tickets || tickets.length === 0 || !currentWinPattern) {
    return tickets;
  }
  
  return [...tickets].sort((a, b) => {
    // Process ticket A
    const gridA = processTicketLayout(a.numbers, a.layoutMask || a.layout_mask);
    const scoreA = calculateTicketScore(gridA, calledNumbers, currentWinPattern, a.lastCalledNumber);
    
    // Process ticket B
    const gridB = processTicketLayout(b.numbers, b.layoutMask || b.layout_mask);
    const scoreB = calculateTicketScore(gridB, calledNumbers, currentWinPattern, b.lastCalledNumber);
    
    // Prioritize tickets with score 0 (perfect claim time)
    if (scoreA === 0 && scoreB !== 0) return -1;
    if (scoreB === 0 && scoreA !== 0) return 1;
    
    // Then prioritize positive scores (closer to winning) over negative scores (missed claims)
    if (scoreA >= 0 && scoreB < 0) return -1;
    if (scoreB >= 0 && scoreA < 0) return 1;
    
    // For two positive scores, smaller is better (closer to winning)
    if (scoreA >= 0 && scoreB >= 0) return scoreA - scoreB;
    
    // For two negative scores, larger (less negative) is better (missed by less)
    return scoreB - scoreA;
  });
}
