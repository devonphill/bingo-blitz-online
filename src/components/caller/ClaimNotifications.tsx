
import React, { useState, useEffect, useRef } from 'react';
import { useCallerClaimManagement } from '@/hooks/useCallerClaimManagement';
import { Bell, AlertTriangle, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { logWithTimestamp } from '@/utils/logUtils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Define consistent channel name used across the application
const GAME_UPDATES_CHANNEL = 'game-updates';
const CLAIM_SUBMITTED_EVENT = 'claim-submitted';

interface ClaimNotificationsProps {
  sessionId: string | null;
  onOpenClaimSheet: () => void;
}

export default function ClaimNotifications({ 
  sessionId, 
  onOpenClaimSheet 
}: ClaimNotificationsProps) {
  const { claims, claimsCount, fetchClaims, forceRefresh, addOptimisticClaim } = useCallerClaimManagement(sessionId);
  const [isAnimating, setIsAnimating] = useState(false);
  const [previousCount, setPreviousCount] = useState(0);
  const { toast } = useToast();
  const mountedRef = useRef(true);
  const claimChannelRef = useRef<any>(null);
  const sessionIdRef = useRef<string | null>(sessionId);
  const instanceId = useRef(`ClaimNotif-${Math.random().toString(36).substring(2, 7)}`);

  // Update session ID ref when it changes
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);
  
  // Custom logging function
  const log = (message: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info') => {
    logWithTimestamp(`ClaimNotifications (${instanceId.current}): ${message}`, level);
  };

  // Component lifecycle management
  useEffect(() => {
    mountedRef.current = true;
    log('Component mounted', 'info');
    
    return () => { 
      mountedRef.current = false;
      log('Component unmounting', 'info');
    };
  }, []);
  
  // Handle WebSocket message for a new claim
  const handleClaimMessage = (payload: any) => {
    if (!mountedRef.current) return;
    
    // Check if this claim is for our session
    if (payload.payload?.sessionId === sessionIdRef.current) {
      log("Real-time claim received via WebSocket", 'info');
      console.log("Detailed claim payload:", payload.payload);
      
      // Extract claim data from payload
      const claimData = payload.payload;
      
      // Before refreshing claims from the server, add this claim optimistically to the UI
      if (addOptimisticClaim && typeof addOptimisticClaim === 'function') {
        log("Adding optimistic claim to UI", 'info');
        
        // Create a proper claim object from the WebSocket data
        const optimisticClaim = {
          id: claimData.claimId,
          playerId: claimData.playerId,
          playerName: claimData.playerName || 'Player',
          sessionId: claimData.sessionId,
          ticket: claimData.ticket || null,
          calledNumbers: claimData.calledNumbers || [],
          lastCalledNumber: claimData.lastCalledNumber,
          winPattern: claimData.winPattern || 'oneLine',
          gameType: claimData.gameType || 'mainstage',
          status: 'pending',
          timestamp: claimData.timestamp || new Date().toISOString()
        };
        
        // Add to our local state
        addOptimisticClaim(optimisticClaim);
      }
      
      // Also refresh from server to ensure consistency
      forceRefresh();
      
      // Get details from the payload for the toast
      const playerName = payload.payload.playerName || 'Player';
      
      // Show toast
      toast({
        title: "New Bingo Claim!",
        description: `${playerName} has claimed bingo`,
        variant: "destructive",
        duration: 8000
      });
    }
  };
  
  // Set up real-time claim monitoring
  useEffect(() => {
    if (!sessionIdRef.current) {
      log('No session ID provided, skipping channel setup', 'warn');
      return;
    }
    
    // Allow time for component to fully initialize
    const setupTimer = setTimeout(() => {
      if (!mountedRef.current) return;
      
      const currentSessionId = sessionIdRef.current;
      
      // Clean up existing channel if any
      if (claimChannelRef.current) {
        try {
          log('Removing existing claim channel before re-creating', 'info');
          supabase.removeChannel(claimChannelRef.current);
          claimChannelRef.current = null;
        } catch (err) {
          console.error('Error removing claim channel:', err);
        }
      }
      
      // Set up channel for claim submissions
      log(`Setting up claim listener for session ${currentSessionId}`, 'info');
      
      try {
        const channel = supabase
          .channel(GAME_UPDATES_CHANNEL, {
            config: {
              broadcast: { 
                self: true, // Receive own broadcasts
                ack: true   // Request acknowledgment
              }
            }
          })
          .on('broadcast', { event: CLAIM_SUBMITTED_EVENT }, handleClaimMessage)
          .subscribe((status) => {
            log(`Claim channel subscription status: ${status}`, 'info');
          });
        
        claimChannelRef.current = channel;
      } catch (err) {
        log(`Error setting up claim channel: ${err}`, 'error');
      }
    }, 500);
    
    return () => { 
      clearTimeout(setupTimer);
      
      if (claimChannelRef.current) {
        log('Cleaning up claim channel on unmount/sessionId change', 'info');
        try {
          supabase.removeChannel(claimChannelRef.current);
        } catch (err) {
          console.error('Error removing claim channel during cleanup:', err);
        }
        claimChannelRef.current = null;
      }
    };
  }, [sessionId, toast, forceRefresh, addOptimisticClaim]);

  // Handle sessionId changes
  useEffect(() => {
    if (sessionIdRef.current !== sessionId && sessionId) {
      log(`Session ID changed from ${sessionIdRef.current} to ${sessionId}, reconnecting`, 'info');
      sessionIdRef.current = sessionId;
      
      // Clean up existing channel
      if (claimChannelRef.current) {
        try {
          supabase.removeChannel(claimChannelRef.current);
          claimChannelRef.current = null;
        } catch (err) {
          console.error('Error removing claim channel on sessionId change:', err);
        }
      }
      
      // Set up new channel after a delay
      setTimeout(() => {
        if (mountedRef.current && sessionId) {
          try {
            const channel = supabase
              .channel(GAME_UPDATES_CHANNEL, {
                config: { broadcast: { self: true, ack: true } }
              })
              .on('broadcast', { event: CLAIM_SUBMITTED_EVENT }, handleClaimMessage)
              .subscribe();
            
            claimChannelRef.current = channel;
          } catch (err) {
            log(`Error setting up new claim channel: ${err}`, 'error');
          }
        }
      }, 300);
    }
  }, [sessionId, toast, forceRefresh, addOptimisticClaim]);

  // Refresh claims initially
  useEffect(() => {
    if (!sessionIdRef.current) return;
    
    log("Mounted, fetching initial claims", 'info');
    fetchClaims();
  }, [sessionId, fetchClaims]);
  
  // Set up periodic refresh
  useEffect(() => {
    if (!sessionIdRef.current) return;
    
    const interval = setInterval(() => {
      if (mountedRef.current) {
        log("Periodic refresh", 'debug');
        fetchClaims();
      }
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(interval);
  }, [sessionId, fetchClaims]);

  // Enhanced debugging for claims data
  useEffect(() => {
    if (claims?.length > 0) {
      log(`${claims.length} claims found:`, 'info');
      claims.forEach((claim, i) => {
        log(`Claim ${i+1}: ID=${claim.id}, Player=${claim.player_name || claim.playerId}`, 'info');
      });
    }
    
    // Detect new claims and notify
    if (claimsCount > previousCount) {
      log(`New claims detected (${previousCount} → ${claimsCount})`, 'info');
      
      // Get details of the newest claim
      const newestClaim = claims && claims.length > 0 ? claims[0] : null;
      
      // Show a toast notification for new claims
      toast({
        title: "New Bingo Claims",
        description: newestClaim 
          ? `${newestClaim.player_name || 'Player'} has claimed bingo!` 
          : `${claimsCount - previousCount} new claims received`,
        variant: "destructive",
        duration: 8000 // Longer duration so it's not missed
      });
      
      setPreviousCount(claimsCount);
    }
  }, [claims, claimsCount, previousCount, toast]);

  // Animate when new claims arrive
  useEffect(() => {
    if (claimsCount > 0) {
      log(`${claimsCount} claims detected, animating`, 'info');
      setIsAnimating(true);
      
      // Animation cycles
      const animations = [
        // Initial animation 
        setTimeout(() => {
          if (mountedRef.current) setIsAnimating(false);
        }, 1000),
        // Secondary pulse after a pause
        setTimeout(() => {
          if (mountedRef.current) setIsAnimating(true);
        }, 2000),
        setTimeout(() => {
          if (mountedRef.current) setIsAnimating(false);
        }, 3000),
        // Tertiary pulse
        setTimeout(() => {
          if (mountedRef.current) setIsAnimating(true);
        }, 4000),
        setTimeout(() => {
          if (mountedRef.current) setIsAnimating(false);
        }, 5000)
      ];
      
      return () => animations.forEach(timer => clearTimeout(timer));
    }
  }, [claimsCount]);

  // Handle click
  const handleClick = () => {
    log("Bell clicked, opening claim sheet", 'info');
    onOpenClaimSheet();
    
    // Immediate refresh when opening
    fetchClaims();
  };

  // Handle force refresh of claims
  const handleForceRefresh = (e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger the parent click handler
    log("Force refreshing claims", 'info');
    
    forceRefresh();
    
    toast({
      title: "Claims Refreshed",
      description: "Manually refreshed claim notifications",
      duration: 2000,
    });
  };

  if (!sessionId) return null;

  return (
    <div className="relative">
      <Button 
        variant="ghost" 
        size="sm" 
        className={`relative ${claimsCount > 0 ? 'bg-red-50 hover:bg-red-100' : ''}`}
        onClick={handleClick}
      >
        {claimsCount > 0 ? (
          <AlertTriangle className={`h-5 w-5 ${isAnimating ? 'animate-bounce' : ''} text-red-500`} />
        ) : (
          <Bell className={`h-5 w-5 ${isAnimating ? 'animate-bounce' : ''}`} />
        )}
        
        {claimsCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 px-1.5 py-0.5 min-w-[20px] flex items-center justify-center text-xs animate-pulse"
          >
            {claimsCount}
          </Badge>
        )}
      </Button>
      
      {/* Add small refresh button for forced refresh */}
      <Button
        variant="outline"
        size="sm"
        className="absolute -right-10 top-0 w-8 h-8 p-0"
        onClick={handleForceRefresh}
        title="Force refresh claims"
      >
        <RefreshCw className="h-3 w-3" />
      </Button>
    </div>
  );
}
