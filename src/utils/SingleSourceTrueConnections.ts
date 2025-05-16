
// Add method to check if service is initialized
export function isServiceInitialized() {
  return this.webSocketService !== null && this.webSocketService !== undefined;
}
