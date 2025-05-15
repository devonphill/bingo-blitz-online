
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useGameManager } from '@/contexts/GameManager';
import { useNetwork } from '@/contexts/network';
import { useToast } from "@/hooks/use-toast";
import { usePlayerContext } from '@/contexts/PlayerContext';
import { useSessionContext } from '@/contexts/SessionProvider';
import { MainLayout } from '@/components/layout';
import { PlayerGameContent } from '@/components/game';
import { Spinner } from "@/components/ui/spinner";
import { logWithTimestamp } from '@/utils/logUtils';
import { supabase } from '@/integrations/supabase/client';
import { GameProvider } from '@/contexts/GameContext';

const PlayerGame = () => {
  const { playerCode } = useParams<{ playerCode?: string }>();
  const navigate = useNavigate();
  const { player } = usePlayerContext();
  const { currentSession } = useSessionContext();
  const { connect, connectionState, submitBingoClaim, updatePlayerPresence } = useNetwork();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoMarking, setAutoMarking] = useState(true);
  const [claimStatus, setClaimStatus] = useState<"none" | "pending" | "valid" | "invalid">("none");
  const { toast } = useToast();
  
  // Generate a unique ID for this component instance
  const instanceId = React.useRef(`PlayerGame-${Math.random().toString(36).substring(2, 7)}`);
  
  // Custom logging function
  const log = (message: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info') => {
    logWithTimestamp(`${instanceId.current}: ${message}`, level);
  };

  // Load player data from context
  useEffect(() => {
    if (!player) {
      log('No player data found in context, trying to load from localStorage', 'warn');
      const storedPlayerCode = localStorage.getItem('playerCode');
      const storedPlayerId = localStorage.getItem('playerId');
      
      if (!storedPlayerCode || !storedPlayerId) {
        log('No player data in localStorage either, redirecting to join page', 'error');
        navigate('/player/join');
        return;
      }
      
      log(`Found player data in localStorage: ${storedPlayerCode}, ${storedPlayerId}`, 'info');
    } else {
      log(`Player data loaded from context: ${player.code}, ${player.id}`, 'info');
    }
  }, [player, navigate]);

  // Function to refresh tickets
  const refreshTickets = useCallback(async () => {
    if (!player?.sessionId || !player?.id) {
      log('Session ID or Player ID is missing, skipping ticket refresh', 'warn');
      return;
    }

    setLoading(true);
    try {
      log(`Fetching tickets for session ${player.sessionId} and player ${player.id}`, 'info');
      const { data, error } = await supabase
        .from('assigned_tickets')
        .select('*')
        .eq('session_id', player.sessionId)
        .eq('player_id', player.id);

      if (error) {
        log(`Error fetching tickets: ${error.message}`, 'error');
        toast({
          title: "Error fetching tickets",
          description: error.message,
          variant: "destructive",
        });
      } else {
        log(`Successfully fetched ${data?.length || 0} tickets`, 'info');
        setTickets(data || []);
      }
    } catch (err) {
      log(`Unexpected error fetching tickets: ${(err as Error).message}`, 'error');
      toast({
        title: "Unexpected error",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [player?.sessionId, player?.id, toast]);

  // Function to handle reconnection
  const handleReconnect = useCallback(() => {
    if (player?.sessionId) {
      log(`Attempting to reconnect to session ${player.sessionId}`, 'info');
      connect(player.sessionId);
    } else {
      log('No session ID available, cannot reconnect', 'warn');
      toast({
        title: "No Session",
        description: "No session available to reconnect to.",
      });
    }
  }, [player?.sessionId, connect, toast]);

  // Initial useEffect to connect to the game session
  useEffect(() => {
    if (!player || !player.sessionId) {
      log('Player or session ID missing, waiting...', 'debug');
      return;
    }

    if (!playerCode) {
      log('No player code found in URL, redirecting to join', 'warn');
      navigate('/player/join');
      return;
    }

    // Connect to the game session
    log(`Connecting to session ${player.sessionId}`, 'info');
    connect(player.sessionId);

    // Update player presence
    updatePlayerPresence({ player_id: player.id, player_code: playerCode })
      .then(success => {
        if (success) {
          log('Player presence updated successfully', 'info');
        } else {
          log('Failed to update player presence', 'warn');
        }
      });

    // Fetch tickets
    refreshTickets();

    // Set up interval to periodically refresh tickets
    const intervalId = setInterval(refreshTickets, 60000); // Refresh every 60 seconds

    return () => {
      log('Cleaning up: clearing ticket refresh interval', 'info');
      clearInterval(intervalId);
    };
  }, [player, playerCode, navigate, connect, refreshTickets, updatePlayerPresence]);

  // Handle claim submission
  const handleClaim = async (ticket: any) => {
    if (!player?.sessionId) {
      log('No session ID available, cannot submit claim', 'warn');
      toast({
        title: "No Session",
        description: "No session available to submit a claim.",
      });
      return;
    }

    if (!playerCode) {
      log('No player code available, cannot submit claim', 'warn');
      toast({
        title: "No Player Code",
        description: "No player code available to submit a claim.",
      });
      return;
    }

    log(`Submitting claim for ticket ${ticket.id} in session ${player.sessionId}`, 'info');
    setClaimStatus("pending");
    const success = submitBingoClaim(ticket, playerCode, player.sessionId);

    if (success) {
      log('Claim submitted successfully', 'info');
      toast({
        title: "Claim Submitted",
        description: "Your claim has been submitted and is awaiting validation.",
      });
    } else {
      log('Failed to submit claim', 'error');
      toast({
        title: "Claim Submission Failed",
        description: "Failed to submit your claim. Please try again.",
        variant: "destructive",
      });
      setClaimStatus("none");
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <Spinner size="lg" />
        </div>
      </MainLayout>
    );
  }

  return (
    <GameProvider>
      <MainLayout>
        <div className="container mx-auto py-8">
          {player?.sessionId ? (
            <PlayerGameContent
              tickets={tickets}
              currentSession={currentSession || { id: player.sessionId, name: "Game Session" }}
              autoMarking={autoMarking}
              setAutoMarking={setAutoMarking}
              playerCode={playerCode || ''}
              playerName={player.name}
              playerId={player.id}
              onRefreshTickets={refreshTickets}
              onReconnect={handleReconnect}
              sessionId={player.sessionId}
            />
          ) : (
            <div className="text-center">
              <h2>No Active Game Session</h2>
              <p>Please wait for the game to start or contact your game administrator.</p>
            </div>
          )}
        </div>
      </MainLayout>
    </GameProvider>
  );
};

export default PlayerGame;
