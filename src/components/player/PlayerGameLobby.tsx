
import React, { useEffect, useRef, useState } from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getWebSocketService, CHANNEL_NAMES, EVENT_TYPES } from '@/services/websocket';
import { logWithTimestamp } from '@/utils/logUtils';

interface PlayerGameLobbyProps {
  sessionName: string;
  sessionId: string;
  playerName?: string;
  onRefreshStatus: () => void;
  errorMessage: string | null;
  gameStatus?: string | null;
}

/**
 * Player game lobby component - shows waiting state before game goes live
 */
const PlayerGameLobby: React.FC<PlayerGameLobbyProps> = ({
  sessionName,
  sessionId,
  playerName = 'Player',
  onRefreshStatus,
  errorMessage,
  gameStatus
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();
  const webSocketService = useRef(getWebSocketService());
  const [manualRefreshCount, setManualRefreshCount] = useState(0);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<string | null>(null);
  const instanceId = useRef(`lobby-${Math.random().toString(36).substring(2, 7)}`);
  
  // Setup refresh timer (every 15 seconds)
  useEffect(() => {
    // Initial refresh
    onRefreshStatus();
    
    // Set up timer for auto-refresh
    refreshTimerRef.current = setInterval(() => {
      logWithTimestamp(`[${instanceId.current}] Auto-refreshing lobby status`, 'info');
      onRefreshStatus();
    }, 15000);  // 15 seconds
    
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [onRefreshStatus]);

  // Setup WebSocket listener for session state changes
  useEffect(() => {
    if (!sessionId) return;
    
    logWithTimestamp(`[${instanceId.current}] Setting up session state change listener for session ${sessionId}`, 'info');
    
    // Subscribe to session state changes
    channelRef.current = webSocketService.current.subscribe(CHANNEL_NAMES.SESSION_UPDATES, (data) => {
      if (!data || data.sessionId !== sessionId) return;
      
      logWithTimestamp(`[${instanceId.current}] Received session update: ${JSON.stringify(data)}`, 'info');
      
      // If the game is going live, trigger a refresh
      if ((data.type === EVENT_TYPES.GO_LIVE || data.type === EVENT_TYPES.SESSION_STATE_CHANGE) && 
          data.status === 'active' && 
          data.lifecycleState === 'live') {
        logWithTimestamp(`[${instanceId.current}] Game is now live! Refreshing...`, 'info');
        
        // Show a toast notification
        toast({
          title: "Game is starting!",
          description: "The game is now live. Loading your tickets...",
        });
        
        // Refresh the game status
        onRefreshStatus();
        
        // Increase manual refresh counter to force a refresh
        setManualRefreshCount(prev => prev + 1);
      }
    });
    
    return () => {
      if (channelRef.current) {
        webSocketService.current.unsubscribe(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [sessionId, onRefreshStatus, toast]);

  // Handle manual refresh
  const handleRefresh = () => {
    setRefreshing(true);
    onRefreshStatus();
    setManualRefreshCount(prev => prev + 1);
    
    // Show a toast notification
    toast({
      title: "Refreshing",
      description: "Checking if the game has started...",
    });
    
    // Reset refreshing state after a short delay
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-lg text-center">
        <h1 className="text-2xl font-bold mb-2">{sessionName}</h1>
        <p className="text-gray-600 mb-4">
          Welcome, {playerName}!
        </p>
        
        {errorMessage ? (
          <div className="p-3 mb-4 bg-red-100 text-red-800 rounded-lg flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span>{errorMessage}</span>
          </div>
        ) : (
          <>
            <div className="py-8 flex flex-col items-center">
              <LoadingSpinner size="lg" />
              <p className="mt-4 text-gray-700">Waiting for the game to begin...</p>
              <p className="mt-2 text-sm text-gray-500">
                Status: {gameStatus === 'active' ? 'Ready to Start' : gameStatus || 'Pending'}
              </p>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              The game will start automatically when the caller begins the session.
            </p>
          </>
        )}
        
        <Button 
          onClick={handleRefresh} 
          disabled={refreshing} 
          className="w-full"
          variant="outline"
        >
          {refreshing ? (
            <LoadingSpinner size="sm" className="mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh Status
        </Button>
        
        <p className="mt-4 text-xs text-gray-400">
          Game will start automatically - no need to refresh.
        </p>
      </div>
    </div>
  );
};

export default PlayerGameLobby;
