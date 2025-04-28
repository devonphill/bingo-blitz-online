
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export function useRealTimeUpdates(sessionId: string | undefined, playerCode: string | undefined) {
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentWinPattern, setCurrentWinPattern] = useState<string | null>(null);
  const [prizeInfo, setPrizeInfo] = useState<any>(null);
  const lastUpdateTimestamp = useRef<number>(0);
  const { toast } = useToast();
  const instanceId = useRef(Date.now());

  // Set up real-time listener for number updates
  useEffect(() => {
    if (!sessionId) return;
    
    console.log(`[useRealTimeUpdates] Setting up real-time updates for session ${sessionId}, instance ${instanceId.current}`);
    
    // Use the exact same channel name as the one used in LiveGameView for broadcasting
    const numberChannel = supabase
      .channel('number-broadcast')
      .on('broadcast', 
        { event: 'number-called' }, 
        (payload) => {
          console.log("[useRealTimeUpdates] Received number broadcast:", payload);
          
          if (payload.payload && payload.payload.sessionId === sessionId) {
            const { calledNumbers: newNumbers, lastCalledNumber, activeWinPattern, prizeInfo, timestamp } = payload.payload;
            
            // Check if this update is newer than our last processed update
            if (timestamp && timestamp <= lastUpdateTimestamp.current) {
              console.log(`[useRealTimeUpdates] Ignoring outdated update with timestamp: ${timestamp}`);
              return;
            }
            
            if (timestamp) {
              lastUpdateTimestamp.current = timestamp;
            }
            
            if (newNumbers && Array.isArray(newNumbers)) {
              console.log(`[useRealTimeUpdates] Updating called numbers: ${newNumbers.length} total`);
              setCalledNumbers(newNumbers);
            }
            
            if (lastCalledNumber !== null && lastCalledNumber !== undefined) {
              console.log(`[useRealTimeUpdates] New number called: ${lastCalledNumber}`);
              setLastCalledNumber(lastCalledNumber);
              
              // Show toast for new number
              toast({
                title: "New Number Called",
                description: `Number ${lastCalledNumber} has been called`,
                duration: 3000
              });
            }
            
            if (activeWinPattern) {
              console.log(`[useRealTimeUpdates] New win pattern: ${activeWinPattern}`);
              setCurrentWinPattern(activeWinPattern);
            }
            
            if (prizeInfo) {
              console.log(`[useRealTimeUpdates] New prize info:`, prizeInfo);
              setPrizeInfo(prizeInfo);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log(`[useRealTimeUpdates] Subscription status: ${status}`);
      });
    
    return () => {
      console.log(`[useRealTimeUpdates] Cleaning up subscription`);
      supabase.removeChannel(numberChannel);
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
        console.log(`[useRealTimeUpdates] Claims channel status: ${status}`);
      });
      
    return () => {
      supabase.removeChannel(claimsChannel);
    };
  }, [sessionId, playerCode, toast]);

  return {
    lastCalledNumber,
    calledNumbers,
    currentWinPattern,
    prizeInfo
  };
}
