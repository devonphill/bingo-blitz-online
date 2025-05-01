
/**
 * Helper function for consistent timestamped logging
 */
export const logWithTimestamp = (message: string) => {
  const now = new Date();
  const timestamp = now.toISOString();
  console.log(`[${timestamp}] - CHANGED 18:19 - ${message}`);
};
