
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useGameManager } from '@/contexts/GameManager';
import { useNetwork } from '@/contexts/network';
import { useToast } from "@/components/ui/use-toast";
import { MainLayout } from '@/components/layout';
import { PlayerGameContent } from '@/components/game';
import { Spinner } from "@/components/ui/spinner";
import { logWithTimestamp } from '@/utils/logUtils';
import { supabase } from '@/integrations/supabase/client';
import { GameProvider } from '@/contexts/GameContext';

// Add this type mapping function
const mapClaimStatus = (status: "none" | "pending" | "validating" | "validated" | "rejected"): "none" | "pending" | "valid" | "invalid" => {
  switch (status) {
    case "none":
      return "none";
    case "pending":
      return "pending";
    case "validating":
      return "pending"; // Map validating to pending
    case "validated":
      return "valid";
    case "rejected":
      return "invalid";
    default:
      return "none";
  }
};

const PlayerGame = () => {
  const { playerCode } = useParams<{ playerCode?: string }>();
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const { getCurrentSession } = useGameManager();
  const { connect, connectionState, submitBingoClaim, updatePlayerPresence } = useNetwork();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [autoMarking, setAutoMarking] = useState(true);
  const [playerName, setPlayerName] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [claimStatus, setClaimStatus] = useState<"none" | "pending" | "valid" | "invalid">("none");
  const { toast } = useToast();
  
  // Generate a unique ID for this component instance
  const instanceId = React.useRef(`PlayerGame-${Math.random().toString(36).substring(2, 7)}`);
  
  // Custom logging function
  const log = (message: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info') => {
    logWithTimestamp(`${instanceId.current}: ${message}`, level);
  };

  // Load session on mount
  useEffect(() => {
    const loadSession = async () => {
      try {
        setSessionLoading(true);
        const sessionData = await getCurrentSession();
        setCurrentSession(sessionData);
        setSessionLoading(false);
      } catch (err) {
        log(`Error fetching session: ${(err as Error).message}`, 'error');
        setSessionLoading(false);
      }
    };
    
    if (user && session) {
      loadSession();
    }
  }, [user, session, getCurrentSession]);

  // Update auth loading state when user and session are available
  useEffect(() => {
    if (user !== undefined && session !== undefined) {
      setAuthLoading(false);
    }
  }, [user, session]);

  // Fetch player name from local storage
  useEffect(() => {
    const storedPlayerName = localStorage.getItem('playerName') || '';
    setPlayerName(storedPlayerName);
  }, []);

  // Fetch player ID from local storage
  useEffect(() => {
    const storedPlayerId = localStorage.getItem('playerId') || '';
    setPlayerId(storedPlayerId);
  }, []);

  // Function to refresh tickets
  const refreshTickets = useCallback(async () => {
    if (!currentSession?.id || !playerId) {
      log('Session ID or Player ID is missing, skipping ticket refresh', 'warn');
      return;
    }

    setLoading(true);
    try {
      log(`Fetching tickets for session ${currentSession.id} and player ${playerId}`, 'info');
      const { data, error } = await supabase
        .from('assigned_tickets')
        .select('*')
        .eq('session_id', currentSession.id)
        .eq('player_id', playerId);

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
  }, [currentSession?.id, playerId, toast]);

  // Function to handle reconnection
  const handleReconnect = useCallback(() => {
    if (currentSession?.id) {
      log(`Attempting to reconnect to session ${currentSession.id}`, 'info');
      connect(currentSession.id);
    } else {
      log('No session ID available, cannot reconnect', 'warn');
      toast({
        title: "No Session",
        description: "No session available to reconnect to.",
      });
    }
  }, [currentSession?.id, connect, toast]);

  // Initial useEffect to handle session and authentication
  useEffect(() => {
    if (authLoading || sessionLoading) {
      log('Auth or session loading, waiting...', 'debug');
      return;
    }

    if (!user || !session) {
      log('No user or session found, redirecting to login', 'warn');
      navigate('/login');
      return;
    }

    if (!playerCode) {
      log('No player code found, redirecting to join', 'warn');
      navigate('/player/join');
      return;
    }

    if (!currentSession?.id) {
      log('No current session, please join a game', 'warn');
      toast({
        title: "No Active Session",
        description: "Please join a game to start playing.",
      });
      navigate('/player/join');
      return;
    }

    // Connect to the game session
    log(`Connecting to session ${currentSession.id}`, 'info');
    connect(currentSession.id);

    // Update player presence
    updatePlayerPresence({ player_id: playerId, player_code: playerCode })
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
  }, [user, session, playerCode, navigate, currentSession, authLoading, sessionLoading, connect, refreshTickets, updatePlayerPresence, toast]);

  // Handle claim submission
  const handleClaim = async (ticket: any) => {
    if (!currentSession?.id) {
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

    log(`Submitting claim for ticket ${ticket.id} in session ${currentSession.id}`, 'info');
    setClaimStatus("pending");
    const success = submitBingoClaim(ticket, playerCode, currentSession.id);

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

  if (authLoading || sessionLoading || loading) {
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
          {currentSession ? (
            <PlayerGameContent
              tickets={tickets}
              currentSession={currentSession}
              autoMarking={autoMarking}
              setAutoMarking={setAutoMarking}
              playerCode={playerCode || ''}
              playerName={playerName}
              playerId={playerId}
              onRefreshTickets={refreshTickets}
              onReconnect={handleReconnect}
              sessionId={currentSession.id}
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
