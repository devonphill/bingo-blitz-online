
import { logWithTimestamp } from '@/utils/logUtils';

interface StoredNumbersData {
  calledNumbers: number[];
  lastCalledNumber: number | null;
  timestamp: number;
}

/**
 * Load called numbers from local storage
 */
export function loadStoredNumbers(sessionId: string): StoredNumbersData | null {
  try {
    const storedData = localStorage.getItem(`called_numbers_${sessionId}`);
    if (!storedData) return null;
    
    const parsedData = JSON.parse(storedData) as StoredNumbersData;
    logWithTimestamp(`Loaded ${parsedData.calledNumbers.length} called numbers from storage for session ${sessionId}`, 'info');
    return parsedData;
  } catch (error) {
    logWithTimestamp(`Error loading called numbers from storage: ${error}`, 'error');
    return null;
  }
}

/**
 * Save called numbers to local storage
 */
export function saveNumbersToStorage(
  sessionId: string,
  calledNumbers: number[],
  lastCalledNumber: number | null,
  timestamp: number
): void {
  try {
    const data: StoredNumbersData = {
      calledNumbers,
      lastCalledNumber,
      timestamp
    };
    
    localStorage.setItem(`called_numbers_${sessionId}`, JSON.stringify(data));
    logWithTimestamp(`Saved ${calledNumbers.length} called numbers to storage for session ${sessionId}`, 'info');
  } catch (error) {
    logWithTimestamp(`Error saving called numbers to storage: ${error}`, 'error');
  }
}
