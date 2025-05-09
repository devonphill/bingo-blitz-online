
import { useClaimValidator } from './useClaimValidator';

/**
 * Main hook for claim management, using the refactored validator
 */
export function useClaimManagement(sessionId?: string, gameNumber?: number) {
  // Use the validator hook that handles all the validation logic
  const {
    validateClaim,
    rejectClaim,
    isProcessingClaim
  } = useClaimValidator(sessionId, gameNumber);

  return {
    validateClaim,
    rejectClaim,
    isProcessingClaim
  };
}
