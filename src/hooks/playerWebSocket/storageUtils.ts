
import { logWithTimestamp } from '@/utils/logUtils';
import { StoredNumberData } from './types';

/**
 * Load stored called numbers from localStorage
 */
export function loadStoredNumbers(sessionId: string): StoredNumberData | null {
  try {
    const key = `bingo_numbers_${sessionId}`;
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    
    const data = JSON.parse(stored) as StoredNumberData;
    logWithTimestamp(`Loaded ${data.calledNumbers.length} numbers from storage for session ${sessionId}`, 'info');
    return data;
  } catch (error) {
    logWithTimestamp(`Error loading numbers from storage: ${error}`, 'error');
    return null;
  }
}

/**
 * Save called numbers to localStorage
 */
export function saveNumbersToStorage(
  sessionId: string, 
  calledNumbers: number[], 
  lastCalledNumber: number | null,
  timestamp: number
): void {
  try {
    const key = `bingo_numbers_${sessionId}`;
    const data: StoredNumberData = {
      calledNumbers,
      lastCalledNumber,
      timestamp
    };
    
    localStorage.setItem(key, JSON.stringify(data));
    logWithTimestamp(`Saved ${calledNumbers.length} numbers to storage for session ${sessionId}`, 'debug');
  } catch (error) {
    logWithTimestamp(`Error saving numbers to storage: ${error}`, 'error');
  }
}

/**
 * Clear stored numbers
 */
export function clearStoredNumbers(sessionId: string): void {
  try {
    const key = `bingo_numbers_${sessionId}`;
    localStorage.removeItem(key);
    logWithTimestamp(`Cleared stored numbers for session ${sessionId}`, 'info');
  } catch (error) {
    logWithTimestamp(`Error clearing stored numbers: ${error}`, 'error');
  }
}
