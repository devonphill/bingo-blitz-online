
import { logWithTimestamp } from "@/utils/logUtils";
import { StoredNumberData } from "./types";

/**
 * Saves called numbers to local storage for a session
 */
export function saveNumbersToLocalStorage(
  sessionId: string, 
  numbers: number[], 
  lastNumber: number | null,
  broadcastId?: string
): void {
  try {
    const storageKey = `bingo-numbers-session-${sessionId}`;
    localStorage.setItem(storageKey, JSON.stringify({
      sessionId,
      calledNumbers: numbers,
      lastCalledNumber: lastNumber,
      timestamp: new Date().toISOString(),
      broadcastId: broadcastId || `local-${Date.now()}`,
      synced: true
    }));
  } catch (e) {
    // Ignore storage errors
    logWithTimestamp(`Error saving numbers to localStorage: ${e}`, 'error');
  }
}

/**
 * Retrieves called numbers from local storage for a session
 */
export function getNumbersFromLocalStorage(sessionId: string): StoredNumberData | null {
  try {
    const storageKey = `bingo-numbers-session-${sessionId}`;
    const stored = localStorage.getItem(storageKey);
    
    if (!stored) return null;
    
    return JSON.parse(stored) as StoredNumberData;
  } catch (e) {
    logWithTimestamp(`Error retrieving numbers from localStorage: ${e}`, 'error');
    return null;
  }
}

/**
 * Clears stored numbers for a session
 */
export function clearNumbersFromLocalStorage(sessionId: string): void {
  try {
    const storageKey = `bingo-numbers-session-${sessionId}`;
    localStorage.removeItem(storageKey);
  } catch (e) {
    // Ignore storage errors
  }
}
