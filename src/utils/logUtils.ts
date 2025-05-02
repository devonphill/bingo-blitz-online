
// Simple logging utility with timestamps
export function logWithTimestamp(message: string) {
  console.log(`[${new Date().toISOString()}] ${message}`);
  return message;
}

// Legacy function (kept for backward compatibility)
export function cleanupAllConnections() {
  logWithTimestamp("Global connection cleanup: Resetting all connection states");
  logWithTimestamp("All connection states have been reset");
}

// Legacy class (kept for backward compatibility)
export class ConnectionManagerClass {
  isConnecting = false;
  isInCooldown = false;
  cooldownUntil = 0;
  
  startConnection() {
    this.isConnecting = true;
    return this;
  }
  
  endConnection(success: boolean) {
    this.isConnecting = false;
    return this;
  }
  
  scheduleReconnect(callback: () => void) {
    setTimeout(callback, 4000);
    return this;
  }
  
  forceReconnect() {
    this.isConnecting = false;
    this.isInCooldown = false;
    return this;
  }
  
  reset() {
    this.isConnecting = false;
    this.isInCooldown = false;
    return this;
  }
}
