
import React, { useState, useEffect } from "react";
import GameHeader from "./GameHeader";
import BingoWinProgress from "./BingoWinProgress";
import { useToast } from "@/hooks/use-toast";
import { Button } from "../ui/button";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";

interface PlayerGameLayoutProps {
  tickets: any[];
  children: React.ReactNode;
  calledNumbers: number[];
  currentNumber: number | null;
  currentSession: any;
  autoMarking: boolean;
  setAutoMarking: (value: boolean) => void;
  playerCode: string;
  winPrizes: { [key: string]: string };
  activeWinPatterns: string[];
  currentWinPattern: string | null;
  onClaimBingo: () => Promise<boolean>;
  errorMessage: string;
  isLoading: boolean;
  isClaiming?: boolean;
  claimStatus?: 'pending' | 'validated' | 'rejected' | null;
  gameType: string;
  currentGameNumber: number;
  numberOfGames: number;
  connectionState?: 'disconnected' | 'connecting' | 'connected' | 'error';
}

export default function PlayerGameLayout({
  tickets,
  children,
  calledNumbers,
  currentNumber,
  currentSession,
  autoMarking,
  setAutoMarking,
  playerCode,
  winPrizes,
  activeWinPatterns,
  currentWinPattern,
  onClaimBingo,
  errorMessage,
  isLoading,
  isClaiming,
  claimStatus,
  gameType,
  currentGameNumber,
  numberOfGames,
  connectionState = 'disconnected'
}: PlayerGameLayoutProps) {
  const [showBingoClaimed, setShowBingoClaimed] = useState<boolean>(false);
  const [showClaimError, setShowClaimError] = useState<boolean>(false);
  const { toast } = useToast();
  
  // To track actual connection status with debounce
  const [isActuallyConnected, setIsActuallyConnected] = useState<boolean>(connectionState === 'connected');
  
  // Debounce connection state to avoid flashing
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsActuallyConnected(connectionState === 'connected');
    }, 2000); // 2 second debounce to ensure connection is stable
    
    return () => clearTimeout(timer);
  }, [connectionState]);
  
  // Handle claim status changes
  useEffect(() => {
    if (claimStatus === 'validated') {
      setShowBingoClaimed(true);
      setShowClaimError(false);
    } else if (claimStatus === 'rejected') {
      setShowClaimError(true);
      setShowBingoClaimed(false);
    }
  }, [claimStatus]);
  
  // Handle connection state changes
  useEffect(() => {
    if (connectionState === 'error') {
      toast({
        title: "Connection Error",
        description: "Lost connection to the game server. Trying to reconnect...",
        variant: "destructive",
        duration: 5000
      });
    } else if (connectionState === 'connected' && !isActuallyConnected) {
      // Only show connected toast when transitioning from disconnected to connected
      toast({
        title: "Connected",
        description: "Successfully connected to the game server.",
        duration: 3000
      });
    }
  }, [connectionState, isActuallyConnected, toast]);

  const handleSettingsChange = (autoMark: boolean) => {
    setAutoMarking(autoMark);
    localStorage.setItem('autoMarking', autoMark ? 'true' : 'false');
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <GameHeader
          sessionName={currentSession?.name || "Bingo Game"}
          accessCode={playerCode}
          activeWinPattern={currentWinPattern || undefined}
          autoMarking={autoMarking}
          setAutoMarking={setAutoMarking}
          isConnected={isActuallyConnected}
          connectionState={connectionState}
        />
      </div>
      
      <div className="flex-1 p-4">
        <div className="mb-4">
          <BingoWinProgress
            tickets={tickets}
            calledNumbers={calledNumbers}
            activeWinPatterns={activeWinPatterns}
            currentWinPattern={currentWinPattern}
            handleClaimBingo={onClaimBingo}
            isClaiming={isClaiming}
            claimStatus={claimStatus}
            gameType={gameType}
          />
        </div>
        
        {/* Game Info Banner */}
        <div className="bg-white rounded-md shadow-sm p-3 mb-4 flex flex-wrap justify-between items-center text-sm text-gray-600">
          <div className="flex items-center">
            <span className="font-medium mr-1">Game:</span> {currentGameNumber} of {numberOfGames}
          </div>
          <div className="flex items-center">
            <span className="font-medium mr-1">Numbers Called:</span> {calledNumbers.length}
          </div>
          <div className="flex items-center">
            <span className="font-medium mr-1">Last Called:</span> {currentNumber || '-'}
          </div>
          <div className="flex items-center">
            <span className={`h-2 w-2 rounded-full mr-1 ${
              isActuallyConnected ? 'bg-green-500' : 
              connectionState === 'connecting' ? 'bg-amber-500' : 
              'bg-red-500'
            }`}></span>
            <span>{
              isActuallyConnected ? 'Connected' : 
              connectionState === 'connecting' ? 'Connecting...' : 
              connectionState === 'error' ? 'Connection Error' :
              'Disconnected'
            }</span>
          </div>
        </div>
        
        {children}
      </div>
      
      {/* Settings Dialog */}
      <Dialog>
        <DialogTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm"
            className="fixed bottom-4 right-4 bg-white shadow-md rounded-full h-12 w-12 p-0 flex items-center justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Game Settings</DialogTitle>
            <DialogDescription>
              Adjust your game settings and preferences.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-mark" className="flex flex-col space-y-1">
                <span>Auto-Mark Numbers</span>
                <span className="font-normal text-xs text-gray-500">Automatically mark called numbers on your card</span>
              </Label>
              <Switch 
                id="auto-mark" 
                checked={autoMarking} 
                onCheckedChange={handleSettingsChange}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="connection" className="flex flex-col space-y-1">
                <span>Connection Status</span>
                <span className="font-normal text-xs text-gray-500">Current connection to the game server</span>
              </Label>
              <div className="flex items-center">
                <span className={`h-3 w-3 rounded-full mr-2 ${
                  isActuallyConnected ? 'bg-green-500' : 
                  connectionState === 'connecting' ? 'bg-amber-500' : 
                  'bg-red-500'
                }`}></span>
                <span className="text-sm">
                  {isActuallyConnected ? 'Connected' : 
                   connectionState === 'connecting' ? 'Connecting...' : 
                   connectionState === 'error' ? 'Connection Error' :
                   'Disconnected'}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <div className="text-xs text-gray-500 w-full text-center">
              Player Code: {playerCode}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Claim Success Dialog */}
      <Dialog open={showBingoClaimed} onOpenChange={setShowBingoClaimed}>
        <DialogContent>
          <div className="flex flex-col items-center justify-center py-4">
            <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
            <DialogTitle className="text-xl mb-2">Bingo Verified!</DialogTitle>
            <DialogDescription className="text-center mb-6">
              Your bingo claim has been verified by the caller. Congratulations!
            </DialogDescription>
            <Button 
              onClick={() => setShowBingoClaimed(false)} 
              className="w-full bg-green-600 hover:bg-green-700"
            >
              Continue Playing
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Claim Error Dialog */}
      <Dialog open={showClaimError} onOpenChange={setShowClaimError}>
        <DialogContent>
          <div className="flex flex-col items-center justify-center py-4">
            <XCircle className="h-16 w-16 text-red-500 mb-4" />
            <DialogTitle className="text-xl mb-2">Claim Rejected</DialogTitle>
            <DialogDescription className="text-center mb-6">
              Your bingo claim was rejected by the caller. Please check your marked numbers and try again if you believe you have a valid bingo.
            </DialogDescription>
            <Button 
              onClick={() => setShowClaimError(false)} 
              variant="destructive"
              className="w-full"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Connection Warning - Only show when not actually connected */}
      {!isActuallyConnected && (
        <div className="fixed bottom-20 left-4 right-4 bg-amber-50 border border-amber-200 p-3 rounded-lg shadow-md text-sm flex items-center">
          <AlertCircle className="h-5 w-5 text-amber-500 mr-2 flex-shrink-0" />
          <div className="flex-grow">
            {connectionState === 'connecting' ? 
              "Connecting to game server... Game updates will resume when connected." :
              "Connection to game server lost. Trying to reconnect... Some features may be unavailable."}
          </div>
        </div>
      )}
    </div>
  );
}
