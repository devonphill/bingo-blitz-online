
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface GoLiveButtonProps {
  sessionId: string;
  className?: string;
  onSuccess?: () => void;
  disabled?: boolean;
  children?: React.ReactNode; // Added this line to accept children
}

export function GoLiveButton({ sessionId, className, onSuccess, disabled, children = "Go Live" }: GoLiveButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { goLive, isUpdating } = useSessionLifecycle(sessionId);

  const handleGoLive = async () => {
    setIsLoading(true);
    
    try {
      const success = await goLive();
      
      if (success) {
        toast({
          title: "Session is now live",
          description: "Players can now join and play",
        });
        
        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (error) {
      console.error("Error going live:", error);
      toast({
        title: "Error",
        description: "Failed to go live. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleGoLive}
      className={className}
      disabled={isLoading || isUpdating || disabled}
    >
      {(isLoading || isUpdating) ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Going Live...
        </>
      ) : (
        children
      )}
    </Button>
  );
}
