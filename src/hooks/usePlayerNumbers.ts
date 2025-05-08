
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
  
  // Use refs to track real-time data without triggering re-renders
  const calledNumbersRef = useRef<number[]>([]);
  const lastCalledNumberRef = useRef<number | null>(null);
  const lastCheckedLocalStorage = useRef<number>(Date.now());
  const pollingInterval = useRef<number | null>(null);
  
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
        
        // Only update if the data is newer or different
        const hasNewNumbers = storedNumbers.length !== calledNumbersRef.current.length;
        const hasNewLastNumber = storedLastNumber !== lastCalledNumberRef.current;
        
        if (hasNewNumbers || hasNewLastNumber) {
          logWithTimestamp(`Local storage poll found updates: ${storedNumbers.length} numbers, last: ${storedLastNumber}`, 'info');
          
          // Update our refs first
          calledNumbersRef.current = storedNumbers;
          lastCalledNumberRef.current = storedLastNumber;
          
          // Then update state to trigger a re-render
          setCalledNumbers([...storedNumbers]);
          setLastCalledNumber(storedLastNumber);
          setLastUpdateTime(timestamp);
          setIsConnected(true);
          
          // Update last checked time
          lastCheckedLocalStorage.current = Date.now();
        }
      }
    } catch (error) {
      logWithTimestamp(`Error checking local storage: ${error}`, 'error');
    }
  }, [sessionId]);
  
  // Function to fetch data from the database as a fallback
  const fetchFromDatabase = useCallback(async () => {
    if (!sessionId) return;
    
    try {
      logWithTimestamp('Fetching called numbers from database...', 'info');
      
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
        
        // Only update if database data is newer
        const isNewer = dbTimestamp > lastUpdateTime;
        const hasMoreNumbers = dbNumbers.length > calledNumbersRef.current.length;
        
        if (isNewer || hasMoreNumbers) {
          logWithTimestamp(`Database fetch found updates: ${dbNumbers.length} numbers, last: ${lastNumber}`, 'info');
          
          // Update refs
          calledNumbersRef.current = dbNumbers;
          lastCalledNumberRef.current = lastNumber;
          
          // Update state
          setCalledNumbers([...dbNumbers]);
          setLastCalledNumber(lastNumber);
          setLastUpdateTime(dbTimestamp);
          setIsConnected(true);
        }
      }
    } catch (error) {
      logWithTimestamp(`Error fetching from database: ${error}`, 'error');
    }
  }, [sessionId, lastUpdateTime]);

  // Subscribe to broadcast channels for real-time updates
  useEffect(() => {
    if (!sessionId) {
      logWithTimestamp('No session ID provided to usePlayerNumbers', 'info');
      return;
    }
    
    logWithTimestamp(`Setting up player number subscription for session ${sessionId}`, 'info');
    setIsConnected(true);
    
    try {
      // Get or create service for this session
      const service = getNumberCallingService(sessionId);
      
      // Initial state
      const initialNumbers = service.getCalledNumbers();
      const initialLastNumber = service.getLastCalledNumber();
      
      // Update refs first
      calledNumbersRef.current = initialNumbers;
      lastCalledNumberRef.current = initialLastNumber;
      
      // Then update state
      setCalledNumbers(initialNumbers);
      setLastCalledNumber(initialLastNumber);
      setLastUpdateTime(Date.now());
      
      // Subscribe to broadcast channel updates
      const numberChannelName = `number-broadcast-${sessionId}`;
      const resetChannelName = `game-reset-broadcast-${sessionId}`;
      
      // Listen for number broadcasts
      const numberChannel = supabase.channel(numberChannelName)
        .on('broadcast', { event: 'number-called' }, (payload) => {
          if (payload.payload && payload.payload.sessionId === sessionId) {
            const { lastCalledNumber, calledNumbers, timestamp } = payload.payload;
            const broadcastTime = new Date(timestamp).getTime();
            
            // Check if this is newer than what we have
            if (broadcastTime > lastUpdateTime || calledNumbers.length > calledNumbersRef.current.length) {
              logWithTimestamp(`Received broadcast update: ${calledNumbers.length} numbers, last: ${lastCalledNumber}`, 'info');
              
              // Update refs
              calledNumbersRef.current = calledNumbers;
              lastCalledNumberRef.current = lastCalledNumber;
              
              // Update state
              setCalledNumbers([...calledNumbers]);
              setLastCalledNumber(lastCalledNumber);
              setLastUpdateTime(broadcastTime);
              setIsConnected(true);
            }
          }
        })
        .subscribe();
      
      // Listen for game reset broadcasts
      const resetChannel = supabase.channel(resetChannelName)
        .on('broadcast', { event: 'game-reset' }, (payload) => {
          if (payload.payload && payload.payload.sessionId === sessionId) {
            const { timestamp } = payload.payload;
            const broadcastTime = new Date(timestamp).getTime();
            
            if (broadcastTime > lastUpdateTime) {
              logWithTimestamp(`Received game reset broadcast`, 'info');
              
              // Update refs
              calledNumbersRef.current = [];
              lastCalledNumberRef.current = null;
              
              // Update state
              setCalledNumbers([]);
              setLastCalledNumber(null);
              setLastUpdateTime(broadcastTime);
            }
          }
        })
        .subscribe();
      
      // Set up local storage polling for backup
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
      
      pollingInterval.current = window.setInterval(() => {
        // Only check local storage if it's been more than 1 second since last check
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
          logWithTimestamp(`Service subscription update: ${numbers.length} numbers, last: ${last}`, 'info');
          
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
        logWithTimestamp(`Cleaning up player number subscription for session ${sessionId}`, 'info');
        supabase.removeChannel(numberChannel);
        supabase.removeChannel(resetChannel);
        if (pollingInterval.current) {
          clearInterval(pollingInterval.current);
          pollingInterval.current = null;
        }
        unsubscribe();
      };
    } catch (error) {
      setIsConnected(false);
      logWithTimestamp(`Error in usePlayerNumbers: ${error}`, 'error');
    }
  }, [sessionId, fetchFromDatabase, checkLocalStorage]);

  // Immediately perform initial fetch from db
  useEffect(() => {
    if (sessionId) {
      fetchFromDatabase();
    }
  }, [sessionId, fetchFromDatabase]);

  // Manual refresh function
  const refreshNumbers = useCallback(() => {
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
