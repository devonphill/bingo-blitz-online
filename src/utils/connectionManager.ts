
// Add these methods to the connectionManager to make them available

// Get the current connection status
getStatus(): 'connected' | 'disconnected' | 'connecting' {
  if (this.supabaseChannel && this.supabaseChannel.state === 'SUBSCRIBED') {
    return 'connected';
  }
  if (this.supabaseChannel && this.supabaseChannel.state === 'SUBSCRIBED') {
    return 'connecting';
  }
  return 'disconnected';
}

// Get the timestamp of the last ping
getLastPing(): number {
  return this.lastPingTimestamp || 0;
}

// Get all active channels
getChannels(): any[] {
  return this.activeChannels || [];
}

// Submit a bingo claim
submitBingoClaim(ticket: any, playerCode: string, sessionId: string): boolean {
  try {
    if (!this.supabaseChannel || !sessionId || !playerCode) {
      console.error('Cannot submit claim: not connected or missing data');
      return false;
    }

    console.log('Submitting claim with ticket:', ticket);

    // Broadcast the claim
    this.supabaseChannel.send({
      type: 'broadcast',
      event: 'bingo-claim',
      payload: {
        playerCode,
        sessionId,
        ticket,
        timestamp: new Date().toISOString()
      }
    });

    return true;
  } catch (error) {
    console.error('Error submitting bingo claim:', error);
    return false;
  }
}
