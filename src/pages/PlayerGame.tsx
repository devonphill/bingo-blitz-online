
import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNetwork } from '@/contexts/network';
import { useToast } from "@/hooks/use-toast";
import { usePlayerContext } from '@/contexts/PlayerContext';
import { useSessionContext } from '@/contexts/SessionProvider';
import { MainLayout } from '@/components/layout';
import { PlayerGameContent } from '@/components/game';
import { Spinner } from "@/components/ui/spinner";
import { logWithTimestamp } from '@/utils/logUtils';
import { GameProvider } from '@/contexts/GameContext';

const PlayerGame = () => {
  const { playerCode } = useParams<{ playerCode?: string }>();
  const navigate = useNavigate();
  const { player } = usePlayerContext();
  const { currentSession } = useSessionContext();
  const { connect, connectionState, submitBingoClaim } = useNetwork();
  const [autoMarking, setAutoMarking] = useState<boolean>(() => {
    // Get from localStorage with default of true
    const stored = localStorage.getItem('autoMarking');
    return stored !== null ? stored === 'true' : true;
  });
  const [claimStatus, setClaimStatus] = useState<"none" | "pending" | "valid" | "invalid">("none");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  // Generate a unique ID for this component instance
  const instanceId = React.useRef(`PlayerGame-${Math.random().toString(36).substring(2, 7)}`);
  
  // Custom logging function
  const log = (message: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info') => {
    logWithTimestamp(`${instanceId.current}: ${message}`, level);
  };

  // Check if we have the required data
  React.useEffect(() => {
    if (!player) {
      log('No player data found in context, redirecting to join page', 'warn');
      navigate('/player/join');
      return;
    }
    
    if (!player.sessionId) {
      log('Player has no sessionId, redirecting to join page', 'warn');
      navigate('/player/join');
      return;
    }
    
    log(`Player data loaded: ${player.id} in session ${player.sessionId}`, 'info');
    
    // Connect to game session
    connect(player.sessionId);
    
  }, [player, connect, navigate]);

  // Function to handle reconnection
  const handleReconnect = useCallback(() => {
    if (!player?.sessionId) {
      log('Cannot reconnect: No session ID available', 'warn');
      toast({
        title: "No Session",
        description: "No session available to reconnect to.",
        variant: "destructive"
      });
      return;
    }

    log(`Attempting to reconnect to session ${player.sessionId}`, 'info');
    connect(player.sessionId);
    toast({
      title: "Reconnecting",
      description: "Attempting to reconnect to the game session...",
    });
  }, [player?.sessionId, connect, toast]);

  // Handle bingo claim
  const handleClaimBingo = useCallback((ticket: any) => {
    if (!player?.sessionId || !playerCode) {
      log('Cannot submit claim: Missing session ID or player code', 'warn');
      toast({
        title: "Cannot Submit Claim",
        description: "Missing session ID or player code.",
        variant: "destructive"
      });
      return;
    }
    
    // Enhanced debug logging to verify ticket data
    log('Preparing to submit claim with ticket:', 'info');
    console.log('CLAIM DEBUG - Ticket data for submission:', ticket);
    
    // Validate minimum required ticket fields
    if (!ticket || (!ticket.serial && !ticket.id)) {
      log('Cannot submit claim: Invalid ticket data - missing ID/serial', 'error');
      toast({
        title: "Invalid Ticket Data",
        description: "Cannot identify the ticket you're claiming for.",
        variant: "destructive"
      });
      return;
    }

    log(`Submitting bingo claim for ticket in session ${player.sessionId}`, 'info');
    setClaimStatus("pending");
    
    // Prepare the ticket with required fields
    // Fix here to ensure we have a valid ticket with serial
    const claimTicket = {
      serial: ticket.serial || ticket.id, // Use ID as fallback for serial
      perm: ticket.perm || 0,
      position: ticket.position || 0,
      layout_mask: ticket.layout_mask || ticket.layoutMask || 0,
      numbers: ticket.numbers || []
    };
    
    console.log('CLAIM DEBUG - Claim ticket prepared:', claimTicket);
    
    const success = submitBingoClaim(claimTicket, playerCode, player.sessionId);
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
        variant: "destructive"
      });
      setClaimStatus("none");
    }
  }, [player?.sessionId, playerCode, submitBingoClaim, toast]);

  // Display loading state when we're checking session
  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <Spinner size="lg" />
          <p className="ml-3">Loading game session...</p>
        </div>
      </MainLayout>
    );
  }

  // If no player or session, show error
  if (!player || !player.sessionId) {
    return (
      <MainLayout>
        <div className="container mx-auto py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <h2 className="text-xl font-bold text-red-800 mb-2">No Active Game Session</h2>
            <p className="text-red-600 mb-4">
              Unable to find your game session. Please try joining again.
            </p>
            <button 
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              onClick={() => navigate('/player/join')}
            >
              Return to Join Page
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <GameProvider>
      <MainLayout>
        <div className="container mx-auto py-8">
          <PlayerGameContent
            currentSession={currentSession || { id: player.sessionId, name: "Game Session" }}
            autoMarking={autoMarking}
            setAutoMarking={setAutoMarking}
            playerCode={playerCode || player.code}
            playerName={player.name}
            playerId={player.id}
            onReconnect={handleReconnect}
            sessionId={player.sessionId}
            onClaimBingo={handleClaimBingo}
          />
        </div>
      </MainLayout>
    </GameProvider>
  );
};

export default PlayerGame;
