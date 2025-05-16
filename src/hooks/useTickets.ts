
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNetworkStatus } from '@/contexts/NetworkStatusContext';
import { getSingleSourceConnection } from '@/utils/SingleSourceTrueConnections';
import { logWithTimestamp } from '@/utils/logUtils';

export function useTickets(sessionId: string | null) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  
  const networkStatus = useNetworkStatus();
  
  // Set up connection
  useEffect(() => {
    if (!sessionId) return;
    
    // Use networkStatus for compatibility during refactoring
    networkStatus.reconnect();
    
  }, [sessionId, networkStatus]);
  
  // Fetch tickets
  useEffect(() => {
    if (!sessionId) {
      setIsLoading(false);
      return;
    }
    
    const fetchTickets = async () => {
      setIsLoading(true);
      
      try {
        const { data, error } = await supabase
          .from('assigned_tickets')
          .select('*')
          .eq('session_id', sessionId);
          
        if (error) {
          console.error('Error fetching tickets:', error);
          return;
        }
        
        setTickets(data || []);
      } catch (error) {
        console.error('Exception fetching tickets:', error);
      } finally {
        setIsLoading(false);
        setLastRefresh(new Date());
      }
    };
    
    fetchTickets();
  }, [sessionId]);
  
  // Refresh tickets
  const refreshTickets = useCallback(async () => {
    if (!sessionId) return;
    
    try {
      const { data, error } = await supabase
        .from('assigned_tickets')
        .select('*')
        .eq('session_id', sessionId);
        
      if (error) {
        console.error('Error refreshing tickets:', error);
        return;
      }
      
      setTickets(data || []);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Exception refreshing tickets:', error);
    }
  }, [sessionId]);
  
  return {
    tickets,
    isLoading,
    lastRefresh,
    refreshTickets
  };
}
