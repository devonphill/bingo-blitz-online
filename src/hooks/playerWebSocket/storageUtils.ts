
import { logWithTimestamp } from "@/utils/logUtils";
import { StoredNumberData } from "./types";

/**
 * Save called numbers to local storage as backup
 */
export function saveNumbersToLocalStorage(
  sessionId: string | null | undefined,
  numbers: number[],
  lastNumber: number | null
): void {
  if (!sessionId) return;
  
  try {
    const storageKey = `bingo-numbers-session-${sessionId}`;
    localStorage.setItem(storageKey, JSON.stringify({
      sessionId,
      calledNumbers: numbers,
      lastCalledNumber: lastNumber,
      timestamp: new Date().toISOString(),
    }));
  } catch (e) {
    // Ignore storage errors
  }
}

/**
 * Get called numbers from local storage
 */
export function getNumbersFromLocalStorage(
  sessionId: string | null | undefined
): StoredNumberData | null {
  if (!sessionId) return null;
  
  try {
    const storageKey = `bingo-numbers-session-${sessionId}`;
    const stored = localStorage.getItem(storageKey);
    
    if (stored) {
      return JSON.parse(stored) as StoredNumberData;
    }
  } catch (e) {
    // Ignore parse errors
  }
  
  return null;
}
