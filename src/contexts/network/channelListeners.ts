import { logWithTimestamp } from '@/utils/logUtils';
import { getNCMInstance } from '@/utils/NEWConnectionManager_SinglePointOfTruth';
import { EVENT_TYPES } from '@/constants/websocketConstants';

/**
 * Sets up claim update listeners for a session
 * 
 * @param sessionId The session ID to listen for
 * @param onClaimUpdate Callback for claim updates
 * @returns Cleanup function
 */
export const setupChannelListeners = (
  sessionId: string,
  onClaimUpdate: (claimData: any) => void
): () => void => {
  if (!sessionId) {
    logWithTimestamp('Cannot set up channel listeners: No session ID provided', 'error');
    return () => {};
  }

  const ncmSpot = getNCMInstance();
  if (!ncmSpot.isServiceInitialized()) {
    logWithTimestamp('Cannot set up channel listeners: Connection not available', 'error');
    return () => {};
  }

  logWithTimestamp(`Setting up claim update listeners for session ${sessionId}`, 'info');

  // Get the full channel name for claims validation
  const claimsValidationChannel = `claims_validation-${sessionId}`;

  // Listen for claim validation events
  const validationCleanup = ncmSpot.listenForEvent(
    claimsValidationChannel,
    EVENT_TYPES.CLAIM_VALIDATING_TKT,
    (payload: any) => {
      // Only process updates for our session
      if (payload?.sessionId === sessionId) {
        logWithTimestamp(`Received claim validation for session ${sessionId}`, 'info');
        onClaimUpdate(payload);
      }
    }
  );

  // Listen for claim result events
  const resultCleanup = ncmSpot.listenForEvent(
    claimsValidationChannel,
    EVENT_TYPES.CLAIM_RESOLUTION,
    (payload: any) => {
      // Only process updates for our session
      if (payload?.sessionId === sessionId) {
        logWithTimestamp(`Received claim result for session ${sessionId}`, 'info');
        onClaimUpdate(payload);
      }
    }
  );

  // Return a combined cleanup function
  return () => {
    validationCleanup();
    resultCleanup();
  };
};
