import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

// Helper function for consistent timestamped logging
const logWithTimestamp = (message: string) => {
  const now = new Date();
  const timestamp = now.toISOString();
  console.log(`[${timestamp}] - CHANGED 10:20 - ${message}`);
};

export function useRealTimeUpdates(sessionId: string | undefined, playerCode: string | undefined) {
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentWinPattern, setCurrentWinPattern] = useState<string | null>(null);
  const [prizeInfo, setPrizeInfo] = useState<any>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [gameStatus, setGameStatus] = useState<string>('pending');
  const lastUpdateTimestamp = useRef<number>(0);
  const { toast } = useToast();
  const instanceId = useRef(Date.now());
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  // Set up real-time listener for game updates
  useEffect(() => {
    if (!sessionId) return;
    
    logWithTimestamp(`Setting up real-time updates for session ${sessionId}, instance ${instanceId.current}`);
    setConnectionStatus('connecting');
    
    // Function to set up channel subscription
    const setupChannel = () => {
      const channel = supabase
        .channel(`game-updates-${sessionId}`)
        .on('broadcast', 
          { event: 'game-update' }, 
          (payload) => {
            logWithTimestamp(`Received game update: ${JSON.stringify(payload.payload)}`);
            
            if (payload.payload) {
              const { lastCalledNumber, calledNumbers, currentWinPattern, currentPrize, currentPrizeDescription, gameStatus, timestamp } = payload.payload;
              
              // Check if this update is newer than our last processed update
              if (timestamp && timestamp <= lastUpdateTimestamp.current) {
                logWithTimestamp(`Ignoring outdated update with timestamp: ${timestamp}`);
                return;
              }
              
              if (timestamp) {
                lastUpdateTimestamp.current = timestamp;
              }
              
              if (calledNumbers && Array.isArray(calledNumbers)) {
                logWithTimestamp(`Updating called numbers: ${calledNumbers.length} total`);
                setCalledNumbers(calledNumbers);
              }
              
              if (lastCalledNumber !== null && lastCalledNumber !== undefined) {
                logWithTimestamp(`New number called: ${lastCalledNumber}`);
                setLastCalledNumber(lastCalledNumber);
                
                // Show toast for new number
                toast({
                  title: "New Number Called",
                  description: `Number ${lastCalledNumber} has been called`,
                  duration: 3000
                });
              }
              
              if (currentWinPattern) {
                logWithTimestamp(`New win pattern: ${currentWinPattern}`);
                setCurrentWinPattern(currentWinPattern);
              }
              
              if (currentPrize || currentPrizeDescription) {
                logWithTimestamp(`New prize info: ${JSON.stringify({ currentPrize, currentPrizeDescription })}`);
                setPrizeInfo({
                  currentPrize,
                  currentPrizeDescription
                });
              }
              
              // Add handling for gameStatus updates
              if (gameStatus) {
                logWithTimestamp(`Game status updated: ${gameStatus}`);
                setGameStatus(gameStatus);
              }
            }
          }
        )
        .subscribe((status) => {
          logWithTimestamp(`Subscription status: ${status}`);
          
          if (status === 'SUBSCRIBED') {
            setConnectionStatus('connected');
            reconnectAttemptsRef.current = 0;
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setConnectionStatus('error');
            handleReconnect();
          }
        });
      
      return channel;
    };
    
    const handleReconnect = () => {
      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        logWithTimestamp(`Max reconnection attempts (${maxReconnectAttempts}) reached. Giving up.`);
        setConnectionStatus('error');
        return;
      }
      
      reconnectAttemptsRef.current++;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000); // Exponential backoff with 30s max
      logWithTimestamp(`Attempting to reconnect in ${delay/1000}s (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
      
      setTimeout(() => {
        logWithTimestamp("Attempting to reconnect...");
        setConnectionStatus('connecting');
        const newChannel = setupChannel();
        
        return () => {
          supabase.removeChannel(newChannel);
        };
      }, delay);
    };
    
    // Initial setup
    const channel = setupChannel();
    
    // Check initial session status from sessions_progress
    const checkInitialStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('sessions_progress')
          .select('game_status')
          .eq('session_id', sessionId)
          .single();
          
        if (error) {
          logWithTimestamp(`Error fetching initial game status: ${error.message}`);
          return;
        }
        
        if (data && data.game_status) {
          logWithTimestamp(`Initial game status from database: ${data.game_status}`);
          setGameStatus(data.game_status);
        }
      } catch (err) {
        logWithTimestamp(`Exception checking initial status: ${err}`);
      }
    };
    
    checkInitialStatus();
    
    return () => {
      logWithTimestamp(`Cleaning up subscription`);
      supabase.removeChannel(channel);
    };
  }, [sessionId, toast]);

  // Set up real-time listener for claim results (specific to this player)
  useEffect(() => {
    if (!sessionId || !playerCode) return;
    
    const claimsChannel = supabase
      .channel(`player-claims-${instanceId.current}`)
      .on('broadcast', 
        { event: 'claim-result' }, 
        (payload) => {
          if (payload.payload && payload.payload.playerId === playerCode) {
            const result = payload.payload.result;
            
            if (result === 'valid') {
              toast({
                title: "Claim Verified!",
                description: "Your bingo claim has been verified.",
                duration: 5000
              });
            } else if (result === 'rejected') {
              toast({
                title: "Claim Rejected",
                description: "Your claim was not valid. Please check your numbers.",
                variant: "destructive",
                duration: 5000
              });
            }
          }
        })
      .subscribe((status) => {
        logWithTimestamp(`Claims channel status: ${status}`);
      });
      
    return () => {
      supabase.removeChannel(claimsChannel);
    };
  }, [sessionId, playerCode, toast]);

  return {
    lastCalledNumber,
    calledNumbers,
    currentWinPattern,
    prizeInfo,
    connectionStatus,
    gameStatus
  };
}
