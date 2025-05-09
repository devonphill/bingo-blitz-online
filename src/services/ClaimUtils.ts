
/**
 * Utility functions for claim management
 */

/**
 * Generates a UUID v4 to identify claims
 * From: https://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid
 */
export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Validates a claim to ensure it has all required fields
 */
export const validateClaimData = (claimData: any): boolean => {
  if (!claimData || !claimData.sessionId || !claimData.playerId) {
    return false;
  }
  
  // Add metrics to help with debugging
  if (claimData.ticket && Array.isArray(claimData.ticket.numbers)) {
    const toGoCount = claimData.toGoCount || 0;
    const hasLastCalledNumber = !!claimData.lastCalledNumber;
    console.log(`Claim metrics: ${toGoCount} to go, has last called number: ${hasLastCalledNumber}`);
  }
  
  return true;
};
