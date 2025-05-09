
import React, { useState, useEffect } from 'react';
import { useCallerClaimManagement } from '@/hooks/useCallerClaimManagement';
import { Bell, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { logWithTimestamp } from '@/utils/logUtils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ClaimNotificationsProps {
  sessionId: string | null;
  onOpenClaimSheet: () => void;
}

export default function ClaimNotifications({ 
  sessionId, 
  onOpenClaimSheet 
}: ClaimNotificationsProps) {
  const { claims, claimsCount, fetchClaims } = useCallerClaimManagement(sessionId);
  const [isAnimating, setIsAnimating] = useState(false);
  const [previousCount, setPreviousCount] = useState(0);
  const { toast } = useToast();

  // Refresh claims initially and periodically
  useEffect(() => {
    if (!sessionId) return;
    
    logWithTimestamp("ClaimNotifications: Mounted, fetching initial claims", 'info');
    fetchClaims();
    
    // Set up periodic refresh - more frequent now
    const interval = setInterval(() => {
      logWithTimestamp("ClaimNotifications: Periodic refresh", 'debug');
      fetchClaims();
    }, 2500); // Check every 2.5 seconds
    
    // Set up a Supabase real-time listener for more immediate claim notifications
    const channel = supabase
      .channel('claim-notifications-channel')
      .on('broadcast', { event: 'claim-submitted' }, payload => {
        if (payload.payload?.sessionId === sessionId) {
          logWithTimestamp(`ClaimNotifications: Real-time claim notification received`, 'info');
          fetchClaims(); // Refresh claims immediately
          setIsAnimating(true); // Trigger animation for immediate feedback
          
          // Automatically stop animation after a while
          setTimeout(() => setIsAnimating(false), 1000);
        }
      })
      .subscribe();
    
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [sessionId, fetchClaims]);

  // Enhanced debugging for claims data
  useEffect(() => {
    if (claims?.length > 0) {
      logWithTimestamp(`ClaimNotifications: ${claims.length} claims found:`, 'info');
      claims.forEach((claim, i) => {
        logWithTimestamp(`Claim ${i+1}: Player=${claim.playerName || claim.playerId}`, 'info');
      });
    }
    
    // Detect new claims and notify
    if (claimsCount > previousCount) {
      logWithTimestamp(`ClaimNotifications: New claims detected (${previousCount} → ${claimsCount})`, 'info');
      
      // Get details of the newest claim
      const newestClaim = claims && claims.length > 0 ? claims[0] : null;
      
      // Show a toast notification for new claims
      toast({
        title: "New Bingo Claims",
        description: newestClaim 
          ? `${newestClaim.playerName || 'Player'} has claimed bingo!` 
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
      logWithTimestamp(`ClaimNotifications: ${claimsCount} claims detected, animating`, 'info');
      setIsAnimating(true);
      
      // Animation cycles
      const animations = [
        // Initial animation 
        setTimeout(() => setIsAnimating(false), 1000),
        // Secondary pulse after a pause
        setTimeout(() => setIsAnimating(true), 2000),
        setTimeout(() => setIsAnimating(false), 3000),
        // Tertiary pulse
        setTimeout(() => setIsAnimating(true), 4000),
        setTimeout(() => setIsAnimating(false), 5000)
      ];
      
      return () => animations.forEach(timer => clearTimeout(timer));
    }
  }, [claimsCount]);

  // Handle click
  const handleClick = () => {
    logWithTimestamp("ClaimNotifications: Bell clicked, opening claim sheet", 'info');
    onOpenClaimSheet();
    
    // Immediate refresh when opening
    fetchClaims();
  };

  if (!sessionId) return null;

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      className={`relative ${claimsCount > 0 ? 'bg-red-50' : ''}`}
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
  );
}
