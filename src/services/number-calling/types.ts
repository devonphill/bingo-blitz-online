
/**
 * Types for number calling service
 */

export interface NumberSubscriptionCallback {
  (number: number | null, numbers: number[]): void;
}

export interface NumberCallingService {
  subscribe: (sessionId: string, callback: NumberSubscriptionCallback) => () => void;
  notifyListeners: (sessionId: string, number: number | null, numbers: number[]) => void;
  resetNumbers: (sessionId: string) => Promise<boolean>;
  updateCalledNumbers: (sessionId: string, numbers: number[]) => Promise<boolean>;
}
