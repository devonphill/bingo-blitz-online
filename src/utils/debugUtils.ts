
/**
 * Debug utility functions for connection and state monitoring
 */
import { logWithTimestamp } from './logUtils';

/**
 * Create a connection monitor that logs status at regular intervals
 */
export function setupConnectionMonitor(connectionManager: any, interval = 5000) {
  const monitorId = setInterval(() => {
    const isConnected = connectionManager.isConnected();
    logWithTimestamp(`Connection Monitor: Status = ${isConnected ? 'CONNECTED' : 'DISCONNECTED'}`, 'debug');
    
    // Log channel statuses if available
    if (connectionManager.getChannels) {
      const channels = connectionManager.getChannels();
      logWithTimestamp(`Connection Monitor: Active Channels = ${channels.length}`, 'debug');
      
      channels.forEach((channel: any, i: number) => {
        logWithTimestamp(`Channel ${i + 1}: ${channel.topic} - ${channel.state || 'unknown'}`, 'debug');
      });
    }
  }, interval);
  
  return {
    stop: () => clearInterval(monitorId)
  };
}

/**
 * Debug state updates and component renders
 */
export function debugStateUpdate(componentName: string, stateName: string, prevValue: any, newValue: any) {
  if (JSON.stringify(prevValue) !== JSON.stringify(newValue)) {
    logWithTimestamp(
      `${componentName} - ${stateName} changed: ${JSON.stringify(prevValue)} -> ${JSON.stringify(newValue)}`,
      'debug'
    );
    return true; // State changed
  }
  return false; // No change
}

/**
 * Trace component lifecycles
 */
export class ComponentTracer {
  private componentName: string;
  private instanceId: string;
  
  constructor(componentName: string) {
    this.componentName = componentName;
    this.instanceId = `${componentName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.mount();
  }
  
  mount() {
    logWithTimestamp(`[LIFECYCLE] ${this.componentName} (${this.instanceId}) mounted`, 'debug');
    return this;
  }
  
  update(props?: Record<string, any>) {
    if (props) {
      logWithTimestamp(`[LIFECYCLE] ${this.componentName} (${this.instanceId}) updated with props: ${JSON.stringify(props)}`, 'debug');
    } else {
      logWithTimestamp(`[LIFECYCLE] ${this.componentName} (${this.instanceId}) updated`, 'debug');
    }
    return this;
  }
  
  unmount() {
    logWithTimestamp(`[LIFECYCLE] ${this.componentName} (${this.instanceId}) unmounted`, 'debug');
  }
  
  log(message: string) {
    logWithTimestamp(`[${this.componentName}] ${message}`, 'debug');
    return this;
  }
}

/**
 * Create a payload logger for WebSocket/broadcast messages
 */
export function createPayloadLogger(name: string) {
  return {
    incoming: (payload: any) => {
      logWithTimestamp(`[${name}] Received payload: ${JSON.stringify(payload)}`, 'debug');
      return payload;
    },
    outgoing: (payload: any) => {
      logWithTimestamp(`[${name}] Sending payload: ${JSON.stringify(payload)}`, 'debug');
      return payload;
    }
  };
}
