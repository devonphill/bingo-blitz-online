
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { useSessionContext } from '@/contexts/SessionProvider';
import { logWithTimestamp } from '@/utils/logUtils';
import { usePlayerTickets } from '@/hooks/playerTickets/usePlayerTickets';
import { useWebSocket } from '@/hooks/useWebSocket';
import PlayerTicketView from './PlayerTicketView';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface PlayerTicketManagerProps {
  autoMarking: boolean;
  onClaimBingo?: (ticket: any) => void;
}

export function PlayerTicketManager({ autoMarking, onClaimBingo }: PlayerTicketManagerProps) {
  const { player } = usePlayerContext();
  const { currentSession } = useSessionContext();
  const { toast } = useToast();
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [currentWinPattern, setCurrentWinPattern] = useState<string | null>(null);
  const [isLoadingGameState, setIsLoadingGameState] = useState(true);
  const sessionId = player?.sessionId || currentSession?.id;
  
  // Use the WebSocket hook for standardized connection management
  const { isConnected, connectionState, listenForEvent, EVENTS } = useWebSocket(sessionId);
  
  // Generate a unique ID for this component instance for better debug logging
  const instanceId = useRef(`PTM-${Math.random().toString(36).substring(2, 9)}`).current;
  
  // Use the usePlayerTickets hook to fetch and manage tickets
  const {
    playerTickets,
    isLoadingTickets,
    ticketError,
    refreshTickets,
    isRefreshingTickets,
    updateWinningStatus
  } = usePlayerTickets(sessionId, player?.id);

  // Create a logger for this component
  const log = (message: string, level: 'info' | 'warn' | 'error' = 'info') => {
    const prefix = `PlayerTicketManager (${instanceId})`;
    logWithTimestamp(`${prefix}: ${message}`, level);
  };

  // Fetch game state (called numbers, current win pattern)
  useEffect(() => {
    if (!sessionId) {
      log('No session ID available, skipping game state fetch', 'warn');
      return;
    }

    const fetchGameState = async () => {
      try {
        log(`Fetching game state for session: ${sessionId}`);
        const { data, error } = await supabase
          .from('sessions_progress')
          .select('called_numbers, current_win_pattern')
          .eq('session_id', sessionId)
          .single();

        if (error) {
          log(`Error fetching game state: ${error.message}`, 'error');
          toast({
            title: 'Error',
            description: `Could not load game state: ${error.message}`,
            variant: 'destructive',
          });
          return;
        }

        if (data) {
          log(`Game state loaded: ${data.called_numbers?.length || 0} numbers, pattern: ${data.current_win_pattern || 'none'}`);
          setCalledNumbers(data.called_numbers || []);
          setCurrentWinPattern(data.current_win_pattern);
          
          if (data.called_numbers && data.called_numbers.length > 0) {
            setLastCalledNumber(data.called_numbers[data.called_numbers.length - 1]);
          }
          
          // Update the winning status of tickets with the fetched called numbers
          if (data.called_numbers) {
            updateWinningStatus(data.called_numbers, data.current_win_pattern);
          }
        }
      } catch (err) {
        log(`Unexpected error fetching game state: ${(err as Error).message}`, 'error');
      } finally {
        setIsLoadingGameState(false);
      }
    };

    fetchGameState();
  }, [sessionId, toast, updateWinningStatus]);

  // Set up real-time listener for game state updates
  useEffect(() => {
    if (!sessionId) {
      log('No session ID available, skipping real-time listener setup', 'warn');
      return;
    }
    
    // Check connection state before setting up listeners
    if (!isConnected || connectionState !== 'connected') {
      log(`WebSocket not ready (state: ${connectionState}), deferring game state listener setup`, 'warn');
      return;
    }
    
    // Verify that we have valid event types
    if (!EVENTS || !EVENTS.NUMBER_CALLED || !EVENTS.GAME_STATE_UPDATE) {
      log(`Missing required event types, skipping listener setup`, 'error');
      return;
    }
    
    log(`Setting up game state update listeners for session ${sessionId}`, 'info');
    
    // Listen for number called updates
    const numberCleanup = listenForEvent(EVENTS.NUMBER_CALLED, (data: any) => {
      // Verify the data is for our session
      if (data?.sessionId !== sessionId) {
        log(`Ignoring number called for different session: ${data?.sessionId}`, 'info');
        return;
      }
      
      log(`Received number called update: ${data.number}`, 'info');
      
      if (data.calledNumbers && Array.isArray(data.calledNumbers)) {
        setCalledNumbers(data.calledNumbers);
        
        if (data.calledNumbers.length > 0) {
          setLastCalledNumber(data.calledNumbers[data.calledNumbers.length - 1]);
        }
        
        // Update winning status of tickets with new called numbers
        if (currentWinPattern) {
          updateWinningStatus(data.calledNumbers, currentWinPattern);
        }
      }
    });
    
    // Listen for game state updates
    const stateCleanup = listenForEvent(EVENTS.GAME_STATE_UPDATE, (data: any) => {
      // Verify the data is for our session
      if (data?.sessionId !== sessionId) {
        log(`Ignoring game state update for different session: ${data?.sessionId}`, 'info');
        return;
      }
      
      log(`Received game state update`, 'info');
      
      if (data.currentWinPattern) {
        setCurrentWinPattern(data.currentWinPattern);
        log(`Win pattern updated to: ${data.currentWinPattern}`, 'info');
      }
      
      if (data.calledNumbers && Array.isArray(data.calledNumbers)) {
        setCalledNumbers(data.calledNumbers);
        
        if (data.calledNumbers.length > 0) {
          setLastCalledNumber(data.calledNumbers[data.calledNumbers.length - 1]);
        }
        
        // Update winning status of tickets with new called numbers and possibly new pattern
        updateWinningStatus(data.calledNumbers, data.currentWinPattern || currentWinPattern);
      }
    });
    
    return () => {
      log('Cleaning up game state update listeners', 'info');
      numberCleanup();
      stateCleanup();
    };
  }, [sessionId, isConnected, connectionState, currentWinPattern, updateWinningStatus, listenForEvent, EVENTS]);

  // Handle ticket claim
  const handleClaimTicket = (ticket: any) => {
    if (onClaimBingo) {
      log(`Claiming bingo for ticket ${ticket.id || ticket.serial_number}`);
      onClaimBingo(ticket);
    }
  };

  // Loading state
  if (isLoadingTickets || isLoadingGameState) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <Spinner size="lg" />
        <p className="text-gray-500">Loading your bingo tickets...</p>
      </div>
    );
  }

  // Error state
  if (ticketError) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Tickets</h3>
        <p className="text-red-600 mb-4">{ticketError}</p>
        <Button 
          variant="outline" 
          onClick={refreshTickets}
          disabled={isRefreshingTickets}
          className="flex items-center gap-2"
        >
          {isRefreshingTickets ? (
            <>
              <Spinner size="sm" />
              <span>Trying again...</span>
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              <span>Try Again</span>
            </>
          )}
        </Button>
      </div>
    );
  }

  // No session state
  if (!sessionId) {
    return (
      <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="text-lg font-semibold text-yellow-800 mb-2">No Game Session</h3>
        <p className="text-yellow-600">You need to join a game session to see your tickets.</p>
      </div>
    );
  }

  // No tickets state
  if (!playerTickets || playerTickets.length === 0) {
    return (
      <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-lg font-semibold text-blue-800 mb-2">No Tickets Assigned</h3>
        <p className="text-blue-600 mb-4">
          You don't have any tickets assigned for this game session yet. Please wait for the game organizer to assign tickets.
        </p>
        <Button 
          variant="outline" 
          onClick={refreshTickets}
          disabled={isRefreshingTickets}
          className="flex items-center gap-2"
        >
          {isRefreshingTickets ? (
            <>
              <Spinner size="sm" />
              <span>Checking...</span>
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              <span>Check for Tickets</span>
            </>
          )}
        </Button>
      </div>
    );
  }

  // Display tickets
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Your Bingo Tickets</h2>
        <Button 
          variant="outline" 
          size="sm"
          onClick={refreshTickets}
          disabled={isRefreshingTickets}
          className="flex items-center gap-2"
        >
          {isRefreshingTickets ? (
            <>
              <Spinner size="sm" />
              <span>Refreshing...</span>
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </>
          )}
        </Button>
      </div>
      
      <PlayerTicketView 
        tickets={playerTickets} 
        calledNumbers={calledNumbers}
        lastCalledNumber={lastCalledNumber}
        currentWinPattern={currentWinPattern}
        onClaimBingo={handleClaimTicket}
      />
    </div>
  );
}
