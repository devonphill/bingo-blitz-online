
import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useGameProgression } from './useGameProgression';
import { CurrentGameState, GameType, PrizeDetails } from '@/types';

// Define a recursive Json type that can handle nested objects
type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export function useClaimManagement(sessionId: string | undefined) {
  const [showClaimSheet, setShowClaimSheet] = useState(false);
  const [currentClaim, setCurrentClaim] = useState<{
    playerName: string;
    playerId: string;
    tickets: any[];
    claimId?: string;
  } | null>(null);
  const [claimQueue, setClaimQueue] = useState<Array<{
    playerName: string;
    playerId: string;
    claimId?: string;
  }>>([]);
  const [processingClaim, setProcessingClaim] = useState(false);
  const hasCheckedInitialClaims = useRef(false);
  const { toast } = useToast();
  const { progressToNextGame, isProcessingGame } = useGameProgression({ id: sessionId } as any);

  // Handle closing the claim sheet
  const handleCloseSheet = useCallback(() => {
    setShowClaimSheet(false);
    // We don't immediately clear currentClaim here to prevent UI jumps
    // It will be cleared before processing the next claim
  }, []);

  // Process the next claim in queue
  const processNextClaim = useCallback(async () => {
    if (claimQueue.length === 0 || processingClaim || showClaimSheet) {
      return;
    }

    // First clear any previous claim
    setCurrentClaim(null);
    
    setProcessingClaim(true);
    const nextClaim = claimQueue[0];
    
    try {
      const { data: ticketData, error: ticketError } = await supabase
        .from('assigned_tickets')
        .select('*')
        .eq('player_id', nextClaim.playerId)
        .eq('session_id', sessionId);

      if (ticketError) {
        console.error("Error fetching ticket data:", ticketError);
        // Remove the problematic claim from queue and continue
        setClaimQueue(prev => prev.slice(1));
        setProcessingClaim(false);
        return;
      }

      console.log(`Processing claim for ${nextClaim.playerName} with ${ticketData?.length || 0} tickets`);
      
      // Set the current claim after we successfully fetched the tickets
      setCurrentClaim({
        playerName: nextClaim.playerName,
        playerId: nextClaim.playerId,
        tickets: ticketData || [],
        claimId: nextClaim.claimId
      });
      
      // Remove this claim from the queue
      setClaimQueue(prev => prev.slice(1));
      
      console.log("Opening sheet for claim verification!");
      // Open the sheet automatically
      setTimeout(() => {
        setShowClaimSheet(true);
        setProcessingClaim(false);
      }, 100);
      
    } catch (error) {
      console.error("Error processing next claim:", error);
      setClaimQueue(prev => prev.slice(1));
      setProcessingClaim(false);
    }
  }, [claimQueue, processingClaim, sessionId, showClaimSheet]);

  // Check for pending claims in the database
  const checkForClaims = useCallback(async () => {
    if (!sessionId || hasCheckedInitialClaims.current) return;
    
    console.log("Performing initial check for claims, setting flag to true");
    hasCheckedInitialClaims.current = true;
    
    try {
      const { data, error } = await supabase
        .from('bingo_claims')
        .select('id, player_id, claimed_at, players(nickname)')
        .eq('session_id', sessionId)
        .eq('status', 'pending')
        .order('claimed_at', { ascending: true });
        
      if (error) {
        console.error("Error fetching pending claims:", error);
        return;
      }
      
      if (data && data.length > 0) {
        console.log("Found pending claims:", data);
        
        // Add pending claims to the queue if they're not already there
        data.forEach(claim => {
          const isDuplicate = 
            (currentClaim?.playerId === claim.player_id) || 
            claimQueue.some(q => q.playerId === claim.player_id);
            
          if (!isDuplicate) {
            setClaimQueue(prev => [
              ...prev, 
              {
                playerName: claim.players?.nickname || 'Unknown',
                playerId: claim.player_id,
                claimId: claim.id
              }
            ]);
          }
        });
      }
    } catch (error) {
      console.error("Error checking for pending claims:", error);
    }
  }, [sessionId, currentClaim, claimQueue]);

  // Auto-process next claim when ready
  useEffect(() => {
    if (!showClaimSheet && !processingClaim && claimQueue.length > 0) {
      const timer = setTimeout(() => {
        processNextClaim();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [showClaimSheet, processingClaim, claimQueue, processNextClaim]);

  // Listen for real-time bingo claims - with important fixes
  useEffect(() => {
    if (!sessionId) return;
    
    console.log("Setting up real-time listener for bingo claims on session", sessionId);
    
    const channel = supabase
      .channel('caller-claims')
      .on(
        'broadcast',
        { event: 'bingo-claim' },
        (payload) => {
          console.log("Received bingo claim broadcast:", payload);
          
          if (payload.payload && payload.payload.playerId && payload.payload.playerName) {
            const claimData = payload.payload;
            
            // Check if this claim is already being processed or in queue
            const isDuplicate = 
              (currentClaim?.playerId === claimData.playerId) || 
              claimQueue.some(q => q.playerId === claimData.playerId);
            
            if (!isDuplicate) {
              console.log("Adding new claim to queue:", claimData.playerName);
              setClaimQueue(prev => [
                ...prev,
                {
                  playerName: claimData.playerName,
                  playerId: claimData.playerId,
                  claimId: claimData.claimId
                }
              ]);
              
              toast({
                title: "New Claim!",
                description: `${claimData.playerName} has claimed bingo!`,
                variant: "default",
              });
              
              // Automatically process the next claim if not currently showing or processing one
              if (!showClaimSheet && !processingClaim && !currentClaim) {
                // Add slight delay to ensure the queue is updated first
                setTimeout(() => {
                  processNextClaim();
                }, 300);
              }
            } else {
              console.log("Duplicate claim received, ignoring:", claimData.playerName);
            }
          }
        }
      )
      .subscribe();

    return () => {
      console.log("Removing channel for bingo claims");
      supabase.removeChannel(channel);
    };
  }, [sessionId, currentClaim, claimQueue, showClaimSheet, processingClaim, processNextClaim, toast]);

  // Manually open the claim sheet
  const openClaimSheet = useCallback(() => {
    console.log("Opening claim sheet manually");
    
    // If there are claims in the queue but no current claim is being displayed,
    // process the next claim in queue
    if (claimQueue.length > 0 && !currentClaim && !showClaimSheet && !processingClaim) {
      processNextClaim();
    } else if (currentClaim && !showClaimSheet && !processingClaim) {
      // If there's a current claim but the sheet is closed, reopen it
      setShowClaimSheet(true);
    }
  }, [claimQueue, currentClaim, processNextClaim, showClaimSheet, processingClaim]);

  // Validate a claim
  const validateClaim = useCallback(async (shouldAdvanceGame = false) => {
    if (!currentClaim || !sessionId) return;
    
    console.log("Validating claim for player:", currentClaim.playerName, "shouldAdvanceGame:", shouldAdvanceGame);
    
    try {
      // Update the claim status in the database if there's a claim ID
      if (currentClaim.claimId) {
        const { error: updateError } = await supabase
          .from('bingo_claims')
          .update({ status: 'validated' })
          .eq('id', currentClaim.claimId);
          
        if (updateError) {
          console.error("Error updating claim status:", updateError);
        }
      }
      
      // Get current session state to determine active win patterns
      const { data: sessionData, error: sessionError } = await supabase
        .from('game_sessions')
        .select('current_game_state')
        .eq('id', sessionId)
        .single();
        
      if (sessionError || !sessionData || !sessionData.current_game_state) {
        console.error("Error fetching session data:", sessionError);
      } else {
        const gameStateData = sessionData.current_game_state as Json;
        
        // Safely check if the gameState is an object with activePatternIds
        if (
          typeof gameStateData === 'object' && 
          gameStateData !== null && 
          !Array.isArray(gameStateData) && 
          'activePatternIds' in gameStateData
        ) {
          const currentGameState = gameStateData as unknown as CurrentGameState;
          const activePatterns = currentGameState.activePatternIds || [];
          
          if (activePatterns.length > 0) {
            // Get current win pattern (first in the list)
            const currentPattern = activePatterns[0];
            
            // Get game progress record for this session
            const { data: progressData, error: progressError } = await supabase
              .from('game_progress')
              .select('*')
              .eq('session_id', sessionId)
              .maybeSingle();
              
            if (progressError) {
              console.error("Error fetching game progress:", progressError);
            }
            
            // Update game progress with completed pattern
            if (progressData) {
              // Add the current pattern to completed patterns list
              const completedPatterns = [...(progressData.completed_win_patterns || [])];
              if (!completedPatterns.includes(currentPattern)) {
                completedPatterns.push(currentPattern);
              }
              
              // Calculate the next active pattern
              const remainingPatterns = activePatterns.filter(p => !completedPatterns.includes(p));
              const nextPattern = remainingPatterns.length > 0 ? remainingPatterns[0] : null;
              
              console.log("Updating game progress:", {
                completedPatterns,
                nextPattern,
                currentPattern
              });
              
              // Update game progress
              const { error: updateProgressError } = await supabase
                .from('game_progress')
                .update({
                  completed_win_patterns: completedPatterns,
                  current_win_pattern_id: nextPattern
                })
                .eq('id', progressData.id);
                
              if (updateProgressError) {
                console.error("Error updating game progress:", updateProgressError);
              }
              
              // Update active patterns in game state
              const updatedPatterns = activePatterns.filter(p => p !== currentPattern);
              
              if (updatedPatterns.length === 0 && shouldAdvanceGame) {
                console.log("No patterns remaining - will advance game");
              } else if (updatedPatterns.length > 0) {
                console.log("Updating active patterns in game state:", updatedPatterns);
                
                // Create a safe updated game state object
                const updatedGameStateObj: CurrentGameState = {
                  ...currentGameState,
                  activePatternIds: updatedPatterns
                };
                
                // Convert to a JSON-compatible object for supabase
                const gameStateForSupabase = {
                  gameNumber: updatedGameStateObj.gameNumber,
                  gameType: updatedGameStateObj.gameType,
                  activePatternIds: updatedGameStateObj.activePatternIds,
                  calledItems: updatedGameStateObj.calledItems,
                  lastCalledItem: updatedGameStateObj.lastCalledItem,
                  status: updatedGameStateObj.status,
                  prizes: updatedGameStateObj.prizes ? JSON.parse(JSON.stringify(updatedGameStateObj.prizes)) : {}
                };
                
                const { error: updateSessionError } = await supabase
                  .from('game_sessions')
                  .update({
                    current_game_state: gameStateForSupabase as Json
                  })
                  .eq('id', sessionId);
                  
                if (updateSessionError) {
                  console.error("Error updating session game state:", updateSessionError);
                }
              }
            } else {
              // Create new game progress record
              // Make sure we have a valid gameNumber
              let gameNumber = 1; // Default value
              if (
                typeof gameStateData === 'object' &&
                gameStateData !== null &&
                !Array.isArray(gameStateData) && 
                'gameNumber' in gameStateData
              ) {
                // Safe access with type checking
                const gameNumberValue = (gameStateData as any).gameNumber;
                gameNumber = typeof gameNumberValue === 'number' ? gameNumberValue : 1;
              }
              
              const { error: createError } = await supabase
                .from('game_progress')
                .insert({
                  session_id: sessionId,
                  game_number: gameNumber,
                  completed_win_patterns: [currentPattern],
                  current_win_pattern_id: activePatterns.length > 1 ? activePatterns[1] : null
                });
                
              if (createError) {
                console.error("Error creating game progress:", createError);
              }
              
              // Update active patterns in game state
              const updatedPatterns = activePatterns.filter(p => p !== currentPattern);
              
              if (updatedPatterns.length === 0 && shouldAdvanceGame) {
                console.log("No patterns remaining in new progress - will advance game");
              } else if (updatedPatterns.length > 0) {
                // Create a safe updated game state object
                const updatedGameStateObj: CurrentGameState = {
                  ...(currentGameState as CurrentGameState),
                  activePatternIds: updatedPatterns
                };
                
                // Convert to a JSON-compatible object for supabase
                const gameStateForSupabase = {
                  gameNumber: updatedGameStateObj.gameNumber,
                  gameType: updatedGameStateObj.gameType,
                  activePatternIds: updatedGameStateObj.activePatternIds,
                  calledItems: updatedGameStateObj.calledItems,
                  lastCalledItem: updatedGameStateObj.lastCalledItem,
                  status: updatedGameStateObj.status,
                  prizes: updatedGameStateObj.prizes ? JSON.parse(JSON.stringify(updatedGameStateObj.prizes)) : {}
                };
                
                const { error: updateSessionError } = await supabase
                  .from('game_sessions')
                  .update({
                    current_game_state: gameStateForSupabase as Json
                  })
                  .eq('id', sessionId);
                  
                if (updateSessionError) {
                  console.error("Error updating session game state:", updateSessionError);
                }
              }
            }
          }
        } else {
          console.error("Invalid current_game_state format:", gameStateData);
        }
      }
      
      // Broadcast the result to all players
      await supabase
        .channel('game-updates')
        .send({
          type: 'broadcast',
          event: 'claim-result',
          payload: { 
            playerId: currentClaim.playerId,
            result: 'valid'
          }
        });
      
      toast({
        title: "Claim Validated",
        description: `${currentClaim.playerName}'s claim has been validated.`
      });
      
      // If this is a full house validation and no win patterns remain, progress to the next game
      if (shouldAdvanceGame) {
        console.log("Full house win validated, progressing to next game");
        setTimeout(() => {
          progressToNextGame();
        }, 1000);
      }
      
      // The sheet will be closed by the confirmation callback with a delay
      
    } catch (error) {
      console.error("Error validating claim:", error);
      
      toast({
        title: "Error",
        description: "Failed to validate the claim. Please try again.",
        variant: "destructive"
      });
    }
  }, [currentClaim, sessionId, toast, progressToNextGame]);

  // Reject a claim
  const rejectClaim = useCallback(async () => {
    if (!currentClaim || !sessionId) return;
    
    console.log("Rejecting claim for player:", currentClaim.playerName);
    
    try {
      // Update the claim status in the database if there's a claim ID
      if (currentClaim.claimId) {
        const { error: updateError } = await supabase
          .from('bingo_claims')
          .update({ status: 'rejected' })
          .eq('id', currentClaim.claimId);
          
        if (updateError) {
          console.error("Error updating claim status:", updateError);
        }
      }
      
      // Broadcast the result to all players
      await supabase
        .channel('game-updates')
        .send({
          type: 'broadcast',
          event: 'claim-result',
          payload: { 
            playerId: currentClaim.playerId,
            result: 'rejected'
          }
        });
      
      toast({
        title: "Claim Rejected",
        description: `${currentClaim.playerName}'s claim has been rejected.`
      });
      
      // The sheet will be closed by the confirmation callback with a delay
      
    } catch (error) {
      console.error("Error rejecting claim:", error);
      
      toast({
        title: "Error",
        description: "Failed to reject the claim. Please try again.",
        variant: "destructive"
      });
    }
  }, [currentClaim, sessionId, toast]);

  // Added function to progress to next game
  const handleNextGame = useCallback(() => {
    console.log("Handling next game progression");
    progressToNextGame();
  }, [progressToNextGame]);

  return {
    showClaimSheet,
    setShowClaimSheet: handleCloseSheet,
    currentClaim,
    setCurrentClaim,
    claimQueue,
    openClaimSheet,
    validateClaim,
    rejectClaim,
    processNextClaim,
    checkForClaims,
    handleNextGame,
    isProcessingGame
  };
}
