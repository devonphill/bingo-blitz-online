
import { logWithTimestamp } from '@/utils/logUtils';
import { CalledNumbersState } from './types';

/**
 * Save called numbers to local storage
 */
export const saveNumbersToStorage = (
  sessionId: string, 
  calledNumbers: number[],
  lastCalledNumber: number | null,
  timestamp: number
): void => {
  if (!sessionId) {
    logWithTimestamp('Cannot save numbers: No session ID', 'warn');
    return;
  }
  
  try {
    const storageKey = `bingo_numbers_${sessionId}`;
    const data: CalledNumbersState = {
      calledNumbers,
      lastCalledNumber,
      lastUpdateTime: timestamp,
      timestamp: timestamp // Add the timestamp property
    };
    
    localStorage.setItem(storageKey, JSON.stringify(data));
    logWithTimestamp(`Saved ${calledNumbers.length} numbers to storage for session ${sessionId}`, 'info');
  } catch (error) {
    logWithTimestamp(`Error saving numbers to storage: ${error}`, 'error');
  }
};

/**
 * Load called numbers from local storage
 */
export const loadStoredNumbers = (sessionId: string): CalledNumbersState | null => {
  if (!sessionId) {
    logWithTimestamp('Cannot load numbers: No session ID', 'warn');
    return null;
  }
  
  try {
    const storageKey = `bingo_numbers_${sessionId}`;
    const storedData = localStorage.getItem(storageKey);
    
    if (!storedData) {
      return null;
    }
    
    const data: CalledNumbersState = JSON.parse(storedData);
    logWithTimestamp(`Loaded ${data.calledNumbers.length} numbers from storage for session ${sessionId}`, 'info');
    return data;
  } catch (error) {
    logWithTimestamp(`Error loading numbers from storage: ${error}`, 'error');
    return null;
  }
};

/**
 * Clear called numbers from local storage
 */
export const clearStoredNumbers = (sessionId: string): void => {
  if (!sessionId) return;
  
  try {
    const storageKey = `bingo_numbers_${sessionId}`;
    localStorage.removeItem(storageKey);
    logWithTimestamp(`Cleared stored numbers for session ${sessionId}`, 'info');
  } catch (error) {
    logWithTimestamp(`Error clearing stored numbers: ${error}`, 'error');
  }
};
