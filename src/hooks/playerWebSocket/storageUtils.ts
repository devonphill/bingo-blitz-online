
import { logWithTimestamp } from '@/utils/logUtils';
import { StoredNumberData } from './types';

/**
 * Save called numbers to localStorage as a backup
 */
export function saveNumbersToLocalStorage(
  sessionId: string | null | undefined, 
  calledNumbers: number[], 
  lastCalledNumber: number | null
): void {
  if (!sessionId) return;
  
  try {
    const data: StoredNumberData = {
      calledNumbers,
      lastCalledNumber,
      timestamp: Date.now()
    };
    
    localStorage.setItem(`bingo_numbers_${sessionId}`, JSON.stringify(data));
    logWithTimestamp(`Saved ${calledNumbers.length} numbers to localStorage for session ${sessionId}`, 'debug');
  } catch (error) {
    logWithTimestamp(`Error saving numbers to localStorage: ${error}`, 'error');
  }
}

/**
 * Get called numbers from localStorage
 */
export function getNumbersFromLocalStorage(
  sessionId: string | null | undefined
): StoredNumberData | null {
  if (!sessionId) return null;
  
  try {
    const dataString = localStorage.getItem(`bingo_numbers_${sessionId}`);
    
    if (!dataString) return null;
    
    const data = JSON.parse(dataString) as StoredNumberData;
    
    logWithTimestamp(`Retrieved ${data.calledNumbers?.length || 0} numbers from localStorage for session ${sessionId}`, 'debug');
    
    return data;
  } catch (error) {
    logWithTimestamp(`Error retrieving numbers from localStorage: ${error}`, 'error');
    return null;
  }
}

/**
 * Clear called numbers from localStorage
 */
export function clearNumbersFromLocalStorage(
  sessionId: string | null | undefined
): void {
  if (!sessionId) return;
  
  try {
    localStorage.removeItem(`bingo_numbers_${sessionId}`);
    logWithTimestamp(`Cleared numbers from localStorage for session ${sessionId}`, 'debug');
  } catch (error) {
    logWithTimestamp(`Error clearing numbers from localStorage: ${error}`, 'error');
  }
}
