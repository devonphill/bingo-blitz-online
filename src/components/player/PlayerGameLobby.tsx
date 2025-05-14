
import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { logWithTimestamp } from "@/utils/logUtils";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/hooks/use-toast";

interface PlayerGameLobbyProps {
  sessionName?: string;
  sessionId?: string | null;
  playerName?: string;
  onRefreshStatus?: () => void;
  errorMessage?: string | null;
  gameStatus?: string | null;
  brandingInfo?: {
    headerImage?: string;
    footerImage?: string;
    leftImage?: string;
    rightImage?: string;
    centerImage?: string;
  };
}

export default function PlayerGameLobby({
  sessionName = "Game Session",
  sessionId,
  playerName,
  onRefreshStatus,
  errorMessage,
  gameStatus,
  brandingInfo = {}
}: PlayerGameLobbyProps) {
  const { toast } = useToast();
  
  // Use default placeholder images if no branding is provided
  const {
    headerImage = "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1600&q=80",
    footerImage = "https://images.unsplash.com/photo-1500673922987-e212871fec22?auto=format&fit=crop&w=1600&q=80",
    leftImage = "https://images.unsplash.com/photo-1473091534298-04dcbce3278c?auto=format&fit=crop&w=600&q=80",
    rightImage = "https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=crop&w=600&q=80",
    centerImage = "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?auto=format&fit=crop&w=800&q=80"
  } = brandingInfo;
  
  // Log when the lobby component mounts for debugging
  useEffect(() => {
    logWithTimestamp(`PlayerGameLobby mounted: sessionId=${sessionId}, gameStatus=${gameStatus || 'null'}`, "info");
    
    // Setup a periodic status check to auto-refresh MORE FREQUENTLY
    const intervalId = setInterval(() => {
      if (onRefreshStatus) {
        logWithTimestamp("Auto-refreshing lobby status", "debug");
        onRefreshStatus();
      }
    }, 5000); // Change from 15 seconds to 5 seconds for more responsive updates
    
    return () => {
      clearInterval(intervalId);
      logWithTimestamp("PlayerGameLobby unmounted", "debug");
    };
  }, [sessionId, gameStatus, onRefreshStatus]);

  const handleRefresh = () => {
    if (onRefreshStatus) {
      logWithTimestamp("Player requested lobby refresh", "info");
      onRefreshStatus();
      
      toast({
        title: "Refreshing",
        description: "Checking for game status updates...",
        duration: 2000,
      });
    }
  };
  
  // Format session information for display
  const formatSessionDate = (dateStr?: string) => {
    if (!dateStr) return 'Not specified';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString();
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header Image */}
      <div className="w-full relative overflow-hidden" style={{
        height: "200px"
      }}>
        <img src={headerImage} alt="Game header" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <h1 className="text-4xl font-bold text-white">
            {sessionName || "Welcome to Bingo Blitz"}
          </h1>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-grow flex flex-col md:flex-row">
        {/* Left Image - 25% */}
        <div className="w-full md:w-1/4 p-4">
          <div className="h-full">
            <img src={leftImage} alt="Left section" className="w-full h-full object-cover rounded-lg" />
          </div>
        </div>
        
        {/* Center Content - 50% */}
        <div className="w-full md:w-1/2 p-4 flex flex-col items-center justify-center">
          <div className="relative">
            <img src={centerImage} alt="Center content" className="w-full rounded-lg mb-4" />
            
            {/* Semi-transparent waiting message */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-white/60 backdrop-blur-sm p-8 rounded-xl shadow-lg text-center max-w-md px-[24px]">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  Waiting for the host to start the game
                </h2>
                
                <div className="flex justify-center mb-4">
                  <LoadingSpinner size="lg" />
                </div>
                
                <p className="text-gray-700">
                  You will be automatically taken to the game when the host starts.
                </p>
                
                {playerName && (
                  <p className="text-amber-700 font-medium mt-4">
                    Player: {playerName}
                  </p>
                )}
                
                {errorMessage && (
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                    {errorMessage}
                  </div>
                )}
                
                <div className="mt-6 text-sm text-gray-500">
                  <p>Session: {sessionName || "Unknown"}</p>
                  <p>Status: {gameStatus || "pending"}</p>
                  {sessionId && <p className="text-xs opacity-50">ID: {sessionId}</p>}
                </div>
                
                <Button 
                  onClick={handleRefresh} 
                  variant="outline" 
                  className="mt-4 flex items-center gap-2 text-center px-[104px]"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh Status
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Right Image - 25% */}
        <div className="w-full md:w-1/4 p-4">
          <div className="h-full">
            <img src={rightImage} alt="Right section" className="w-full h-full object-cover rounded-lg" />
          </div>
        </div>
      </div>
      
      {/* Footer Image */}
      <div className="w-full relative overflow-hidden" style={{
        height: "150px"
      }}>
        <img src={footerImage} alt="Game footer" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
          <p className="text-lg font-medium text-white">
            Get ready for an amazing bingo experience!
          </p>
        </div>
      </div>
    </div>
  );
}
