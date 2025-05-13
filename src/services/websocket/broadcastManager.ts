
import { logWithTimestamp } from '@/utils/logUtils';
import { BroadcastOptions, WebSocketChannel } from './types';

/**
 * Manages broadcasts and retries
 */
export class BroadcastManager {
  /**
   * Broadcast a message with retry capability
   */
  public async broadcastWithRetry(
    channel: WebSocketChannel,
    eventType: string,
    payload: any,
    options: BroadcastOptions = {}
  ): Promise<boolean> {
    // Default options
    const defaultOptions = {
      retries: 3,
      retryDelay: 1000,
      retryMultiplier: 1.5,
      timeout: 5000
    };
    
    // Merge with user options
    const config = { ...defaultOptions, ...options };
    
    // Add broadcast ID for tracking
    const broadcastPayload = {
      ...payload,
      broadcastId: `broadcast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    };
    
    // Try broadcasting with retries
    for (let attempt = 0; attempt <= config.retries; attempt++) {
      try {
        // Log the attempt
        if (attempt > 0) {
          logWithTimestamp(`Retry attempt ${attempt} for broadcast ${broadcastPayload.broadcastId}`, 'info');
        }
        
        // Send the broadcast
        const send = await new Promise<boolean>((resolve, reject) => {
          try {
            // @ts-ignore - Types are inconsistent but this works
            channel.send({
              type: 'broadcast',
              event: eventType,
              payload: broadcastPayload
            });
            
            resolve(true);
          } catch (error) {
            reject(error);
          }
        });
        
        if (send) {
          return true;
        }
      } catch (error) {
        logWithTimestamp(`Error in broadcast attempt ${attempt}: ${error}`, 'error');
        
        // If this was the last attempt, fail
        if (attempt >= config.retries) {
          return false;
        }
        
        // Wait before retrying with exponential backoff
        const delay = config.retryDelay * Math.pow(config.retryMultiplier || 1.5, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return false;
  }
}
