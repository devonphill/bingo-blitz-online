
import React, { useState, useEffect } from 'react';
import { useCallerClaimManagement } from '@/hooks/useCallerClaimManagement';
import { Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { logWithTimestamp } from '@/utils/logUtils';

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

  // Refresh claims initially and periodically
  useEffect(() => {
    if (!sessionId) return;
    
    logWithTimestamp("ClaimNotifications: Mounted, fetching initial claims", 'info');
    fetchClaims();
    
    // Set up periodic refresh
    const interval = setInterval(() => {
      fetchClaims();
    }, 10000); // Check every 10 seconds
    
    return () => clearInterval(interval);
  }, [sessionId, fetchClaims]);

  // Animate when new claims arrive
  useEffect(() => {
    if (claimsCount > 0) {
      logWithTimestamp(`ClaimNotifications: ${claimsCount} claims detected, animating`, 'info');
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [claimsCount]);

  // Handle click
  const handleClick = () => {
    logWithTimestamp("ClaimNotifications: Bell clicked, opening claim sheet", 'info');
    onOpenClaimSheet();
  };

  if (!sessionId) return null;

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      className={`relative ${claimsCount > 0 ? 'bg-red-50' : ''}`}
      onClick={handleClick}
    >
      <Bell className={`h-5 w-5 ${isAnimating ? 'animate-bounce' : ''} ${claimsCount > 0 ? 'text-red-500' : ''}`} />
      {claimsCount > 0 && (
        <Badge 
          variant="destructive" 
          className="absolute -top-1 -right-1 px-1.5 py-0.5 min-w-[20px] flex items-center justify-center text-xs"
        >
          {claimsCount}
        </Badge>
      )}
    </Button>
  );
}
