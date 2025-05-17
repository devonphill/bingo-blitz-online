
import { createClient, SupabaseClient, RealtimeChannel, RealtimeChannelSendResponse } from '@supabase/supabase-js';
import { logWithTimestamp } from './logUtils';
import { EVENT_TYPES, CHANNEL_NAMES, CONNECTION_STATES, WebSocketConnectionStatus } from '@/constants/websocketConstants';
import { Database } from '@/types/supabase'; // Assuming your generated Supabase types are here
import { supabase } from "@/integrations/supabase/client";

type GenericEventListener<T = any> = (payload: T) => void;

interface NumberCalledPayload {
  sessionId: string;
  number: number;
  calledNumbers: number[];
  timestamp: number;
}

interface ClaimSubmittedPayload {
  sessionId: string;
  playerId: string;
  playerName?: string;
  playerCode?: string;
  ticketSerial: string;
  ticketDetails?: any;
  calledNumbers: number[];
  patternClaimed: string;
}

class SingleSourceTrueConnections {
  private static instance: SingleSourceTrueConnections | null = null;
  private supabaseRealtimeClient: SupabaseClient<Database> | null = null; // Use your Database type

  private channels: Map<string, RealtimeChannel> = new Map();
  private channelRefCounts: Map<string, number> = new Map();
  // For storing specific event listeners attached via listenForEvent
  // channelName -> eventName -> listenerId -> callback
  private specificEventListeners: Map<string, Map<string, Map<string, GenericEventListener>>> = new Map();
  private listenerIdCounter: number = 0;

  private currentSessionIdInternal: string | null = null;
  private serviceStatus: WebSocketConnectionStatus = CONNECTION_STATES.DISCONNECTED;
  private isBaseServiceInitialized: boolean = false; // Tracks if Supabase client is set
  private lastPingTime: number = 0;

  // Listeners for overall SSTC status changes
  private sstcStatusListeners: Array<(status: WebSocketConnectionStatus, isServiceReady: boolean) => void> = [];
  // Connection listeners for backward compatibility
  private connectionListeners: Array<(isConnected: boolean) => void> = [];

  private constructor() {
    logWithTimestamp('[SSTC] Instance created. Call initialize() with Supabase client.', 'info');
    // No direct WebSocketService instantiation here now, relies on public initialize
    this.setupBrowserConnectivityListeners();
    this.lastPingTime = Date.now();
  }

  public static getInstance(): SingleSourceTrueConnections {
    if (!SingleSourceTrueConnections.instance) {
      SingleSourceTrueConnections.instance = new SingleSourceTrueConnections();
    }
    return SingleSourceTrueConnections.instance;
  }

  private setupBrowserConnectivityListeners(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleBrowserOnline);
      window.addEventListener('offline', this.handleBrowserOffline);
    }
  }

  private handleBrowserOnline = (): void => {
    logWithTimestamp('[SSTC] Browser came online.', 'info');
    if (this.supabaseRealtimeClient) { // Only attempt if client is initialized
      this.updateOverallStatus(CONNECTION_STATES.CONNECTING); // Attempt to reconnect will be handled by channel logic
      // If a session was active, try to re-establish channels implicitly via existing listeners
      // or explicitly if connect() is called by NetworkProvider
      if (this.currentSessionIdInternal) {
         this.connect(this.currentSessionIdInternal); // Attempt to re-establish session context
      }
    }
  };

  private handleBrowserOffline = (): void => {
    logWithTimestamp('[SSTC] Browser went offline.', 'warn');
    this.updateOverallStatus(CONNECTION_STATES.DISCONNECTED);
    // Supabase client itself handles channel states on network loss.
  };

  public initialize(supabaseClient: SupabaseClient<Database>): void {
    if (this.supabaseRealtimeClient) {
      logWithTimestamp('[SSTC] Already initialized.', 'warn');
      return;
    }
    this.supabaseRealtimeClient = supabaseClient;
    this.isBaseServiceInitialized = true;
    // Assuming base connection is managed by Supabase client, set to connected if client is valid
    // Actual channel subscriptions confirm true "connectivity" for features.
    this.updateOverallStatus(CONNECTION_STATES.CONNECTED); // Base client is ready
    logWithTimestamp('[SSTC] Supabase client set and service considered initialized.', 'info');
  }

  public isServiceInitialized(): boolean {
    return this.isBaseServiceInitialized;
  }

  private updateOverallStatus(newStatus: WebSocketConnectionStatus): void {
    if (this.serviceStatus !== newStatus) {
      this.serviceStatus = newStatus;
      logWithTimestamp(`[SSTC] Overall status changed to: ${this.serviceStatus}`, 'info');
      this.notifySSTCStatusListeners();
      this.notifyConnectionListeners();
    }
  }

  public getCurrentConnectionState(): WebSocketConnectionStatus {
    return this.serviceStatus;
  }

  public isConnected(): boolean {
    return this.serviceStatus === CONNECTION_STATES.CONNECTED;
  }

  public connect(sessionId: string): void {
    if (!sessionId) {
      logWithTimestamp('[SSTC] connect: No sessionId provided.', 'error');
      return;
    }
    if (!this.isBaseServiceInitialized || !this.supabaseRealtimeClient) {
      logWithTimestamp('[SSTC] connect: Supabase client not initialized. Call initialize() first.', 'error');
      this.updateOverallStatus(CONNECTION_STATES.DISCONNECTED);
      return;
    }

    logWithTimestamp(`[SSTC] connect: Setting current session to: ${sessionId}`, 'info');

    if (this.currentSessionIdInternal && this.currentSessionIdInternal !== sessionId) {
      logWithTimestamp(`[SSTC] connect: Switching session from ${this.currentSessionIdInternal} to ${sessionId}. Cleaning up old session channels.`, 'info');
      this.disconnectChannelsForSession(this.currentSessionIdInternal);
    }
    
    this.currentSessionIdInternal = sessionId;
    this.lastPingTime = Date.now();
    // Connection status reflects base client readiness; session channels are established on demand.
    this.updateOverallStatus(CONNECTION_STATES.CONNECTED); // Assuming base connection allows channels to be made
    // Components will call listenForEvent which will establish session-specific channels
  }

  public disconnect(): void {
    logWithTimestamp(`[SSTC] disconnect: Called for session: ${this.currentSessionIdInternal}. Cleaning up all session channels.`, 'info');
    if (this.currentSessionIdInternal) {
      this.disconnectChannelsForSession(this.currentSessionIdInternal);
    }
    this.currentSessionIdInternal = null;
    this.updateOverallStatus(CONNECTION_STATES.DISCONNECTED); // Or based on actual Supabase client state
  }

  private disconnectChannelsForSession(sessionId: string): void {
    // Iterate over channels and remove those specific to this session
    // This needs careful handling if channel names aren't strictly session-prefixed
    // For now, let's assume channel names passed to listenForEvent are session-specific
    // This part becomes simpler if listenForEvent cleanup handles ref counts correctly
    logWithTimestamp(`[SSTC] disconnectChannelsForSession: Placeholder for session ${sessionId}. Relies on listener cleanup.`, 'info');
    // Actual channel removal happens when ref counts drop to 0 via removeListener
  }

  public addStatusListener(listener: (status: WebSocketConnectionStatus, isServiceReady: boolean) => void): () => void {
    this.sstcStatusListeners.push(listener);
    try {
      listener(this.serviceStatus, this.isBaseServiceInitialized);
    } catch (e) {
      logWithTimestamp('[SSTC] Error in initial call to status listener', 'error', e);
    }
    return () => {
      this.sstcStatusListeners = this.sstcStatusListeners.filter(l => l !== listener);
      logWithTimestamp(`[SSTC] Status listener removed. Remaining: ${this.sstcStatusListeners.length}`, 'info');
    };
  }
  
  // For backward compatibility with old NetworkProvider
  public addConnectionListener(listener: (isConnected: boolean) => void): () => void {
    this.connectionListeners.push(listener);
    try {
      listener(this.isConnected());
    } catch (e) {
      logWithTimestamp('[SSTC] Error in initial call to connection listener', 'error', e);
    }
    return () => {
      this.connectionListeners = this.connectionListeners.filter(l => l !== listener);
      logWithTimestamp(`[SSTC] Connection listener removed. Remaining: ${this.connectionListeners.length}`, 'info');
    };
  }

  private notifySSTCStatusListeners(): void {
    const currentStatus = this.serviceStatus;
    const currentReady = this.isBaseServiceInitialized;
    logWithTimestamp(`[SSTC] Notifying ${this.sstcStatusListeners.length} status listeners. Status: ${currentStatus}, Ready: ${currentReady}`, 'info');
    this.sstcStatusListeners.forEach(listener => {
      try {
        listener(currentStatus, currentReady);
      } catch (error) {
        logWithTimestamp('[SSTC] Error in status listener callback', 'error', error);
      }
    });
  }
  
  private notifyConnectionListeners(): void {
    const isConnected = this.isConnected();
    logWithTimestamp(`[SSTC] Notifying ${this.connectionListeners.length} connection listeners. Connected: ${isConnected}`, 'info');
    this.connectionListeners.forEach(listener => {
      try {
        listener(isConnected);
      } catch (error) {
        logWithTimestamp('[SSTC] Error in connection listener callback', 'error', error);
      }
    });
  }

  // Constructs session-specific channel names
  private getSessionChannelName(baseChannelName: string, sessionId?: string | null): string | null {
    const sId = sessionId || this.currentSessionIdInternal;
    if (!sId) {
      logWithTimestamp(`[SSTC] Cannot form channel name for ${baseChannelName}: No session ID.`, 'warn');
      return null;
    }
    return `${baseChannelName}${sId}`;
  }

  private getOrCreateChannel(channelName: string): RealtimeChannel | null {
    if (!this.isBaseServiceInitialized || !this.supabaseRealtimeClient) {
      logWithTimestamp(`[SSTC] getOrCreateChannel: Supabase client not initialized for channel ${channelName}.`, 'error');
      return null;
    }

    if (this.channels.has(channelName)) {
      const existingChannel = this.channels.get(channelName)!;
      logWithTimestamp(`[SSTC DEBUG] getOrCreateChannel: Found existing channel '${channelName}' with state: ${existingChannel.state}`, 'info');
      if (existingChannel.state === 'joined' || existingChannel.state === 'joining') {
        logWithTimestamp(`[SSTC DEBUG] getOrCreateChannel: Reusing active or joining channel '${channelName}'.`, 'info');
        return existingChannel;
      } else {
        logWithTimestamp(`[SSTC DEBUG] Existing channel '${channelName}' is not joined/joining (state: ${existingChannel.state}). Removing.`, 'warn');
        // Supabase client automatically removes channels that fail or are unsubscribed.
        // We just need to remove from our maps.
        this.channels.delete(channelName);
        this.channelRefCounts.delete(channelName);
      }
    }

    logWithTimestamp(`[SSTC DEBUG] Creating NEW Supabase channel instance for: ${channelName}`, 'info');
    const newChannel = this.supabaseRealtimeClient.channel(channelName, {
      config: { broadcast: { ack: true } } // Enable ack for presence if needed
    });
    this.channels.set(channelName, newChannel);
    this.channelRefCounts.set(channelName, 0); // Initial ref count
    return newChannel;
  }

  public listenForEvent<T = any>(
    baseChannelNameKey: keyof typeof CHANNEL_NAMES, // e.g., 'GAME_UPDATES_BASE'
    eventName: string,
    callback: GenericEventListener<T>,
    specificSessionId?: string // Optional: if currentSessionIdInternal shouldn't be used
  ): () => void {
    const sId = specificSessionId || this.currentSessionIdInternal;
    if (!sId) {
      logWithTimestamp(`[SSTC] listenForEvent: No session ID available for channel base ${baseChannelNameKey}, event ${eventName}. Listener not added.`, 'warn');
      return () => {};
    }
    const channelName = `${CHANNEL_NAMES[baseChannelNameKey]}${sId}`;

    if (!eventName || typeof eventName !== 'string') {
      logWithTimestamp(`[SSTC] listenForEvent: Invalid eventName '${eventName}' for channel ${channelName}. Listener not added.`, 'error');
      return () => {};
    }

    if (!this.isBaseServiceInitialized) {
        logWithTimestamp(`[SSTC] listenForEvent: Service not initialized for ${eventName} on ${channelName}. Deferring.`, 'warn');
        return () => {};
    }

    const channel = this.getOrCreateChannel(channelName);
    if (!channel) {
      logWithTimestamp(`[SSTC] listenForEvent: Failed to get/create channel ${channelName} for event ${eventName}. Listener not added.`, 'error');
      return () => {};
    }

    const currentRefCount = (this.channelRefCounts.get(channelName) || 0) + 1;
    this.channelRefCounts.set(channelName, currentRefCount);
    logWithTimestamp(`[SSTC] listenForEvent: Ref count for ${channelName} is now ${currentRefCount}.`, 'info');

    if (currentRefCount === 1 && (channel.state !== 'joined' && channel.state !== 'joining')) {
      logWithTimestamp(`[SSTC] listenForEvent: First listener for ${channelName}, state is ${channel.state}. Subscribing channel.`, 'info');
      channel.subscribe((status, err) => {
        logWithTimestamp(`[SSTC] Channel ${channelName} subscription status: ${status}`, status === 'CHANNEL_ERROR' || err ? 'error' : 'info', err || '');
        if (status === 'SUBSCRIBED') {
          logWithTimestamp(`[SSTC] Channel ${channelName} successfully SUBSCRIBED.`, 'info');
          // This system channel is now considered part of the overall connected state for the session
          this.updateOverallStatus(CONNECTION_STATES.CONNECTED);
        } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
          logWithTimestamp(`[SSTC] Channel ${channelName} issue: ${status}. Removing from active channels.`, 'warn');
          this.channels.delete(channelName);
          this.channelRefCounts.delete(channelName);
          // If this was the only active session channel, the overall status might change.
          // This needs more sophisticated logic if multiple session channels exist.
          // For now, let's assume system channel handles overall, this is for specific game channels.
          if (this.channels.size === 0) { // Example if no other channels are active
            this.updateOverallStatus(CONNECTION_STATES.DISCONNECTED); // Or connecting if auto-reconnect is desired
          }
        }
      });
    }

    const listenerId = `${eventName}-${this.listenerIdCounter++}`;
    if (!this.specificEventListeners.has(channelName)) {
      this.specificEventListeners.set(channelName, new Map());
    }
    if (!this.specificEventListeners.get(channelName)!.has(eventName)) {
      this.specificEventListeners.get(channelName)!.set(eventName, new Map());
    }
    this.specificEventListeners.get(channelName)!.get(eventName)!.set(listenerId, callback);

    // Main broadcast listener on the channel, dispatches to specific event listeners
    // Only add this 'main' broadcast handler once per channel
    if (!channel.listeners('broadcast').find(l => (l as any)._sstc_broadcast_handler)) {
        const sstcBroadcastHandler = (message: { event?: string; payload?: any }) => {
            if (message.event && this.specificEventListeners.has(channelName) && this.specificEventListeners.get(channelName)!.has(message.event)) {
                logWithTimestamp(`[SSTC] Channel ${channelName} received broadcast for event ${message.event}`, 'info');
                this.specificEventListeners.get(channelName)!.get(message.event)!.forEach(cb => {
                    try {
                        cb(message.payload);
                    } catch (e) {
                        logWithTimestamp(`[SSTC] Error in event listener for ${message.event} on ${channelName}`, 'error', e);
                    }
                });
            }
        };
        (sstcBroadcastHandler as any)._sstc_broadcast_handler = true; // Mark our handler
        channel.on('broadcast', sstcBroadcastHandler);
        logWithTimestamp(`[SSTC] Attached main broadcast event dispatcher to channel ${channelName}.`, 'info');
    }


    logWithTimestamp(`[SSTC] Listener added for event '${eventName}' on channel '${channelName}' (ID: ${listenerId}).`, 'info');

    return () => {
      logWithTimestamp(`[SSTC] Cleanup called for listener ID '${listenerId}' (event '${eventName}') on channel '${channelName}'.`, 'info');
      if (this.specificEventListeners.has(channelName) && this.specificEventListeners.get(channelName)!.has(eventName)) {
        this.specificEventListeners.get(channelName)!.get(eventName)!.delete(listenerId);
        if (this.specificEventListeners.get(channelName)!.get(eventName)!.size === 0) {
          this.specificEventListeners.get(channelName)!.delete(eventName);
          // Note: Supabase's channel.off() for broadcast events is tricky for specific callbacks.
          // If all listeners for a specific event are gone, we don't necessarily call channel.off()
          // unless we want to remove the generic broadcast handler, but that's shared.
          // The main channel cleanup is handled by ref counting.
          logWithTimestamp(`[SSTC] All listeners for event '${eventName}' on channel '${channelName}' removed.`, 'info');
        }
      }
      this.decrementChannelRefCount(channelName);
    };
  }

  private decrementChannelRefCount(channelName: string): void {
    if (!this.channelRefCounts.has(channelName)) {
      logWithTimestamp(`[SSTC] decrementChannelRefCount: No ref count found for ${channelName}.`, 'warn');
      return;
    }
    let count = this.channelRefCounts.get(channelName)! - 1;
    logWithTimestamp(`[SSTC] Channel ${channelName} ref count decremented to ${count}.`, 'info');

    if (count <= 0) {
      logWithTimestamp(`[SSTC] Channel ${channelName} ref count is 0. Unsubscribing and removing.`, 'info');
      const channel = this.channels.get(channelName);
      if (channel) {
        channel.unsubscribe()
          .then(() => logWithTimestamp(`[SSTC] Successfully unsubscribed from Supabase channel ${channelName}`, 'info`'))
          .catch(err => logWithTimestamp(`[SSTC] Error unsubscribing from Supabase channel ${channelName}: ${err}`, 'error'))
          .finally(() => {
            // Supabase client might remove the channel itself after unsubscribe, or we might do it.
            // For safety, we can try to remove it from the client if removeChannel is part of WebSocketService
            // if (this.supabaseRealtimeClient && typeof (this.supabaseRealtimeClient as any).removeChannel === 'function') {
            //   (this.supabaseRealtimeClient as any).removeChannel(channel);
            // }
          });
      }
      this.channels.delete(channelName);
      this.channelRefCounts.delete(channelName);
      this.specificEventListeners.delete(channelName); // Also clear listeners for this channel
      if (this.channels.size === 0 && this.serviceStatus !== CONNECTION_STATES.DISCONNECTED) {
         // If no active session channels remain, perhaps update overall status,
         // but base connection might still be fine. This needs careful thought.
         // For now, overall status is tied to base client/system channel.
      }
    } else {
      this.channelRefCounts.set(channelName, count);
    }
  }
  
  // Method for backward compatibility with old code
  public getLastPing(): number {
    return this.lastPingTime;
  }
  
  // Method to support broadcast functionality
  public async broadcast(
    channelBase: keyof typeof CHANNEL_NAMES, 
    eventName: string, 
    payload: any, 
    sessionId?: string
  ): Promise<RealtimeChannelSendResponse | null> {
    const sId = sessionId || this.currentSessionIdInternal;
    if (!sId) {
      logWithTimestamp('[SSTC] broadcast: No session ID available.', 'error');
      return null;
    }
    
    const channelName = this.getSessionChannelName(CHANNEL_NAMES[channelBase], sId);
    if (!channelName) return null;
    
    const channel = this.getOrCreateChannel(channelName);
    if (!channel || (channel.state !== 'joined' && channel.state !== 'joining')) {
      logWithTimestamp(`[SSTC] Cannot broadcast ${eventName}: Channel ${channelName} not ready. State: ${channel?.state}`, 'error');
      return null;
    }
    
    try {
      return await channel.send({
        type: 'broadcast',
        event: eventName,
        payload,
      });
    } catch (error) {
      logWithTimestamp(`[SSTC] Error broadcasting ${eventName}: ${error}`, 'error');
      return null;
    }
  }

  // --- Application Specific Methods ---
  public async broadcastNumberCalled(sessionId: string, number: number, allCalledNumbers: number[]): Promise<RealtimeChannelSendResponse | null> {
    if (!sessionId) {
        logWithTimestamp('[SSTC] broadcastNumberCalled: No sessionId provided.', 'error');
        return null;
    }
    const channelName = this.getSessionChannelName(CHANNEL_NAMES.GAME_UPDATES_BASE, sessionId);
    if (!channelName) return null;

    const payload: NumberCalledPayload = { sessionId, number, calledNumbers: allCalledNumbers, timestamp: Date.now() };
    logWithTimestamp(`[SSTC] Broadcasting ${EVENT_TYPES.NUMBER_CALLED} on ${channelName}`, 'info', payload);
    
    const channel = this.getOrCreateChannel(channelName); // Ensures channel is attempting to be active
    if (channel && (channel.state === 'joined' || channel.state === 'joining')) {
        try {
            return await channel.send({
                type: 'broadcast',
                event: EVENT_TYPES.NUMBER_CALLED,
                payload,
            });
        } catch (error) {
            logWithTimestamp(`[SSTC] Error broadcasting ${EVENT_TYPES.NUMBER_CALLED}: ${error}`, 'error');
            return null;
        }
    } else {
        logWithTimestamp(`[SSTC] Cannot broadcast ${EVENT_TYPES.NUMBER_CALLED}: Channel ${channelName} not ready. State: ${channel?.state}`, 'error');
        return null;
    }
  }
  
  public async submitClaimToDb(claimData: Omit<Database['public']['Tables']['claims']['Insert'], 'id' | 'claimed_at' | 'status'>): Promise<{ data: any; error: any }> {
    if (!this.supabaseRealtimeClient) {
      logWithTimestamp('[SSTC] submitClaimToDb: Supabase client not initialized.', 'error');
      return { data: null, error: new Error("Supabase client not initialized.") };
    }
    logWithTimestamp('[SSTC] submitClaimToDb: Inserting claim into DB.', 'info', claimData);
    
    try {
      const { data, error } = await supabase
        .from('claims')
        .insert({ ...claimData })
        .select()
        .single();

      if (error) {
        logWithTimestamp('[SSTC] submitClaimToDb: Error inserting claim to DB.', 'error', error);
      } else {
        logWithTimestamp('[SSTC] submitClaimToDb: Claim successfully inserted to DB.', 'info', data);
      }
      return { data, error };
    } catch (err) {
      logWithTimestamp('[SSTC] submitClaimToDb: Exception inserting claim to DB.', 'error', err);
      return { data: null, error: err };
    }
  }

  // Implementation for callNumber method
  public async callNumber(sessionId: string, numberToCall: number, currentCalledNumbers: number[]): Promise<void> {
    logWithTimestamp(`[SSTC] callNumber called for session ${sessionId}, number ${numberToCall}`, 'info');
    
    if (!sessionId || numberToCall === undefined || numberToCall === null) {
      logWithTimestamp(`[SSTC] callNumber: Missing required parameters`, 'error');
      return;
    }
    
    try {
      // First, update the database
      const { error } = await supabase
        .from('sessions_progress')
        .update({ 
          called_numbers: [...currentCalledNumbers, numberToCall],
          updated_at: new Date().toISOString()
        })
        .eq('session_id', sessionId);
      
      if (error) {
        logWithTimestamp(`[SSTC] callNumber: Error updating called numbers in database: ${error.message}`, 'error');
        return;
      }
      
      // Then broadcast the update
      await this.broadcastNumberCalled(sessionId, numberToCall, [...currentCalledNumbers, numberToCall]);
      
    } catch (error) {
      logWithTimestamp(`[SSTC] callNumber: Exception: ${error}`, 'error');
    }
  }
  
  // Implementation for submitBingoClaim
  public async submitBingoClaim(payload: ClaimSubmittedPayload): Promise<{ success: boolean; claimId?: string }> {
    if (!payload.sessionId || !payload.ticketSerial) {
      logWithTimestamp('[SSTC] submitBingoClaim: Missing required properties in payload', 'error');
      return { success: false };
    }
    
    try {
      // First insert the claim in the database
      const claimData = {
        session_id: payload.sessionId,
        player_id: payload.playerId,
        player_code: payload.playerCode,
        player_name: payload.playerName,
        ticket_serial: payload.ticketSerial,
        ticket_details: payload.ticketDetails,
        called_numbers_snapshot: payload.calledNumbers,
        pattern_claimed: payload.patternClaimed
      };
      
      const { data, error } = await this.submitClaimToDb(claimData);
      
      if (error) {
        logWithTimestamp('[SSTC] submitBingoClaim: Failed to insert claim to DB', 'error', error);
        return { success: false };
      }
      
      // Then broadcast the claim to the channel
      const channelName = this.getSessionChannelName(CHANNEL_NAMES.CLAIM_UPDATES_BASE, payload.sessionId);
      if (!channelName) return { success: false };
      
      const channel = this.getOrCreateChannel(channelName);
      if (channel && (channel.state === 'joined' || channel.state === 'joining')) {
        await channel.send({ 
          type: 'broadcast', 
          event: EVENT_TYPES.CLAIM_SUBMITTED, 
          payload 
        });
        return { success: true, claimId: data?.id };
      }
      
      return { success: false };
      
    } catch (error) {
      logWithTimestamp('[SSTC] submitBingoClaim: Exception', 'error', error);
      return { success: false };
    }
  }
  
  // Update player presence in the game
  public async updatePlayerPresence(sessionId: string, playerId: string, presenceData: any): Promise<boolean> {
    if (!sessionId || !playerId) {
      logWithTimestamp('[SSTC] updatePlayerPresence: Missing sessionId or playerId', 'error');
      return false;
    }
    
    try {
      const channelName = this.getSessionChannelName(CHANNEL_NAMES.PLAYER_PRESENCE_BASE, sessionId);
      if (!channelName) return false;
      
      const channel = this.getOrCreateChannel(channelName);
      if (!channel) return false;
      
      // Ensure channel is subscribed before tracking
      if (channel.state !== 'joined') {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Channel subscription timeout'));
          }, 5000);
          
          const onSubscribed = (status: string) => {
            if (status === 'SUBSCRIBED') {
              clearTimeout(timeout);
              channel.unsubscribe(onSubscribed);
              resolve();
            }
          };
          
          channel.subscribe(onSubscribed);
        });
      }
      
      // Track presence data for this player
      await channel.track({
        player_id: playerId,
        ...presenceData,
        online_at: new Date().toISOString()
      });
      
      return true;
    } catch (error) {
      logWithTimestamp('[SSTC] updatePlayerPresence: Exception', 'error', error);
      return false;
    }
  }
  
  // Sync called numbers for a session
  public async syncCalledNumbers(sessionId: string): Promise<number[] | null> {
    if (!sessionId) {
      return null;
    }
    
    try {
      const { data, error } = await supabase
        .from('sessions_progress')
        .select('called_numbers')
        .eq('session_id', sessionId)
        .single();
      
      if (error) {
        logWithTimestamp('[SSTC] syncCalledNumbers: Error fetching called numbers', 'error', error);
        return null;
      }
      
      return data?.called_numbers || [];
    } catch (error) {
      logWithTimestamp('[SSTC] syncCalledNumbers: Exception', 'error', error);
      return null;
    }
  }
}

export const getSingleSourceConnection = (): SingleSourceTrueConnections => {
  return SingleSourceTrueConnections.getInstance();
};

// Example usage if WebSocketService needs to be initialized with Supabase client from main.tsx
// This is a deviation if SSTC now creates its own Supabase client.
// The SSTC above creates its own via its initialize method.
// So this isServiceInitialized might be redundant if not used.
// export function isServiceInitialized() {
//   return getSingleSourceConnection().isServiceInitialized();
// }
