
/**
 * Process a ticket layout based on the numbers array and layout mask
 * @param numbers Array of ticket numbers
 * @param layoutMask Bitmask indicating cell positioning
 * @returns 2D array representing the ticket grid with null for empty cells
 */
export function processTicketLayout(
  numbers: number[],
  layoutMask?: number
): (number | null)[][] {
  // Check for valid inputs
  if (!numbers || !Array.isArray(numbers)) {
    console.error("Invalid numbers array provided to processTicketLayout:", numbers);
    return Array(3).fill(null).map(() => Array(9).fill(null));
  }

  // Default to standard 90-ball bingo layout (3 rows x 9 columns) if no mask provided
  if (layoutMask === undefined || layoutMask === null) {
    console.warn("No layout mask provided, using default 90-ball layout");
    // Create a default grid with 3 rows, 9 columns, all null
    const defaultGrid = Array(3).fill(null).map(() => Array(9).fill(null));
    
    // Place numbers in the grid (standard 90-ball bingo has 5 numbers per row)
    let numbersIndex = 0;
    for (let row = 0; row < 3; row++) {
      // For each row, place 5 numbers in random positions
      const positions = Array(9).fill(0).map((_, i) => i)
        .sort(() => Math.random() - 0.5)
        .slice(0, 5);
      
      for (const col of positions) {
        if (numbersIndex < numbers.length) {
          defaultGrid[row][col] = numbers[numbersIndex++];
        }
      }
    }
    
    return defaultGrid;
  }

  // Create the initial grid (3 rows x 9 columns)
  const grid: (number | null)[][] = Array(3).fill(null).map(() => Array(9).fill(null));
  
  // The layout mask is a binary representation where 1s indicate a cell that should contain a number
  // Convert the mask to a binary string, pad with leading zeros if needed
  const maskBinary = layoutMask.toString(2).padStart(27, '0');
  
  console.log(`Processing layout mask ${layoutMask} -> binary ${maskBinary}`);
  
  // Extract digits from the binary string, reverse to match the standard reading order
  const bits = maskBinary.split('').reverse();
  
  // Populate the grid using the mask
  let numbersIndex = 0;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 9; col++) {
      const bitIndex = row * 9 + col;
      
      if (bits[bitIndex] === '1' && numbersIndex < numbers.length) {
        grid[row][col] = numbers[numbersIndex++];
      } else {
        grid[row][col] = null;
      }
    }
  }
  
  // Debug log: count how many numbers were placed on the grid
  const numbersPlaced = grid.flat().filter(cell => cell !== null).length;
  console.log(`Layout mask placed ${numbersPlaced}/${numbers.length} numbers on the grid`);
  
  return grid;
}

/**
 * Cache tickets for a player and session in session storage
 */
export function cacheTickets(playerCode: string, sessionId: string, tickets: any[]): void {
  try {
    const cacheKey = `tickets_${playerCode}_${sessionId}`;
    sessionStorage.setItem(cacheKey, JSON.stringify(tickets));
    console.log(`Cached ${tickets.length} tickets for player ${playerCode} in session ${sessionId}`);
  } catch (err) {
    console.error('Error caching tickets:', err);
    // Fallback: try to store without stringifying first (for older browsers)
    try {
      const cacheKey = `tickets_${playerCode}_${sessionId}`;
      sessionStorage.setItem(cacheKey, JSON.stringify({
        tickets: tickets.map(t => ({ 
          id: t.id,
          playerId: t.playerId,
          sessionId: t.sessionId,
          numbers: t.numbers,
          serial: t.serial,
          position: t.position,
          layoutMask: t.layoutMask || t.layout_mask,
          perm: t.perm
        }))
      }));
    } catch (e) {
      console.error('Failed to cache tickets even with fallback:', e);
    }
  }
}

/**
 * Retrieve cached tickets for a player and session from session storage
 */
export function getCachedTickets(playerCode: string, sessionId: string): any[] | null {
  try {
    const cacheKey = `tickets_${playerCode}_${sessionId}`;
    const cachedData = sessionStorage.getItem(cacheKey);
    
    if (!cachedData) return null;
    
    // Try to parse the cached data
    const tickets = JSON.parse(cachedData);
    
    // Check if the result is an array of tickets or nested within a 'tickets' property
    if (Array.isArray(tickets)) {
      return tickets;
    } else if (tickets && Array.isArray(tickets.tickets)) {
      return tickets.tickets;
    }
    
    return null;
  } catch (err) {
    console.error('Error retrieving cached tickets:', err);
    return null;
  }
}

/**
 * Calculate ticket progress based on called numbers and win pattern
 */
export function calculateTicketProgress(
  grid: (number | null)[][],
  calledNumbers: number[],
  winPattern: string
): {
  numbersToGo: number;
  isWinner: boolean;
  completedLines: number;
  linesToGo: number;
} {
  // Default progress object
  const progress = {
    numbersToGo: Infinity,
    isWinner: false,
    completedLines: 0,
    linesToGo: 1, // Default to one line for basic patterns
  };
  
  // No grid or no called numbers
  if (!grid || !grid.length || !calledNumbers || !calledNumbers.length) {
    return progress;
  }

  // Count marked numbers in each row
  const rowCounts = grid.map(row => {
    const rowNumbers = row.filter(num => num !== null) as number[];
    const markedCount = rowNumbers.filter(num => calledNumbers.includes(num)).length;
    const totalCount = rowNumbers.length;
    return { markedCount, totalCount, remaining: totalCount - markedCount };
  });
  
  // Calculate completed lines and numbers to go based on win pattern
  switch (winPattern) {
    case 'oneLine':
      // For one line, find the row closest to completion
      progress.completedLines = rowCounts.filter(r => r.remaining === 0).length;
      progress.linesToGo = Math.max(1 - progress.completedLines, 0);
      progress.numbersToGo = rowCounts.length > 0 ? 
        Math.min(...rowCounts.map(r => r.remaining)) : 
        Infinity;
      progress.isWinner = progress.completedLines >= 1;
      break;
      
    case 'twoLines':
      // For two lines, count completed rows
      progress.completedLines = rowCounts.filter(r => r.remaining === 0).length;
      progress.linesToGo = Math.max(2 - progress.completedLines, 0);
      
      // Sort rows by remaining numbers and calculate how many more to go
      const sortedRows = [...rowCounts].sort((a, b) => a.remaining - b.remaining);
      if (progress.completedLines >= 2) {
        progress.numbersToGo = 0;
      } else if (progress.completedLines === 1 && sortedRows.length > 1) {
        progress.numbersToGo = sortedRows[0].remaining;
      } else if (sortedRows.length >= 2) {
        progress.numbersToGo = sortedRows[0].remaining + sortedRows[1].remaining;
      }
      
      progress.isWinner = progress.completedLines >= 2;
      break;
      
    case 'fullHouse':
      // For full house, all numbers need to be called
      const allTicketNumbers = grid.flat().filter(n => n !== null) as number[];
      const unmarkedCount = allTicketNumbers.filter(n => !calledNumbers.includes(n)).length;
      progress.numbersToGo = unmarkedCount;
      progress.completedLines = rowCounts.filter(r => r.remaining === 0).length;
      progress.linesToGo = grid.length - progress.completedLines;
      progress.isWinner = unmarkedCount === 0;
      break;
      
    default:
      // Default to one line behavior
      progress.completedLines = rowCounts.filter(r => r.remaining === 0).length;
      progress.linesToGo = 1 - progress.completedLines;
      progress.numbersToGo = rowCounts.length > 0 ? 
        Math.min(...rowCounts.map(r => r.remaining)) : 
        Infinity;
      progress.isWinner = progress.completedLines >= 1;
      break;
  }
  
  return progress;
}

/**
 * Get numbers that are one away from completing a winning pattern
 * @param grid The ticket grid
 * @param calledNumbers Array of called numbers
 * @param winPattern The current win pattern
 * @returns Array of numbers that would complete a win if called
 */
export function getOneToGoNumbers(
  grid: (number | null)[][],
  calledNumbers: number[],
  winPattern: string
): number[] {
  const oneToGoNumbers: number[] = [];
  
  switch (winPattern) {
    case 'oneLine':
      // For one line, check each row
      grid.forEach(row => {
        const rowNumbers = row.filter(cell => cell !== null) as number[];
        const unmarkedNumbers = rowNumbers.filter(num => !calledNumbers.includes(num));
        
        // If only one number is needed to complete this row, add it to one-to-go
        if (unmarkedNumbers.length === 1) {
          oneToGoNumbers.push(unmarkedNumbers[0]);
        }
      });
      break;
      
    case 'twoLines':
      // For two lines pattern, check how many complete lines we already have
      const completeLines = grid.filter(row => {
        const rowNumbers = row.filter(cell => cell !== null) as number[];
        return rowNumbers.every(num => calledNumbers.includes(num));
      }).length;
      
      // If we already have one line complete, check others for one-to-go
      if (completeLines === 1) {
        grid.forEach(row => {
          const rowNumbers = row.filter(cell => cell !== null) as number[];
          const unmarkedNumbers = rowNumbers.filter(num => !calledNumbers.includes(num));
          
          // If only one number is needed to complete this row, add it to one-to-go
          if (unmarkedNumbers.length === 1) {
            oneToGoNumbers.push(unmarkedNumbers[0]);
          }
        });
      }
      break;
      
    case 'fullHouse':
      // For full house, check all numbers on the ticket
      const allTicketNumbers = grid.flat().filter(cell => cell !== null) as number[];
      const unmarkedNumbers = allTicketNumbers.filter(num => !calledNumbers.includes(num));
      
      // If only one number is needed to complete the whole ticket
      if (unmarkedNumbers.length === 1) {
        oneToGoNumbers.push(unmarkedNumbers[0]);
      }
      break;
      
    default:
      // Default to checking for one line
      grid.forEach(row => {
        const rowNumbers = row.filter(cell => cell !== null) as number[];
        const unmarkedNumbers = rowNumbers.filter(num => !calledNumbers.includes(num));
        
        // If only one number is needed to complete this row, add it to one-to-go
        if (unmarkedNumbers.length === 1) {
          oneToGoNumbers.push(unmarkedNumbers[0]);
        }
      });
      break;
  }
  
  return oneToGoNumbers;
}
