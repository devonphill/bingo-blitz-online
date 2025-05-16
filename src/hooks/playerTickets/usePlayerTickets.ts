
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';

export interface PlayerTicket {
  id: string;
  serial: string;
  perm: number;
  position: number;
  layout_mask: number | null;
  layoutMask?: number;
  numbers: number[][];
  markedPositions?: { row: number; col: number; number: number }[];
  isWinning?: boolean;
}

interface UsePlayerTicketsResult {
  playerTickets: PlayerTicket[];
  isLoadingTickets: boolean;
  updateWinningStatus: (calledNumbers: number[], winPattern: string) => void;
  currentWinningTickets: PlayerTicket[];
}

export const usePlayerTickets = (
  sessionId: string | null,
  playerId?: string,
  playerCode?: string
): UsePlayerTicketsResult => {
  const [playerTickets, setPlayerTickets] = useState<PlayerTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);
  const [currentWinningTickets, setCurrentWinningTickets] = useState<PlayerTicket[]>([]);
  
  // Fetch tickets
  useEffect(() => {
    if (!sessionId || (!playerId && !playerCode)) {
      setIsLoadingTickets(false);
      return;
    }
    
    const fetchTickets = async () => {
      setIsLoadingTickets(true);
      try {
        // Check localStorage first for faster loading
        const storedTicketsKey = `player_tickets_${sessionId}_${playerId || playerCode}`;
        const storedTickets = localStorage.getItem(storedTicketsKey);
        
        if (storedTickets) {
          const parsedTickets = JSON.parse(storedTickets);
          setPlayerTickets(parsedTickets);
          setIsLoadingTickets(false);
        }
        
        // Query by player_id if available, otherwise by player_code
        let query = supabase
          .from('assigned_tickets')
          .select('*')
          .eq('session_id', sessionId);
        
        if (playerId) {
          query = query.eq('player_id', playerId);
        } else if (playerCode) {
          // Getting tickets by player code requires a join
          const { data: player } = await supabase
            .from('players')
            .select('id')
            .eq('code', playerCode)
            .single();
            
          if (player) {
            query = supabase
              .from('assigned_tickets')
              .select('*')
              .eq('session_id', sessionId)
              .eq('player_id', player.id);
          } else {
            setIsLoadingTickets(false);
            return;
          }
        }
        
        const { data, error } = await query;
        
        if (error) {
          console.error('Error fetching tickets:', error);
          setIsLoadingTickets(false);
          return;
        }
        
        if (data && data.length > 0) {
          // Process data to ensure correct format
          const processedTickets = data.map((ticket: any) => ({
            ...ticket,
            id: ticket.id || ticket.serial,
            layoutMask: ticket.layout_mask || ticket.layoutMask || 0,
            markedPositions: ticket.markedPositions || [],
            isWinning: false
          }));
          
          setPlayerTickets(processedTickets);
          
          // Save to localStorage for faster loading next time
          localStorage.setItem(storedTicketsKey, JSON.stringify(processedTickets));
        }
      } catch (error) {
        console.error('Error fetching player tickets:', error);
      } finally {
        setIsLoadingTickets(false);
      }
    };
    
    fetchTickets();
  }, [sessionId, playerId, playerCode]);
  
  // Check if a ticket is winning based on the pattern
  const checkTicketWinning = useCallback((ticket: PlayerTicket, calledNumbers: number[], winPattern: string) => {
    // Implement pattern checking logic based on winPattern (one-line, two-line, full-house, etc.)
    // For now, a simplified check
    if (!ticket.numbers) return false;
    
    let winningTicket = false;
    
    switch (winPattern) {
      case 'one-line':
        // Check if any row has all numbers called
        winningTicket = ticket.numbers.some(row => 
          row.every(num => num === 0 || calledNumbers.includes(num))
        );
        break;
      case 'two-line':
        // Check if at least two rows have all numbers called
        let completedRows = 0;
        for (const row of ticket.numbers) {
          if (row.every(num => num === 0 || calledNumbers.includes(num))) {
            completedRows++;
          }
        }
        winningTicket = completedRows >= 2;
        break;
      case 'full-house':
        // Check if all numbers are called
        winningTicket = ticket.numbers.flat().every(num => 
          num === 0 || calledNumbers.includes(num)
        );
        break;
      default:
        winningTicket = false;
    }
    
    return winningTicket;
  }, []);
  
  // Update winning status of tickets
  const updateWinningStatus = useCallback((calledNumbers: number[], winPattern: string) => {
    if (!playerTickets.length || !winPattern) return;
    
    const updatedTickets = playerTickets.map(ticket => ({
      ...ticket,
      isWinning: checkTicketWinning(ticket, calledNumbers, winPattern)
    }));
    
    const winningTickets = updatedTickets.filter(t => t.isWinning);
    
    setPlayerTickets(updatedTickets);
    setCurrentWinningTickets(winningTickets);
    
    if (winningTickets.length > 0) {
      logWithTimestamp(`Found ${winningTickets.length} potential winning tickets`, 'info');
    }
  }, [playerTickets, checkTicketWinning]);
  
  return {
    playerTickets,
    isLoadingTickets,
    updateWinningStatus,
    currentWinningTickets
  };
};
