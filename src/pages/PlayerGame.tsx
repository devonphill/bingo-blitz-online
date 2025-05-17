
import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNetworkContext } from '@/contexts/network';
import { useToast } from "@/hooks/use-toast";
import { usePlayerContext } from '@/contexts/PlayerContext';
import { useSessionContext } from '@/contexts/SessionProvider';
import { MainLayout } from '@/components/layout';
import { PlayerGameContent } from '@/components/game';
import { Spinner } from "@/components/ui/spinner";
import { logWithTimestamp } from '@/utils/logUtils';
import { GameProvider } from '@/contexts/GameContext';
import { submitClaim } from '@/utils/claimUtils';

const PlayerGame = () => {
  const { playerCode } = useParams<{ playerCode?: string }>();
  const navigate = useNavigate();
  const { player, loadPlayerByCode } = usePlayerContext();
  const { currentSession } = useSessionContext();
  const { connect } = useNetworkContext();
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

  // Load player data if needed
  useEffect(() => {
    if (!player && playerCode) {
      setIsLoading(true);
      loadPlayerByCode(playerCode)
        .then((loadedPlayer) => {
          if (!loadedPlayer) {
            log('Failed to load player by code', 'error');
            navigate('/player/join');
          } else {
            log(`Loaded player: ${loadedPlayer.name} (${loadedPlayer.id})`, 'info');
          }
        })
        .catch((error) => {
          log(`Error loading player: ${error}`, 'error');
          navigate('/player/join');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [player, playerCode, loadPlayerByCode, navigate]);

  // Connect to session when player data is available
  useEffect(() => {
    if (player?.sessionId) {
      log(`Connecting player ${player.id} to session ${player.sessionId}`, 'info');
      connect(player.sessionId);
    }
  }, [player, connect]);

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
    if (!player?.sessionId || !playerCode || !player?.id) {
      log('Cannot submit claim: Missing session ID, player code, or player ID', 'warn');
      toast({
        title: "Cannot Submit Claim",
        description: "Missing session ID or player information.",
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
    
    // Submit the claim using utility function with all required parameters
    submitClaim(
      player.sessionId,
      player.id,
      player.name,
      ticket.id,
      ticket.serial,
      "oneLine"  // Default pattern, should be dynamic based on game state
    )
      .then((result) => {
        if (result.success) {
          log('Claim submitted successfully', 'info');
          toast({
            title: "Claim Submitted",
            description: "Your claim has been submitted and is awaiting validation.",
          });
        } else {
          log(`Failed to submit claim: ${result.error}`, 'error');
          toast({
            title: "Claim Submission Failed",
            description: result.error || "Failed to submit your claim. Please try again.",
            variant: "destructive"
          });
          setClaimStatus("none");
        }
      })
      .catch((error) => {
        log(`Error submitting claim: ${error}`, 'error');
        toast({
          title: "Claim Error",
          description: "An unexpected error occurred. Please try again.",
          variant: "destructive"
        });
        setClaimStatus("none");
      });
  }, [player, playerCode, toast]);

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
