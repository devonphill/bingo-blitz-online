
import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { CONNECTION_STATES, WebSocketConnectionStatus, EVENT_TYPES } from '@/constants/websocketConstants';
import { logDebug, logInfo, logWarn, logError } from '@/utils/logUtils';

// Define the channel names as specified in the requirements
const CHANNEL_NAMES = {
    GAME_DETAILS_BASE: 'game_details',
    CLAIM_SENDER_BASE: 'claim_sender',
    GAME_UPDATES_BASE: 'game_updates',
    CLAIMS_VALIDATION_BASE: 'claims_validation',
    PARTICIPANTS_BASE: 'participants'
} as const;

// Define additional event types if needed
const ADDITIONAL_EVENT_TYPES = {
    SESSION_ENDED_BY_CALLER: 'session-ended-by-caller',
    CHANGES_DETECTED: 'changes-detected'
} as const;

// Export the channel names for external use
export const NCM_CHANNEL_NAMES = CHANNEL_NAMES;

/**
 * Single source of truth for all WebSocket connections
 * This class is responsible for managing all WebSocket connections
 * and providing a single interface for interacting with them.
 */
export class NEWConnectionManager_SinglePointOfTruth {
  // Singleton instance
  private static instance: NEWConnectionManager_SinglePointOfTruth;
  
  private supabaseClient: SupabaseClient | null = null; // For all Supabase interactions

  private activeChannels: Map<string, RealtimeChannel> = new Map(); // Key: full channel name (e.g., game_details-sessionId)
  private channelRefCounts: Map<string, number> = new Map();
  // channelName -> eventName -> listenerId -> callback
  private specificEventListeners: Map<string, Map<string, Map<string, Function>>> = new Map();
  private listenerIdCounter: number = 0;

  private currentSessionIdInternal: string | null = null;
  private serviceStatusInternal: WebSocketConnectionStatus = CONNECTION_STATES.DISCONNECTED;
  private isSupabaseClientInitialized: boolean = false;

  private overallStatusListeners: Array<(status: WebSocketConnectionStatus, isServiceReady: boolean) => void> = [];

  /**
   * Private constructor to prevent direct instantiation
   */
  private constructor() {
    logInfo('[NCM_SPOT] Instance created. Call initialize() to set Supabase client.');
    this.setupBrowserConnectivityListeners();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): NEWConnectionManager_SinglePointOfTruth {
    if (!NEWConnectionManager_SinglePointOfTruth.instance) {
      NEWConnectionManager_SinglePointOfTruth.instance = new NEWConnectionManager_SinglePointOfTruth();
    }
    return NEWConnectionManager_SinglePointOfTruth.instance;
  }

  /**
   * Set up browser connectivity listeners to handle online/offline events
   */
  private setupBrowserConnectivityListeners(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('offline', () => {
        this.serviceStatusInternal = CONNECTION_STATES.DISCONNECTED;
        this.notifyOverallStatusListeners();
        logWarn('[NCM_SPOT] Browser went offline. Connection status updated.');
      });

      window.addEventListener('online', () => {
        this.serviceStatusInternal = CONNECTION_STATES.CONNECTING;
        this.notifyOverallStatusListeners();
        logInfo('[NCM_SPOT] Browser back online. Attempting to reconnect...');

        if (this.currentSessionIdInternal) {
          this.connectToSession(this.currentSessionIdInternal);
        }
      });
    }
  }

  /**
   * Initialize the connection manager with a Supabase client
   */
  public initialize(client: SupabaseClient): void {
    if (this.supabaseClient) {
      logWarn('[NCM_SPOT] Already initialized. Ignoring duplicate initialization.');
      return;
    }

    this.supabaseClient = client;
    this.isSupabaseClientInitialized = true;
    this.serviceStatusInternal = CONNECTION_STATES.DISCONNECTED;
    this.notifyOverallStatusListeners();

    logInfo('[NCM_SPOT] Successfully initialized with Supabase client.');
  }

  /**
   * Check if the service is initialized
   */
  public isServiceInitialized(): boolean {
    return this.isSupabaseClientInitialized;
  }

  /**
   * Get the current overall connection status
   */
  public getCurrentConnectionState(): WebSocketConnectionStatus {
    return this.serviceStatusInternal;
  }

  /**
   * Get the current overall status (alias to maintain compatibility)
   */
  public getCurrentOverallStatus(): WebSocketConnectionStatus {
    return this.serviceStatusInternal;
  }

  /**
   * Check if the service is connected
   */
  public isConnected(): boolean {
    return this.serviceStatusInternal === CONNECTION_STATES.CONNECTED && this.isSupabaseClientInitialized;
  }

  /**
   * Check if the service is connected overall (alias for isConnected)
   */
  public isOverallConnected(): boolean {
    return this.serviceStatusInternal === CONNECTION_STATES.CONNECTED && this.isSupabaseClientInitialized;
  }

  /**
   * Add a listener for overall status changes
   * Returns a function to remove the listener
   */
  public addOverallStatusListener(
    listener: (status: WebSocketConnectionStatus, isServiceReady: boolean) => void
  ): () => void {
    this.overallStatusListeners.push(listener);

    // Call the listener immediately with current status
    listener(this.serviceStatusInternal, this.isServiceInitialized());

    // Return a cleanup function
    return () => {
      const index = this.overallStatusListeners.indexOf(listener);
      if (index !== -1) {
        this.overallStatusListeners.splice(index, 1);
      }
    };
  }

  /**
   * Add a status listener (alias for addOverallStatusListener for compatibility)
   */
  public addStatusListener(
    listener: (status: WebSocketConnectionStatus, isServiceReady: boolean) => void
  ): () => void {
    return this.addOverallStatusListener(listener);
  }

  /**
   * Notify all overall status listeners of a status change
   */
  private notifyOverallStatusListeners(): void {
    const status = this.serviceStatusInternal;
    const isReady = this.isServiceInitialized();

    this.overallStatusListeners.forEach(listener => {
      try {
        listener(status, isReady);
      } catch (error) {
        logError(`[NCM_SPOT] Error in status listener: ${error}`);
      }
    });
  }

  /**
   * Helper methods for channel names
   */
  private getGameDetailsChannelName(sessionId: string): string {
    return `${CHANNEL_NAMES.GAME_DETAILS_BASE}-${sessionId}`;
  }

  private getClaimSenderChannelName(sessionId: string): string {
    return `${CHANNEL_NAMES.CLAIM_SENDER_BASE}-${sessionId}`;
  }

  private getGameUpdatesChannelName(sessionId: string): string {
    return `${CHANNEL_NAMES.GAME_UPDATES_BASE}-${sessionId}`;
  }

  private getClaimsValidationChannelName(sessionId: string): string {
    return `${CHANNEL_NAMES.CLAIMS_VALIDATION_BASE}-${sessionId}`;
  }

  private getParticipantChannelName(sessionId: string): string {
    return `${CHANNEL_NAMES.PARTICIPANTS_BASE}-${sessionId}`;
  }

  /**
   * Get the full channel name for a given channel base and session ID
   */
  private getFullChannelName(channelBase: string, sessionId: string): string {
    return `${channelBase}-${sessionId}`;
  }

  // Track which channels have broadcast handlers attached
  private channelBroadcastHandlerAttached: Map<string, boolean> = new Map();

  /**
   * Connect to a session by creating channels for the specified session ID
   */
  public connectToSession(sessionId: string): void {
    // Check for sessionId and initialized client
    if (!sessionId) {
      logError('[NCM_SPOT] Cannot connect to session: No session ID provided.');
      return;
    }

    if (!this.isSupabaseClientInitialized) {
      logError('[NCM_SPOT] Cannot connect to session: Supabase client not initialized.');
      return;
    }

    // Handle already connected case
    if (this.currentSessionIdInternal === sessionId && this.serviceStatusInternal === CONNECTION_STATES.CONNECTED) {
      logInfo(`[NCM_SPOT] Already connected to session: ${sessionId}`);
      return;
    }

    // Handle switching sessions
    if (this.currentSessionIdInternal && this.currentSessionIdInternal !== sessionId) {
      this.disconnectCurrentSessionChannels();
    }

    // Set current session ID and status
    this.currentSessionIdInternal = sessionId;
    this.serviceStatusInternal = CONNECTION_STATES.CONNECTING;
    this.notifyOverallStatusListeners();

    logInfo(`[NCM_SPOT] Connecting to session: ${sessionId}`);

    // Proactively join essential channels
    try {
      // Set up presence listener
      const presenceChannelName = this.getParticipantChannelName(sessionId);
      this.listenForEvent(
        presenceChannelName, 
        'presence', 
        this.handlePresenceEvent.bind(this)
      );

      // Set up game updates listener
      const gameUpdatesChannelName = this.getGameUpdatesChannelName(sessionId);
      this.listenForEvent(
        gameUpdatesChannelName, 
        ADDITIONAL_EVENT_TYPES.CHANGES_DETECTED, 
        this.handleGameUpdatesEvent.bind(this)
      );

      // Update status to connected if successful
      this.serviceStatusInternal = CONNECTION_STATES.CONNECTED;
      logInfo(`[NCM_SPOT] Successfully connected to session: ${sessionId}`);
    } catch (error) {
      this.serviceStatusInternal = CONNECTION_STATES.ERROR;
      logError(`[NCM_SPOT] Failed to connect to session: ${sessionId}, error: ${error}`);
    }

    this.notifyOverallStatusListeners();
  }

  /**
   * Connect to a session (alias for connectToSession)
   */
  public connect(sessionId: string): void {
    this.connectToSession(sessionId);
  }

  /**
   * Add connection listener (alias for addOverallStatusListener for backward compatibility)
   */
  public addConnectionListener(
    listener: (isConnected: boolean) => void
  ): () => void {
    // Convert the simple boolean listener to work with our more comprehensive status listener
    return this.addOverallStatusListener((status, isReady) => {
      // Call the original listener with just the connected status
      listener(status === CONNECTION_STATES.CONNECTED && isReady);
    });
  }

  /**
   * Handle presence events
   */
  private handlePresenceEvent(event: any): void {
    logDebug(`[NCM_SPOT] Presence event received: ${JSON.stringify(event)}`);
    // This is a stub method that will be called by the connectToSession method
    // The actual presence handling is done by the listenForPresenceEvents method
  }

  /**
   * Handle game updates events (stub for now)
   */
  private handleGameUpdatesEvent(event: any): void {
    logDebug(`[NCM_SPOT] Game updates event received: ${JSON.stringify(event)}`);
    // Actual implementation will be added later
  }

  /**
   * Get or create a channel with reference counting
   */
  private getOrCreateChannel(fullChannelName: string): RealtimeChannel | null {
    if (!this.isSupabaseClientInitialized || !this.supabaseClient) {
      logError('[NCM_SPOT] Cannot get/create channel: Supabase client not initialized.');
      return null;
    }

    // If channel exists in activeChannels and state is 'joined' OR 'joining', return it
    const existingChannel = this.activeChannels.get(fullChannelName);
    if (existingChannel) {
      const state = existingChannel.state;
      if (state === 'joined' || state === 'joining') {
        logDebug(`[NCM_SPOT] Reusing active/joining channel: ${fullChannelName}`);
        return existingChannel;
      } else {
        // Channel exists but in dead state, remove it
        logWarn(`[NCM_SPOT] Channel ${fullChannelName} in dead state (${state}). Removing and recreating.`);
        this.supabaseClient.removeChannel(existingChannel);
        this.activeChannels.delete(fullChannelName);
        this.channelRefCounts.delete(fullChannelName);
        this.channelBroadcastHandlerAttached.delete(fullChannelName);
      }
    }

    // Create a new channel
    try {
      logInfo(`[NCM_SPOT] Creating new channel: ${fullChannelName}`);
      const newChannel = this.supabaseClient.channel(fullChannelName, {
        config: { broadcast: { ack: true } }
      });

      // Store the channel
      this.activeChannels.set(fullChannelName, newChannel);
      this.channelRefCounts.set(fullChannelName, 0);
      this.channelBroadcastHandlerAttached.set(fullChannelName, false);

      return newChannel;
    } catch (error) {
      logError(`[NCM_SPOT] Error creating channel ${fullChannelName}: ${error}`);
      return null;
    }
  }

  /**
   * Listen for an event on a channel with reference counting
   */
  public listenForEvent<T = any>(
    fullChannelName: string, 
    eventName: string, 
    callback: (payload: T) => void
  ): () => void {
    // Validate inputs
    if (!eventName || !fullChannelName) {
      logError('[NCM_SPOT] Cannot listen for event: Missing event name or channel name.');
      return () => {}; // Return no-op cleanup function
    }

    if (!this.isSupabaseClientInitialized) {
      logError('[NCM_SPOT] Cannot listen for event: Supabase client not initialized.');
      return () => {}; // Return no-op cleanup function
    }

    // Get or create the channel
    const channel = this.getOrCreateChannel(fullChannelName);
    if (!channel) {
      logError(`[NCM_SPOT] Cannot listen for event: Failed to get/create channel ${fullChannelName}`);
      return () => {}; // Return no-op cleanup function
    }

    // Increment reference count
    const currentCount = this.channelRefCounts.get(fullChannelName) || 0;
    this.channelRefCounts.set(fullChannelName, currentCount + 1);

    // If this is the first reference, subscribe to the channel
    if (currentCount === 0 && channel.state !== 'joined' && channel.state !== 'joining') {
      channel.subscribe((status, err) => {
        logInfo(`[NCM_SPOT] Channel ${fullChannelName} status: ${status}`);

        if (status === 'SUBSCRIBED') {
          logInfo(`[NCM_SPOT] Successfully subscribed to channel: ${fullChannelName}`);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logError(`[NCM_SPOT] Channel error: ${fullChannelName}, status: ${status}, error: ${err?.message || 'unknown'}`);
        }
      });
    }

    // Initialize event listeners map for this channel if needed
    if (!this.specificEventListeners.has(fullChannelName)) {
      this.specificEventListeners.set(fullChannelName, new Map());
    }

    const channelEvents = this.specificEventListeners.get(fullChannelName)!;
    if (!channelEvents.has(eventName)) {
      channelEvents.set(eventName, new Map());
    }

    // Generate a unique listener ID
    const listenerId = `listener_${++this.listenerIdCounter}`;

    // Store the callback
    const eventListeners = channelEvents.get(eventName)!;
    eventListeners.set(listenerId, callback);

    // Attach broadcast handler if this is the first time for this channel
    if (!this.channelBroadcastHandlerAttached.get(fullChannelName)) {
      channel.on('broadcast', (message: { event?: string; payload?: any }) => {
        if (message.event && this.specificEventListeners.has(fullChannelName)) {
          const channelEvents = this.specificEventListeners.get(fullChannelName)!;
          if (channelEvents.has(message.event)) {
            const listeners = channelEvents.get(message.event)!;
            listeners.forEach(cb => {
              try {
                cb(message.payload);
              } catch (error) {
                logError(`[NCM_SPOT] Error in event listener for ${message.event}: ${error}`);
              }
            });
          }
        }
      });
      this.channelBroadcastHandlerAttached.set(fullChannelName, true);
      logDebug(`[NCM_SPOT] Attached broadcast handler to channel: ${fullChannelName}`);
    }

    // Set up the specific event listener if it's not a broadcast event
    if (eventName !== 'broadcast') {
      channel.on(eventName, (payload) => {
        logDebug(`[NCM_SPOT] Event received on ${fullChannelName}: ${eventName}`);
        eventListeners.forEach(cb => {
          try {
            cb(payload);
          } catch (error) {
            logError(`[NCM_SPOT] Error in event listener for ${eventName}: ${error}`);
          }
        });
      });
    }

    logInfo(`[NCM_SPOT] Added event listener for ${eventName} on ${fullChannelName}`);

    // Return a cleanup function
    return () => {
      if (this.specificEventListeners.has(fullChannelName)) {
        const channelEvents = this.specificEventListeners.get(fullChannelName)!;
        if (channelEvents.has(eventName)) {
          const eventListeners = channelEvents.get(eventName)!;
          eventListeners.delete(listenerId);

          // If no more listeners for this event, remove the event map
          if (eventListeners.size === 0) {
            channelEvents.delete(eventName);
          }

          // If no more events for this channel, remove the channel map
          if (channelEvents.size === 0) {
            this.specificEventListeners.delete(fullChannelName);
          }

          logDebug(`[NCM_SPOT] Removed event listener ${listenerId} for ${eventName} on ${fullChannelName}`);
        }
      }

      // Decrement reference count
      this.decrementChannelRefCount(fullChannelName);
    };
  }

  /**
   * Decrement channel reference count and unsubscribe if no more references
   */
  private decrementChannelRefCount(fullChannelName: string): void {
    const currentCount = this.channelRefCounts.get(fullChannelName) || 0;

    if (currentCount <= 1) {
      // Last reference, unsubscribe and remove
      const channel = this.activeChannels.get(fullChannelName);
      if (channel) {
        logInfo(`[NCM_SPOT] Unsubscribing from channel: ${fullChannelName}`);
        channel.unsubscribe();

        if (this.supabaseClient) {
          this.supabaseClient.removeChannel(channel);
        }

        this.activeChannels.delete(fullChannelName);
        this.channelRefCounts.delete(fullChannelName);
        this.specificEventListeners.delete(fullChannelName);
        this.channelBroadcastHandlerAttached.delete(fullChannelName);
      }
    } else {
      // Decrement reference count
      this.channelRefCounts.set(fullChannelName, currentCount - 1);
      logDebug(`[NCM_SPOT] Decreased ref count for ${fullChannelName}. New count: ${currentCount - 1}`);
    }
  }

  /**
   * Remove a channel and all its listeners
   */
  private removeChannelAndListeners(fullChannelName: string): void {
    const channel = this.activeChannels.get(fullChannelName);
    if (!channel) {
      logWarn(`[NCM_SPOT] Cannot remove channel: ${fullChannelName} not found.`);
      return;
    }

    logInfo(`[NCM_SPOT] Removing channel and all listeners: ${fullChannelName}`);

    // Unsubscribe from the channel
    channel.unsubscribe();

    // Remove the channel from Supabase client
    if (this.supabaseClient) {
      this.supabaseClient.removeChannel(channel);
    }

    // Clean up all maps
    this.activeChannels.delete(fullChannelName);
    this.channelRefCounts.delete(fullChannelName);
    this.specificEventListeners.delete(fullChannelName);
    this.channelBroadcastHandlerAttached.delete(fullChannelName);

    logInfo(`[NCM_SPOT] Successfully removed channel: ${fullChannelName}`);
  }

  /**
   * Disconnect from the current session by unsubscribing from all channels
   */
  public disconnectCurrentSessionChannels(): void {
    // Check for current session ID
    if (!this.currentSessionIdInternal) {
      logWarn('[NCM_SPOT] Cannot disconnect: No active session.');
      return;
    }

    const sessionId = this.currentSessionIdInternal;
    logInfo(`[NCM_SPOT] Disconnecting from session: ${sessionId}`);

    // Broadcast session ended event
    this.broadcastGameDetails(sessionId, { 
      event: ADDITIONAL_EVENT_TYPES.SESSION_ENDED_BY_CALLER, 
      payload: { message: 'Session ended by caller' } 
    });

    // Remove all channels and listeners
    this.removeChannelAndListeners(this.getGameDetailsChannelName(sessionId));
    this.removeChannelAndListeners(this.getClaimSenderChannelName(sessionId));
    this.removeChannelAndListeners(this.getGameUpdatesChannelName(sessionId));
    this.removeChannelAndListeners(this.getClaimsValidationChannelName(sessionId));
    this.removeChannelAndListeners(this.getParticipantChannelName(sessionId));

    // Reset session ID and status
    this.currentSessionIdInternal = null;
    this.serviceStatusInternal = CONNECTION_STATES.DISCONNECTED;
    this.notifyOverallStatusListeners();

    logInfo('[NCM_SPOT] Successfully disconnected from session.');
  }

  /**
   * Broadcast a message on the game details channel
   */
  private broadcastGameDetails(sessionId: string, message: any): void {
    if (!this.supabaseClient || !sessionId) {
      logError('[NCM_SPOT] Cannot broadcast: Missing client or session ID.');
      return;
    }

    const channelName = this.getGameDetailsChannelName(sessionId);
    const channel = this.activeChannels.get(channelName);

    if (!channel) {
      logError(`[NCM_SPOT] Cannot broadcast: Channel ${channelName} not found.`);
      return;
    }

    try {
      channel.send({
        type: 'broadcast',
        event: message.event,
        payload: message.payload
      });
      logInfo(`[NCM_SPOT] Broadcast sent on ${channelName}: ${message.event}`);
    } catch (error) {
      logError(`[NCM_SPOT] Error broadcasting on ${channelName}: ${error}`);
    }
  }

  /**
   * Track player presence on the participants channel
   */
  public trackPlayerPresence(
    sessionId: string, 
    presenceData: { username: string; playerCode: string; status: string }
  ): void {
    if (!sessionId) {
      logError('[NCM_SPOT] Cannot track presence: No session ID provided.');
      return;
    }

    if (!this.isSupabaseClientInitialized) {
      logError('[NCM_SPOT] Cannot track presence: Supabase client not initialized.');
      return;
    }

    const channelName = this.getParticipantChannelName(sessionId);
    const channel = this.getOrCreateChannel(channelName);

    if (!channel) {
      logError(`[NCM_SPOT] Cannot track presence: Failed to get/create channel ${channelName}`);
      return;
    }

    // If channel is joined or joining, track presence
    if (channel.state === 'joined' || channel.state === 'joining') {
      try {
        channel.track(presenceData);
        logInfo(`[NCM_SPOT] Tracking presence for ${presenceData.username} on ${channelName}`);
      } catch (error) {
        logError(`[NCM_SPOT] Error tracking presence on ${channelName}: ${error}`);
      }
    } else {
      logWarn(`[NCM_SPOT] Cannot track presence: Channel ${channelName} not joined (state: ${channel.state})`);

      // Try to subscribe to the channel first
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          try {
            channel.track(presenceData);
            logInfo(`[NCM_SPOT] Tracking presence for ${presenceData.username} on ${channelName} after subscribe`);
          } catch (error) {
            logError(`[NCM_SPOT] Error tracking presence after subscribe on ${channelName}: ${error}`);
          }
        }
      });
    }
  }

  /**
   * Listen for presence events on the participants channel
   */
  public listenForPresenceEvents(
    sessionId: string, 
    callback: (event: { 
      eventType: 'sync' | 'join' | 'leave'; 
      newPresences: any[]; 
      leftPresences: any[] 
    }) => void
  ): () => void {
    if (!sessionId) {
      logError('[NCM_SPOT] Cannot listen for presence events: No session ID provided.');
      return () => {}; // Return no-op cleanup function
    }

    if (!this.isSupabaseClientInitialized) {
      logError('[NCM_SPOT] Cannot listen for presence events: Supabase client not initialized.');
      return () => {}; // Return no-op cleanup function
    }

    const channelName = this.getParticipantChannelName(sessionId);
    const channel = this.getOrCreateChannel(channelName);

    if (!channel) {
      logError(`[NCM_SPOT] Cannot listen for presence events: Failed to get/create channel ${channelName}`);
      return () => {}; // Return no-op cleanup function
    }

    // Fix cast for presenceState() to be any[] instead of expecting RealtimePresenceState to match any[]
    const syncCleanup = this.listenForEvent(channelName, 'presence', ({ event }) => {
      if (event === 'sync') {
        callback({ 
          eventType: 'sync', 
          newPresences: Object.values(channel.presenceState() || {}), 
          leftPresences: [] 
        });
      }
    });

    const joinCleanup = this.listenForEvent(channelName, 'presence', ({ event, newPresences }) => {
      if (event === 'join') {
        callback({ 
          eventType: 'join', 
          newPresences: newPresences || [], 
          leftPresences: [] 
        });
      }
    });

    const leaveCleanup = this.listenForEvent(channelName, 'presence', ({ event, leftPresences }) => {
      if (event === 'leave') {
        callback({ 
          eventType: 'leave', 
          newPresences: [], 
          leftPresences: leftPresences || [] 
        });
      }
    });

    // Return a combined cleanup function
    return () => {
      syncCleanup();
      joinCleanup();
      leaveCleanup();
    };
  }

  /**
   * Add an event listener to a specific channel and event
   * Returns a function to remove the listener
   * 
   * Note: This method is deprecated and will be removed in a future version.
   * Use listenForEvent instead.
   */
  public addEventListener(
    channelBaseName: string, 
    sessionId: string, 
    eventName: string, 
    callback: (payload: any) => void
  ): () => void {
    logWarn('[NCM_SPOT] addEventListener is deprecated. Use listenForEvent instead.');
    
    // Fix: Construct the full channel name based on the base name
    let fullChannelName: string;
    
    switch (channelBaseName) {
      case CHANNEL_NAMES.GAME_DETAILS_BASE:
        fullChannelName = this.getGameDetailsChannelName(sessionId);
        break;
      case CHANNEL_NAMES.CLAIM_SENDER_BASE:
        fullChannelName = this.getClaimSenderChannelName(sessionId);
        break;
      case CHANNEL_NAMES.GAME_UPDATES_BASE:
        fullChannelName = this.getGameUpdatesChannelName(sessionId);
        break;
      case CHANNEL_NAMES.CLAIMS_VALIDATION_BASE:
        fullChannelName = this.getClaimsValidationChannelName(sessionId);
        break;
      case CHANNEL_NAMES.PARTICIPANTS_BASE:
        fullChannelName = this.getParticipantChannelName(sessionId);
        break;
      default:
        fullChannelName = this.getFullChannelName(channelBaseName, sessionId);
    }
    
    return this.listenForEvent(fullChannelName, eventName, callback);
  }

  /**
   * Send a message on a specific channel and event
   * 
   * Note: This method is deprecated and will be removed in a future version.
   * Use the specific channel send methods instead.
   */
  public sendMessage(
    channelBaseName: string, 
    sessionId: string, 
    eventName: string, 
    payload: any
  ): void {
    logWarn('[NCM_SPOT] sendMessage is deprecated. Use specific channel send methods instead.');

    if (!this.supabaseClient) {
      logError('[NCM_SPOT] Cannot send message: Supabase client not initialized.');
      return;
    }

    // Fix: Construct the full channel name based on the base name
    let fullChannelName: string;
    
    switch (channelBaseName) {
      case CHANNEL_NAMES.GAME_DETAILS_BASE:
        fullChannelName = this.getGameDetailsChannelName(sessionId);
        break;
      case CHANNEL_NAMES.CLAIM_SENDER_BASE:
        fullChannelName = this.getClaimSenderChannelName(sessionId);
        break;
      case CHANNEL_NAMES.GAME_UPDATES_BASE:
        fullChannelName = this.getGameUpdatesChannelName(sessionId);
        break;
      case CHANNEL_NAMES.CLAIMS_VALIDATION_BASE:
        fullChannelName = this.getClaimsValidationChannelName(sessionId);
        break;
      case CHANNEL_NAMES.PARTICIPANTS_BASE:
        fullChannelName = this.getParticipantChannelName(sessionId);
        break;
      default:
        fullChannelName = this.getFullChannelName(channelBaseName, sessionId);
    }

    // Get or create the channel
    const channel = this.getOrCreateChannel(fullChannelName);
    if (!channel) {
      logError(`[NCM_SPOT] Cannot send message: Failed to get/create channel ${fullChannelName}`);
      return;
    }

    // Send the message
    try {
      logDebug(`[NCM_SPOT] Sending message on ${fullChannelName}: ${eventName}`);
      channel.send({
        type: 'broadcast',
        event: eventName,
        payload
      });
    } catch (error) {
      logError(`[NCM_SPOT] Error sending message on ${fullChannelName}: ${error}`);
    }
  }

  /**
   * Disconnect from a session by unsubscribing from all channels
   */
  public disconnectFromSession(sessionId: string): void {
    if (!sessionId) {
      logWarn('[NCM_SPOT] Cannot disconnect: No session ID provided.');
      return;
    }

    logInfo(`[NCM_SPOT] Disconnecting from session: ${sessionId}`);

    // Use the correct channel name getters and removeChannelAndListeners method
    this.removeChannelAndListeners(this.getGameDetailsChannelName(sessionId));
    this.removeChannelAndListeners(this.getClaimSenderChannelName(sessionId));
    this.removeChannelAndListeners(this.getGameUpdatesChannelName(sessionId));
    this.removeChannelAndListeners(this.getClaimsValidationChannelName(sessionId));
    this.removeChannelAndListeners(this.getParticipantChannelName(sessionId));

    if (this.currentSessionIdInternal === sessionId) {
      this.currentSessionIdInternal = null;
      this.serviceStatusInternal = CONNECTION_STATES.DISCONNECTED;
      this.notifyOverallStatusListeners();
    }

    logInfo(`[NCM_SPOT] Successfully disconnected from session: ${sessionId}`);
  }

  /**
   * Convenience method to add a listener for a specific event on the game details channel
   */
  public addGameDetailsListener(
    sessionId: string, 
    eventName: string, 
    callback: (payload: any) => void
  ): () => void {
    return this.addEventListener(CHANNEL_NAMES.GAME_DETAILS_BASE, sessionId, eventName, callback);
  }

  /**
   * Convenience method to add a listener for a specific event on the claim sender channel
   */
  public addClaimSenderListener(
    sessionId: string, 
    eventName: string, 
    callback: (payload: any) => void
  ): () => void {
    return this.addEventListener(CHANNEL_NAMES.CLAIM_SENDER_BASE, sessionId, eventName, callback);
  }

  /**
   * Convenience method to add a listener for a specific event on the game updates channel
   */
  public addGameUpdatesListener(
    sessionId: string, 
    eventName: string, 
    callback: (payload: any) => void
  ): () => void {
    return this.addEventListener(CHANNEL_NAMES.GAME_UPDATES_BASE, sessionId, eventName, callback);
  }

  /**
   * Convenience method to add a listener for a specific event on the claims validation channel
   */
  public addClaimsValidationListener(
    sessionId: string, 
    eventName: string, 
    callback: (payload: any) => void
  ): () => void {
    return this.addEventListener(CHANNEL_NAMES.CLAIMS_VALIDATION_BASE, sessionId, eventName, callback);
  }

  /**
   * Convenience method to add a listener for a specific event on the participants channel
   */
  public addParticipantsListener(
    sessionId: string, 
    eventName: string, 
    callback: (payload: any) => void
  ): () => void {
    return this.addEventListener(CHANNEL_NAMES.PARTICIPANTS_BASE, sessionId, eventName, callback);
  }

  /**
   * Convenience method to send a message on the game details channel
   */
  public sendGameDetailsMessage(
    sessionId: string, 
    eventName: string, 
    payload: any
  ): void {
    this.sendMessage(CHANNEL_NAMES.GAME_DETAILS_BASE, sessionId, eventName, payload);
  }

  /**
   * Convenience method to send a message on the claim sender channel
   */
  public sendClaimSenderMessage(
    sessionId: string, 
    eventName: string, 
    payload: any
  ): void {
    this.sendMessage(CHANNEL_NAMES.CLAIM_SENDER_BASE, sessionId, eventName, payload);
  }

  /**
   * Convenience method to send a message on the game updates channel
   */
  public sendGameUpdatesMessage(
    sessionId: string, 
    eventName: string, 
    payload: any
  ): void {
    this.sendMessage(CHANNEL_NAMES.GAME_UPDATES_BASE, sessionId, eventName, payload);
  }

  /**
   * Convenience method to send a message on the claims validation channel
   */
  public sendClaimsValidationMessage(
    sessionId: string, 
    eventName: string, 
    payload: any
  ): void {
    this.sendMessage(CHANNEL_NAMES.CLAIMS_VALIDATION_BASE, sessionId, eventName, payload);
  }

  /**
   * Convenience method to send a message on the participants channel
   */
  public sendParticipantsMessage(
    sessionId: string, 
    eventName: string, 
    payload: any
  ): void {
    this.sendMessage(CHANNEL_NAMES.PARTICIPANTS_BASE, sessionId, eventName, payload);
  }

  /**
   * Broadcast number called for a session
   */
  public broadcastNumberCalled(
    sessionId: string,
    number: number,
    calledNumbers?: number[]
  ): Promise<boolean> {
    if (!this.supabaseClient || !sessionId) {
      logError('[NCM_SPOT] Cannot broadcast number called: Missing client or session ID.');
      return Promise.resolve(false);
    }

    try {
      const channelName = this.getGameUpdatesChannelName(sessionId);
      const channel = this.getOrCreateChannel(channelName);

      if (!channel) {
        logError(`[NCM_SPOT] Cannot broadcast number called: Failed to get/create channel ${channelName}`);
        return Promise.resolve(false);
      }

      const payload = {
        number,
        sessionId,
        calledNumbers: calledNumbers || [],
        timestamp: new Date().toISOString()
      };

      logInfo(`[NCM_SPOT] Broadcasting number ${number} called for session ${sessionId}`);
      
      return new Promise((resolve) => {
        channel.send({
          type: 'broadcast',
          event: EVENT_TYPES.NUMBER_CALLED,
          payload
        }).then(() => {
          logInfo(`[NCM_SPOT] Successfully broadcast number ${number} called`);
          resolve(true);
        }).catch(error => {
          logError(`[NCM_SPOT] Error broadcasting number ${number} called: ${error}`);
          resolve(false);
        });
      });
    } catch (error) {
      logError(`[NCM_SPOT] Exception broadcasting number called: ${error}`);
      return Promise.resolve(false);
    }
  }
  
  /**
   * Utility method for broadcasting messages
   */
  public broadcast(
    channelName: string,
    eventName: string,
    payload: any
  ): Promise<boolean> {
    if (!this.supabaseClient) {
      logError('[NCM_SPOT] Cannot broadcast: Missing client.');
      return Promise.resolve(false);
    }

    try {
      const channel = this.getOrCreateChannel(channelName);
      
      if (!channel) {
        logError(`[NCM_SPOT] Cannot broadcast: Failed to get/create channel ${channelName}`);
        return Promise.resolve(false);
      }

      logInfo(`[NCM_SPOT] Broadcasting event ${eventName} on channel ${channelName}`);
      
      return new Promise((resolve) => {
        channel.send({
          type: 'broadcast',
          event: eventName,
          payload
        }).then(() => {
          logInfo(`[NCM_SPOT] Successfully broadcast event ${eventName}`);
          resolve(true);
        }).catch(error => {
          logError(`[NCM_SPOT] Error broadcasting event ${eventName}: ${error}`);
          resolve(false);
        });
      });
    } catch (error) {
      logError(`[NCM_SPOT] Exception broadcasting event: ${error}`);
      return Promise.resolve(false);
    }
  }

  /**
   * Update last ping time
   */
  public updateLastPing(): void {
    // This method would normally update a last ping timestamp
    // For now, we'll just log it
    logDebug(`[NCM_SPOT] Updating last ping: ${new Date().toISOString()}`);
  }
  
  /**
   * Get last ping time
   */
  public getLastPing(): string {
    // This would normally return the actual last ping time
    // For now, we'll just return the current time
    return new Date().toISOString();
  }
}

/**
 * Get the singleton instance of NEWConnectionManager_SinglePointOfTruth
 * This is the recommended way to access the connection manager
 */
export const getNCMInstance = (): NEWConnectionManager_SinglePointOfTruth => {
  return NEWConnectionManager_SinglePointOfTruth.getInstance();
};
