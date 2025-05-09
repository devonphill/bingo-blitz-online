
import React from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle';
import { useSessionPatternManager } from '@/hooks/useSessionPatternManager';

interface GoLiveButtonProps {
  sessionId: string | null;
  onClick: () => void;
}

export function GoLiveButton({ sessionId, onClick }: GoLiveButtonProps) {
  const { toast } = useToast();
  // Pass sessionId to useSessionLifecycle as it's required by the hook
  const { goLive, isUpdating } = useSessionLifecycle(sessionId || undefined);
  const { initializeSessionPattern } = useSessionPatternManager(sessionId);

  const handleGoLive = async () => {
    if (!sessionId) {
      toast({
        title: "Error",
        description: "No session ID provided",
        variant: "destructive"
      });
      return;
    }

    try {
      // Set the session to live - no arguments needed as the hook already has sessionId
      const success = await goLive();

      if (success) {
        toast({
          title: "Session Live",
          description: "The session is now live and players can join",
        });

        // Initialize the session pattern
        await initializeSessionPattern();

        // Call the onClick handler to update the parent component
        onClick();
      } else {
        toast({
          title: "Error",
          description: "Failed to set the session to live",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    }
  };

  return (
    <Button onClick={handleGoLive} disabled={isUpdating} className="w-full">
      {isUpdating ? 'Setting Live...' : 'Go Live'}
    </Button>
  );
}
