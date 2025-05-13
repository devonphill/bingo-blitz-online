
import { logWithTimestamp } from '@/utils/logUtils';

// Listener type for number updates
type NumberUpdateListener = (number: number | null, allNumbers: number[]) => void;

/**
 * Service for managing called numbers with listeners
 */
export class NumberCallingService {
  private calledNumbers: Map<string, number[]> = new Map();
  private lastCalledNumber: Map<string, number | null> = new Map();
  private listeners: Map<string, Set<NumberUpdateListener>> = new Map();

  /**
   * Subscribe to number updates for a specific session
   */
  public subscribe(sessionId: string, listener: NumberUpdateListener): () => void {
    if (!this.listeners.has(sessionId)) {
      this.listeners.set(sessionId, new Set());
    }
    
    const sessionListeners = this.listeners.get(sessionId)!;
    sessionListeners.add(listener);
    
    // Call the listener immediately with current values
    const numbers = this.getCalledNumbers(sessionId);
    const lastNumber = this.getLastCalledNumber(sessionId);
    listener(lastNumber, numbers);
    
    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(sessionId);
      if (listeners) {
        listeners.delete(listener);
      }
    };
  }
  
  /**
   * Get all called numbers for a session
   */
  public getCalledNumbers(sessionId: string): number[] {
    return [...(this.calledNumbers.get(sessionId) || [])];
  }
  
  /**
   * Get the last called number for a session
   */
  public getLastCalledNumber(sessionId: string): number | null {
    return this.lastCalledNumber.get(sessionId) || null;
  }
  
  /**
   * Update the list of called numbers for a session
   */
  public updateCalledNumbers(sessionId: string, numbers: number[]): void {
    this.calledNumbers.set(sessionId, [...numbers]);
    
    // Update last called number if available
    if (numbers.length > 0) {
      this.lastCalledNumber.set(sessionId, numbers[numbers.length - 1]);
    }
    
    // Notify listeners
    this.notifyListeners(sessionId, this.getLastCalledNumber(sessionId));
  }
  
  /**
   * Notifies all listeners of an update
   */
  public notifyListeners(sessionId: string, number: number | null): void {
    const listeners = this.listeners.get(sessionId);
    if (!listeners) return;
    
    const calledNumbers = this.getCalledNumbers(sessionId);
    
    // Add the new number to the list if it's not already there and not null
    if (number !== null && !calledNumbers.includes(number)) {
      this.calledNumbers.set(sessionId, [...calledNumbers, number]);
      this.lastCalledNumber.set(sessionId, number);
    }
    
    // Notify all listeners
    listeners.forEach(listener => {
      try {
        listener(number, this.getCalledNumbers(sessionId));
      } catch (error) {
        console.error('Error in number update listener:', error);
      }
    });
  }
  
  /**
   * Reset called numbers for a session
   */
  public resetNumbers(sessionId: string): void {
    this.calledNumbers.set(sessionId, []);
    this.lastCalledNumber.set(sessionId, null);
    
    // Notify listeners of reset
    const listeners = this.listeners.get(sessionId);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(null, []);
        } catch (error) {
          console.error('Error in number reset listener:', error);
        }
      });
    }
  }
}

// Export a singleton instance
const numberCallingService = new NumberCallingService();

export const getNumberCallingService = (): NumberCallingService => {
  return numberCallingService;
};
