import { useState, useEffect, useCallback, useRef } from 'react';
import { getNumberCallingService } from '@/services/NumberCallingService';
import { logWithTimestamp } from '@/utils/logUtils';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook for players to receive called numbers
 * Optimized for stable display and reliable updates using enhanced local storage polling
 */
export function usePlayerNumbers(sessionId: string | undefined) {
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  const [lastBroadcastId, setLastBroadcastId] = useState<string | null>(null);
  
  // Use refs to track real-time data without triggering re-renders
  const calledNumbersRef = useRef<number[]>([]);
  const lastCalledNumberRef = useRef<number | null>(null);
  const lastCheckedLocalStorage = useRef<number>(Date.now());
  const pollingInterval = useRef<number | null>(null);
  const channelRefs = useRef<any[]>([]);
  const listenerActive = useRef<boolean>(false);
  
  // Function to check for local storage updates
  const checkLocalStorage = useCallback(() => {
    if (!sessionId) return;
    
    try {
      const storageKey = `bingo-numbers-session-${sessionId}`;
      const stored = localStorage.getItem(storageKey);
      
      if (stored) {
        const parsedData = JSON.parse(stored);
        const storedNumbers = parsedData.calledNumbers || [];
        const storedLastNumber = parsedData.lastCalledNumber;
        const timestamp = new Date(parsedData.timestamp).getTime();
        const broadcastId = parsedData.broadcastId || null;
        
        logWithTimestamp(`[PlayerNumbers] Checking local storage: found ${storedNumbers.length} numbers, last: ${storedLastNumber}, broadcastId: ${broadcastId}`, 'debug');
        
        // Skip if we've already processed this broadcast
        if (broadcastId && broadcastId === lastBroadcastId) {
          logWithTimestamp(`[PlayerNumbers] Skipping already processed broadcast: ${broadcastId}`, 'debug');
          return;
        }
        
        // Only update if the data is newer or different
        const hasNewNumbers = storedNumbers.length !== calledNumbersRef.current.length;
        const hasNewLastNumber = storedLastNumber !== lastCalledNumberRef.current;
        const isNewer = timestamp > lastUpdateTime;
        
        if (hasNewNumbers || hasNewLastNumber || isNewer) {
          logWithTimestamp(`[PlayerNumbers] Local storage poll found updates: ${storedNumbers.length} numbers, last: ${storedLastNumber}`, 'info');
          
          // Update our refs first
          calledNumbersRef.current = storedNumbers;
          lastCalledNumberRef.current = storedLastNumber;
          
          // Then update state to trigger a re-render
          setCalledNumbers([...storedNumbers]);
          setLastCalledNumber(storedLastNumber);
          setLastUpdateTime(timestamp);
          setIsConnected(true);
          
          if (broadcastId) {
            setLastBroadcastId(broadcastId);
          }
          
          // Update last checked time
          lastCheckedLocalStorage.current = Date.now();
        }
      }
    } catch (error) {
      logWithTimestamp(`[PlayerNumbers] Error checking local storage: ${error}`, 'error');
    }
  }, [sessionId, lastUpdateTime, lastBroadcastId]);
  
  // Storage event listener for cross-tab communication
  const handleStorageEvent = useCallback((event: StorageEvent) => {
    if (!sessionId) return;
    
    const storageKey = `bingo-numbers-session-${sessionId}`;
    
    if (event.key === storageKey && event.newValue) {
      try {
        const parsedData = JSON.parse(event.newValue);
        const storedNumbers = parsedData.calledNumbers || [];
        const storedLastNumber = parsedData.lastCalledNumber;
        const timestamp = new Date(parsedData.timestamp).getTime();
        const broadcastId = parsedData.broadcastId || null;
        
        logWithTimestamp(`[PlayerNumbers] Storage event detected with ${storedNumbers.length} numbers, last: ${storedLastNumber}`, 'debug');
        
        // Skip if we've already processed this broadcast
        if (broadcastId && broadcastId === lastBroadcastId) {
          logWithTimestamp(`[PlayerNumbers] Skipping already processed broadcast from storage event: ${broadcastId}`, 'debug');
          return;
        }
        
        // Only update if the data is newer or different
        const hasNewNumbers = storedNumbers.length !== calledNumbersRef.current.length;
        const hasNewLastNumber = storedLastNumber !== lastCalledNumberRef.current;
        const isNewer = timestamp > lastUpdateTime;
        
        if (hasNewNumbers || hasNewLastNumber || isNewer) {
          logWithTimestamp(`[PlayerNumbers] Storage event updating numbers: ${storedNumbers.length} numbers, last: ${storedLastNumber}`, 'info');
          
          // Update our refs first
          calledNumbersRef.current = storedNumbers;
          lastCalledNumberRef.current = storedLastNumber;
          
          // Then update state to trigger a re-render
          setCalledNumbers([...storedNumbers]);
          setLastCalledNumber(storedLastNumber);
          setLastUpdateTime(timestamp);
          setIsConnected(true);
          
          if (broadcastId) {
            setLastBroadcastId(broadcastId);
          }
        }
      } catch (error) {
        logWithTimestamp(`[PlayerNumbers] Error handling storage event: ${error}`, 'error');
      }
    }
  }, [sessionId, lastUpdateTime, lastBroadcastId]);
  
  // Function to fetch data from the database as a fallback
  const fetchFromDatabase = useCallback(async () => {
    if (!sessionId) return;
    
    try {
      logWithTimestamp('[PlayerNumbers] Fetching called numbers from database...', 'info');
      
      const { data, error } = await supabase
        .from('sessions_progress')
        .select('called_numbers, updated_at')
        .eq('session_id', sessionId)
        .single();
        
      if (error) throw error;
      
      if (data && data.called_numbers) {
        const dbNumbers = data.called_numbers;
        const lastNumber = dbNumbers.length > 0 ? dbNumbers[dbNumbers.length - 1] : null;
        const dbTimestamp = new Date(data.updated_at).getTime();
        
        logWithTimestamp(`[PlayerNumbers] Database has ${dbNumbers.length} numbers, last: ${lastNumber}`, 'debug');
        
        // Only update if database data is newer
        const isNewer = dbTimestamp > lastUpdateTime;
        const hasMoreNumbers = dbNumbers.length > calledNumbersRef.current.length;
        
        if (isNewer || hasMoreNumbers) {
          logWithTimestamp(`[PlayerNumbers] Database fetch found updates: ${dbNumbers.length} numbers, last: ${lastNumber}`, 'info');
          
          // Update refs
          calledNumbersRef.current = dbNumbers;
          lastCalledNumberRef.current = lastNumber;
          
          // Update state
          setCalledNumbers([...dbNumbers]);
          setLastCalledNumber(lastNumber);
          setLastUpdateTime(dbTimestamp);
          setIsConnected(true);
          
          // Also update local storage to keep it in sync
          const storageKey = `bingo-numbers-session-${sessionId}`;
          localStorage.setItem(storageKey, JSON.stringify({
            sessionId,
            calledNumbers: dbNumbers,
            lastCalledNumber: lastNumber,
            timestamp: new Date(data.updated_at).toISOString(),
            synced: true
          }));
        }
      }
    } catch (error) {
      logWithTimestamp(`[PlayerNumbers] Error fetching from database: ${error}`, 'error');
    }
  }, [sessionId, lastUpdateTime]);

  // Handles received broadcasts from caller
  const handleBroadcastEvent = useCallback((payload: any) => {
    // Check if it's for our session
    if (payload.payload && payload.payload.sessionId === sessionId) {
      const { lastCalledNumber, calledNumbers, timestamp, broadcastId } = payload.payload;
      
      // Skip if we've already processed this broadcast
      if (broadcastId && broadcastId === lastBroadcastId) {
        logWithTimestamp(`[PlayerNumbers] Skipping duplicate broadcast: ${broadcastId}`, 'debug');
        return;
      }
      
      const broadcastTime = new Date(timestamp).getTime();
      
      // Check if this is newer than what we have
      if (broadcastTime > lastUpdateTime || calledNumbers.length > calledNumbersRef.current.length) {
        logWithTimestamp(`[PlayerNumbers] Received broadcast update: ${calledNumbers.length} numbers, last: ${lastCalledNumber}, broadcastId: ${broadcastId}`, 'info');
        
        // Update refs
        calledNumbersRef.current = calledNumbers;
        lastCalledNumberRef.current = lastCalledNumber;
        
        // Update state
        setCalledNumbers([...calledNumbers]);
        setLastCalledNumber(lastCalledNumber);
        setLastUpdateTime(broadcastTime);
        setIsConnected(true);
        
        if (broadcastId) {
          setLastBroadcastId(broadcastId);
        }
        
        // Also update local storage
        const storageKey = `bingo-numbers-session-${sessionId}`;
        localStorage.setItem(storageKey, JSON.stringify({
          sessionId,
          calledNumbers,
          lastCalledNumber,
          timestamp,
          broadcastId,
          synced: true
        }));
      }
    }
  }, [sessionId, lastUpdateTime, lastBroadcastId]);
  
  // Subscribe to broadcast channels for real-time updates
  useEffect(() => {
    if (!sessionId) {
      logWithTimestamp('[PlayerNumbers] No session ID provided to usePlayerNumbers', 'info');
      return;
    }
    
    if (listenerActive.current) {
      logWithTimestamp('[PlayerNumbers] Listener already active, skipping setup', 'debug');
      return;
    }
    
    logWithTimestamp(`[PlayerNumbers] Setting up player number subscription for session ${sessionId}`, 'info');
    setIsConnected(true);
    listenerActive.current = true;
    
    try {
      // Get or create service for this session
      const service = getNumberCallingService(sessionId);
      
      // Initial state
      const initialNumbers = service.getCalledNumbers();
      const initialLastNumber = service.getLastCalledNumber();
      
      logWithTimestamp(`[PlayerNumbers] Initial state from service: ${initialNumbers.length} numbers, last: ${initialLastNumber}`, 'debug');
      
      // Update refs first
      calledNumbersRef.current = initialNumbers;
      lastCalledNumberRef.current = initialLastNumber;
      
      // Then update state
      setCalledNumbers(initialNumbers);
      setLastCalledNumber(initialLastNumber);
      setLastUpdateTime(Date.now());
      
      // Set up multiple broadcast channel listeners for reliability
      const channelNames = [
        `number-broadcast-${sessionId}`,
        `number-broadcast-backup-${sessionId}`,
        `game-reset-broadcast-${sessionId}`,
        `game-reset-backup-${sessionId}`
      ];
      
      // Clear any previous channels
      channelRefs.current.forEach(channel => {
        try {
          if (channel) {
            supabase.removeChannel(channel);
          }
        } catch (e) {
          // Ignore errors when cleaning up
        }
      });
      channelRefs.current = [];
      
      // Listen for number broadcasts (primary channel)
      const numberChannel = supabase.channel(`number-broadcast-${sessionId}`)
        .on('broadcast', { event: 'number-called' }, handleBroadcastEvent)
        .subscribe(status => {
          logWithTimestamp(`[PlayerNumbers] Number broadcast channel status: ${status}`, 'debug');
          setIsConnected(status === 'SUBSCRIBED');
        });
      
      channelRefs.current.push(numberChannel);
      
      // Listen for number broadcasts (backup channel)
      const backupNumberChannel = supabase.channel(`number-broadcast-backup-${sessionId}`)
        .on('broadcast', { event: 'number-called-backup' }, handleBroadcastEvent)
        .subscribe(status => {
          logWithTimestamp(`[PlayerNumbers] Backup number broadcast channel status: ${status}`, 'debug');
        });
      
      channelRefs.current.push(backupNumberChannel);
      
      // Listen for game reset broadcasts
      const resetChannel = supabase.channel(`game-reset-broadcast-${sessionId}`)
        .on('broadcast', { event: 'game-reset' }, (payload) => {
          if (payload.payload && payload.payload.sessionId === sessionId) {
            const { timestamp, broadcastId } = payload.payload;
            
            // Skip if we've already processed this broadcast
            if (broadcastId && broadcastId === lastBroadcastId) {
              logWithTimestamp(`[PlayerNumbers] Skipping duplicate reset broadcast: ${broadcastId}`, 'debug');
              return;
            }
            
            const broadcastTime = new Date(timestamp).getTime();
            
            if (broadcastTime > lastUpdateTime) {
              logWithTimestamp(`[PlayerNumbers] Received game reset broadcast, id: ${broadcastId}`, 'info');
              
              // Update refs
              calledNumbersRef.current = [];
              lastCalledNumberRef.current = null;
              
              // Update state
              setCalledNumbers([]);
              setLastCalledNumber(null);
              setLastUpdateTime(broadcastTime);
              
              if (broadcastId) {
                setLastBroadcastId(broadcastId);
              }
            }
          }
        })
        .subscribe();
      
      channelRefs.current.push(resetChannel);
      
      // Listen for backup reset broadcasts
      const backupResetChannel = supabase.channel(`game-reset-backup-${sessionId}`)
        .on('broadcast', { event: 'game-reset-backup' }, (payload) => {
          if (payload.payload && payload.payload.sessionId === sessionId) {
            const { timestamp, broadcastId } = payload.payload;
            
            // Skip if we've already processed this broadcast
            if (broadcastId && broadcastId === lastBroadcastId) {
              logWithTimestamp(`[PlayerNumbers] Skipping duplicate reset backup broadcast: ${broadcastId}`, 'debug');
              return;
            }
            
            const broadcastTime = new Date(timestamp).getTime();
            
            if (broadcastTime > lastUpdateTime) {
              logWithTimestamp(`[PlayerNumbers] Received backup game reset broadcast, id: ${broadcastId}`, 'info');
              
              // Update refs
              calledNumbersRef.current = [];
              lastCalledNumberRef.current = null;
              
              // Update state
              setCalledNumbers([]);
              setLastCalledNumber(null);
              setLastUpdateTime(broadcastTime);
              
              if (broadcastId) {
                setLastBroadcastId(broadcastId);
              }
            }
          }
        })
        .subscribe();
      
      channelRefs.current.push(backupResetChannel);
      
      // Add storage event listener
      window.addEventListener('storage', handleStorageEvent);
      
      // Set up local storage polling
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
      
      pollingInterval.current = window.setInterval(() => {
        // Check local storage on a regular basis as a backup mechanism
        const now = Date.now();
        if (now - lastCheckedLocalStorage.current > 1000) {
          checkLocalStorage();
          lastCheckedLocalStorage.current = now;
        }
        
        // Every 30 seconds, fetch from the database as well
        if (now - lastCheckedLocalStorage.current > 30000) {
          fetchFromDatabase();
        }
      }, 1000) as unknown as number;
      
      // Subscribe to service updates directly
      const unsubscribe = service.subscribe((numbers, last) => {
        // Only update if there's an actual change
        const isActualUpdate = 
          last !== lastCalledNumberRef.current || 
          numbers.length !== calledNumbersRef.current.length;
        
        if (isActualUpdate) {
          logWithTimestamp(`[PlayerNumbers] Service subscription update: ${numbers.length} numbers, last: ${last}`, 'info');
          
          // Update refs
          calledNumbersRef.current = numbers;
          lastCalledNumberRef.current = last;
          
          // Update state
          setCalledNumbers([...numbers]);
          setLastCalledNumber(last);
          setLastUpdateTime(Date.now());
        }
      });
      
      // Cleanup
      return () => {
        logWithTimestamp(`[PlayerNumbers] Cleaning up player number subscription for session ${sessionId}`, 'info');
        listenerActive.current = false;
        
        // Clean up all channels
        channelRefs.current.forEach(channel => {
          try {
            supabase.removeChannel(channel);
          } catch (e) {
            // Ignore errors when cleaning up
          }
        });
        channelRefs.current = [];
        
        // Remove storage event listener
        window.removeEventListener('storage', handleStorageEvent);
        
        if (pollingInterval.current) {
          clearInterval(pollingInterval.current);
          pollingInterval.current = null;
        }
        
        unsubscribe();
      };
    } catch (error) {
      setIsConnected(false);
      logWithTimestamp(`[PlayerNumbers] Error in usePlayerNumbers: ${error}`, 'error');
      listenerActive.current = false;
    }
  }, [sessionId, fetchFromDatabase, checkLocalStorage, handleBroadcastEvent, handleStorageEvent, lastBroadcastId]);

  // Immediately perform initial fetch from db
  useEffect(() => {
    if (sessionId) {
      fetchFromDatabase();
    }
  }, [sessionId, fetchFromDatabase]);

  // Manual refresh function
  const refreshNumbers = useCallback(() => {
    logWithTimestamp('[PlayerNumbers] Manually refreshing numbers', 'info');
    checkLocalStorage();
    fetchFromDatabase();
  }, [checkLocalStorage, fetchFromDatabase]);

  return {
    calledNumbers,
    lastCalledNumber,
    isConnected,
    lastUpdateTime,
    refreshNumbers
  };
}
