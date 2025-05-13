
import { logWithTimestamp } from '@/utils/logUtils';
import { BroadcastOptions } from './types';

/**
 * Manages WebSocket broadcast operations
 */
export class BroadcastManager {
  private instanceId: string;
  
  constructor() {
    this.instanceId = `bcastMgr-${Math.random().toString(36).substring(2, 7)}`;
  }

  /**
   * Send a broadcast message with retry capability
   */
  public async broadcastWithRetry(
    channel: any,
    eventType: string, 
    payload: any, 
    options: BroadcastOptions = {}
  ): Promise<boolean> {
    if (!channel) {
      logWithTimestamp(`[${this.instanceId}] Cannot broadcast: Channel not provided`, 'error');
      return false;
    }
    
    const maxRetries = options.maxRetries || 3;
    
    // Generate a unique ID for this broadcast for deduplication
    const broadcastId = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const enrichedPayload = { 
      ...payload,
      broadcastId,
      timestamp: Date.now()
    };
    
    let retries = 0;
    
    while (retries <= maxRetries) {
      try {
        logWithTimestamp(`[${this.instanceId}] Broadcasting ${eventType} (attempt ${retries + 1})`, 'info');
        
        await channel.send({
          type: 'broadcast',
          event: eventType,
          payload: enrichedPayload
        });
        
        logWithTimestamp(`[${this.instanceId}] Broadcast ${eventType} successful`, 'info');
        return true;
      } catch (error) {
        retries++;
        logWithTimestamp(`[${this.instanceId}] Broadcast error (attempt ${retries}): ${error}`, 'error');
        
        // For the last retry, if it fails, return false
        if (retries > maxRetries) {
          return false;
        }
        
        // Wait exponentially longer between retries
        await new Promise(resolve => setTimeout(resolve, 300 * Math.pow(2, retries)));
      }
    }
    
    return false;
  }
}
