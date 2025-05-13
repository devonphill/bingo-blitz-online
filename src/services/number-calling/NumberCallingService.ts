
import { logWithTimestamp } from '@/utils/logUtils';

/**
 * Service for calling numbers and managing number state
 */
export class NumberCallingService {
  private static instance: NumberCallingService;
  private listeners: Map<string, Set<(number: number, numbers: number[]) => void>> = new Map();
  private calledNumbersBySession: Map<string, number[]> = new Map();
  
  private constructor() {
    logWithTimestamp('NumberCallingService initialized', 'info');
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): NumberCallingService {
    if (!NumberCallingService.instance) {
      NumberCallingService.instance = new NumberCallingService();
    }
    return NumberCallingService.instance;
  }
  
  /**
   * Subscribe to number updates for a specific session
   */
  public subscribe(sessionId: string, callback: (number: number, numbers: number[]) => void): () => void {
    if (!this.listeners.has(sessionId)) {
      this.listeners.set(sessionId, new Set());
    }
    
    this.listeners.get(sessionId)?.add(callback);
    
    // Return unsubscribe function
    return () => {
      const sessionListeners = this.listeners.get(sessionId);
      if (sessionListeners) {
        sessionListeners.delete(callback);
      }
    };
  }
  
  /**
   * Notify listeners of a new number
   */
  public notifyListeners(sessionId: string, number: number): void {
    const sessionListeners = this.listeners.get(sessionId);
    
    if (!sessionListeners) return;
    
    // Get current numbers
    const numbers = this.getCalledNumbers(sessionId);
    
    // Update our cached numbers if needed
    if (!numbers.includes(number)) {
      this.addNumberToSession(sessionId, number);
    }
    
    // Get the updated numbers
    const updatedNumbers = this.getCalledNumbers(sessionId);
    
    // Notify all listeners
    sessionListeners.forEach(listener => {
      try {
        listener(number, updatedNumbers);
      } catch (e) {
        logWithTimestamp(`Error notifying number listener: ${e}`, 'error');
      }
    });
  }
  
  /**
   * Get all called numbers for a session
   */
  public getCalledNumbers(sessionId: string): number[] {
    return [...(this.calledNumbersBySession.get(sessionId) || [])];
  }
  
  /**
   * Get the last called number for a session
   */
  public getLastCalledNumber(sessionId: string): number | null {
    const numbers = this.calledNumbersBySession.get(sessionId) || [];
    return numbers.length > 0 ? numbers[numbers.length - 1] : null;
  }
  
  /**
   * Add a number to a session's called numbers
   */
  private addNumberToSession(sessionId: string, number: number): void {
    const numbers = this.calledNumbersBySession.get(sessionId) || [];
    
    if (!numbers.includes(number)) {
      const updatedNumbers = [...numbers, number];
      this.calledNumbersBySession.set(sessionId, updatedNumbers);
    }
  }
  
  /**
   * Reset numbers for a session
   */
  public resetNumbers(sessionId: string): void {
    this.calledNumbersBySession.set(sessionId, []);
  }
  
  /**
   * Update called numbers for a session
   */
  public updateCalledNumbers(sessionId: string, numbers: number[]): void {
    this.calledNumbersBySession.set(sessionId, [...numbers]);
  }
}

// Export a getter for the singleton
export const getNumberCallingService = (): NumberCallingService => {
  return NumberCallingService.getInstance();
};
