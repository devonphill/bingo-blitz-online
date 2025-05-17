
import { usePlayerNumbers } from './usePlayerNumbers';
import { logWithTimestamp } from '@/utils/logUtils';

/**
 * @deprecated Use usePlayerNumbers instead
 * This hook is maintained for backward compatibility
 * It re-exports usePlayerNumbers with a slightly modified interface
 */
export function usePlayerWebSocketNumbers(sessionId: string | null) {
  logWithTimestamp('usePlayerWebSocketNumbers is deprecated, consider using usePlayerNumbers instead', 'warn');

  // Use the primary implementation
  const { calledNumbers, lastCalledNumber, isSubscribed, refreshNumbers } = usePlayerNumbers(sessionId);

  // Return with isConnected instead of isSubscribed for backward compatibility
  return {
    calledNumbers,
    lastCalledNumber,
    isConnected: isSubscribed, // Rename for backward compatibility
    refreshNumbers
  };
}
