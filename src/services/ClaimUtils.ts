
import { ClaimData } from '@/types/claim';
import { logWithTimestamp } from '@/utils/logUtils';
import { normalizeWinPattern } from '@/utils/winPatternUtils';
import { checkMainstageWinPattern } from '@/utils/mainstageWinLogic';

/**
 * Generate a unique ID for a claim
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0,
        v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Validate if claim data contains the minimal required fields
 */
export function validateClaimData(claimData: any): boolean {
  if (!claimData) {
    logWithTimestamp('ClaimUtils: Claim data is null or undefined', 'error');
    return false;
  }
  
  if (!claimData.sessionId) {
    logWithTimestamp('ClaimUtils: Missing sessionId in claim data', 'error');
    return false;
  }
  
  if (!claimData.playerId) {
    logWithTimestamp('ClaimUtils: Missing playerId in claim data', 'error');
    return false;
  }
  
  // Optional but helpful validation
  if (!claimData.ticket) {
    logWithTimestamp('ClaimUtils: Warning - Claim data has no ticket information', 'warn');
    // Don't fail validation for this, but log a warning
  }
  
  return true;
}

/**
 * Calculate if a ticket has won based on called numbers and win pattern
 */
export function calculateTicketWinStatus(
  ticket: any, 
  calledNumbers: number[], 
  winPattern: string = 'oneLine'
): {
  isWinner: boolean;
  toGoCount: number;
  hasLastCalledNumber?: boolean;
} {
  // Ensure we have valid ticket data
  if (!ticket || !ticket.numbers || !ticket.layoutMask && !ticket.layout_mask) {
    logWithTimestamp('Invalid ticket data for win calculation', 'error');
    return { isWinner: false, toGoCount: 0, hasLastCalledNumber: false };
  }

  // Normalize win pattern to ensure consistent format
  const normalizedWinPattern = normalizeWinPattern(winPattern, 'MAINSTAGE');
  
  // Create a grid representation for win checking
  const layoutMask = ticket.layoutMask || ticket.layout_mask || 0;
  const numbers = ticket.numbers || [];
  const maskBits = layoutMask.toString(2).padStart(27, "0").split("").reverse();
  const grid: (number | null)[][] = [[], [], []];
  let numIndex = 0;
  
  for (let i = 0; i < 27; i++) {
    const row = Math.floor(i / 9);
    if (maskBits[i] === '1') {
      if (numIndex < numbers.length) {
        grid[row].push(numbers[numIndex]);
        numIndex++;
      } else {
        grid[row].push(null); // Safety check in case of data mismatch
      }
    } else {
      grid[row].push(null);
    }
  }
  
  // Check if it's a winning ticket using our shared win pattern checker
  const result = checkMainstageWinPattern(
    grid, 
    calledNumbers,
    normalizedWinPattern as any
  );
  
  // Check if the last called number contributed to the win
  const lastCalledNumber = calledNumbers.length > 0 ? calledNumbers[calledNumbers.length - 1] : null;
  const hasLastCalledNumber = lastCalledNumber !== null && numbers.includes(lastCalledNumber);
  
  return { 
    isWinner: result.isWinner,
    toGoCount: result.tg,
    hasLastCalledNumber
  };
}

/**
 * Create a proper ClaimData object from partial data
 */
export function createClaimData(partialData: Partial<ClaimData>): ClaimData {
  const claimId = partialData.id || generateUUID();
  const timestamp = partialData.timestamp || new Date().toISOString();
  
  const claim: ClaimData = {
    id: claimId,
    timestamp,
    sessionId: partialData.sessionId || '',
    playerId: partialData.playerId || '',
    playerName: partialData.playerName,
    gameType: partialData.gameType || 'mainstage',
    winPattern: partialData.winPattern || 'oneLine',
    gameNumber: partialData.gameNumber || 1,
    toGoCount: partialData.toGoCount || 0,
    ticket: partialData.ticket,
    status: partialData.status || 'pending',
    lastCalledNumber: partialData.lastCalledNumber || null,
    calledNumbers: partialData.calledNumbers || [],
    hasLastCalledNumber: partialData.hasLastCalledNumber || false
  };
  
  return claim;
}

/**
 * Check if the pattern is the final pattern in a game
 */
export function isFinalPattern(
  currentPattern: string | null,
  activePatterns: string[]
): boolean {
  if (!currentPattern || activePatterns.length === 0) {
    return false;
  }

  // Normalize pattern by removing MAINSTAGE_ prefix if present
  const normalizedCurrentPattern = currentPattern.replace(/^MAINSTAGE_/, '');
  const normalizedPatterns = activePatterns.map(p => p.replace(/^MAINSTAGE_/, ''));
  
  const currentIndex = normalizedPatterns.indexOf(normalizedCurrentPattern);
  // If it's the last pattern in the array, it's the final pattern
  return currentIndex === normalizedPatterns.length - 1;
}

/**
 * Check if we're at the final game and pattern
 */
export function isGameSequenceComplete(
  currentGame: number, 
  totalGames: number, 
  currentPattern: string | null,
  activePatterns: string[]
): boolean {
  const isLastGame = currentGame >= totalGames;
  const isFinalPatternInGame = isFinalPattern(currentPattern, activePatterns);
  
  logWithTimestamp(`Game sequence check: isLastGame=${isLastGame}, isFinalPattern=${isFinalPatternInGame}`, 'info');
  
  return isLastGame && isFinalPatternInGame;
}
