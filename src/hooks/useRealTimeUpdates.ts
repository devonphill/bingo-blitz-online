
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';
import { logWithTimestamp } from '@/utils/logUtils';

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
  const channelRef = useRef<any>(null);
  const inProgressConnection = useRef<boolean>(false);

  // Set up real-time listener for game updates
  useEffect(() => {
    if (!sessionId) return;
    
    logWithTimestamp(`Setting up real-time updates for session ${sessionId}, instance ${instanceId.current}`);
    setConnectionStatus('connecting');
    inProgressConnection.current = true;
    
    // Function to set up channel subscription
    const setupChannel = () => {
      // Remove any existing channel
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      
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
        .on('broadcast', { event: 'caller-online' }, () => {
          logWithTimestamp('Caller is online');
          setConnectionStatus('connected');
          reconnectAttemptsRef.current = 0;
          
          toast({
            title: "Caller Connected",
            description: "The caller is now online",
            duration: 3000
          });
        })
        .subscribe((status) => {
          logWithTimestamp(`Game updates subscription status: ${status}`);
          inProgressConnection.current = false;
          
          if (status === 'SUBSCRIBED') {
            setConnectionStatus('connected');
            reconnectAttemptsRef.current = 0;
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setConnectionStatus('error');
            handleReconnect();
          } else if (status === 'CLOSED') {
            setConnectionStatus('disconnected');
            handleReconnect();
          }
        });
      
      channelRef.current = channel;
      return channel;
    };
    
    const handleReconnect = () => {
      if (reconnectAttemptsRef.current >= maxReconnectAttempts || inProgressConnection.current) {
        logWithTimestamp(`Max reconnection attempts (${maxReconnectAttempts}) reached or connection in progress. Giving up.`);
        setConnectionStatus('error');
        return;
      }
      
      reconnectAttemptsRef.current++;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000); // Exponential backoff with 30s max
      logWithTimestamp(`Attempting to reconnect in ${delay/1000}s (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
      
      setTimeout(() => {
        if (!inProgressConnection.current) {
          logWithTimestamp("Attempting to reconnect...");
          setConnectionStatus('connecting');
          inProgressConnection.current = true;
          setupChannel();
        }
      }, delay);
    };
    
    // Initial setup
    setupChannel();
    
    // Check initial session status from sessions_progress
    const checkInitialStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('sessions_progress')
          .select('game_status, called_numbers, current_win_pattern')
          .eq('session_id', sessionId)
          .single();
          
        if (error) {
          logWithTimestamp(`Error fetching initial game status: ${error.message}`);
          return;
        }
        
        if (data) {
          logWithTimestamp(`Initial game data from database: ${JSON.stringify(data)}`);
          
          if (data.game_status) {
            logWithTimestamp(`Initial game status from database: ${data.game_status}`);
            setGameStatus(data.game_status);
          }
          
          if (data.called_numbers && Array.isArray(data.called_numbers)) {
            logWithTimestamp(`Initial called numbers from database: ${data.called_numbers.length} numbers`);
            setCalledNumbers(data.called_numbers);
            
            if (data.called_numbers.length > 0) {
              setLastCalledNumber(data.called_numbers[data.called_numbers.length - 1]);
            }
          }
          
          if (data.current_win_pattern) {
            logWithTimestamp(`Initial win pattern from database: ${data.current_win_pattern}`);
            setCurrentWinPattern(data.current_win_pattern);
          }
        }
      } catch (err) {
        logWithTimestamp(`Exception checking initial status: ${err}`);
      }
    };
    
    checkInitialStatus();
    
    return () => {
      logWithTimestamp(`Cleaning up real-time subscription`);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      inProgressConnection.current = false;
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
