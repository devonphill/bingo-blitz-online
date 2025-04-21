
import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import CalledNumbers from './CalledNumbers';
import PlayerGameLayout from './PlayerGameLayout';
import PlayerGameLoader from './PlayerGameLoader';
import PlayerTicketsPanel from './PlayerTicketsPanel';

interface PlayerGameContentProps {
  tickets: Array<{
    serial: string;
    numbers: number[];
    layoutMask?: number;
    perm?: number;
    position?: number;
  }>;
  calledNumbers: number[];
  currentNumber: number | null;
  currentSession: any;
  autoMarking: boolean;
  setAutoMarking: (value: boolean) => void;
  playerCode: string;
  winPrizes: { [key: string]: string };
  activeWinPatterns: string[];
  onClaimBingo: () => Promise<boolean>;
  errorMessage: string;
  isLoading: boolean;
  isClaiming?: boolean;
  claimStatus?: 'pending' | 'validated' | 'rejected';
}

export default function PlayerGameContent({
  tickets,
  calledNumbers,
  currentNumber,
  currentSession,
  autoMarking,
  setAutoMarking,
  playerCode,
  winPrizes,
  activeWinPatterns,
  onClaimBingo,
  errorMessage,
  isLoading,
  isClaiming = false,
  claimStatus
}: PlayerGameContentProps) {
  const [isClaimingBingo, setIsClaimingBingo] = useState(isClaiming);
  
  // Sync the isClaimingBingo state with isClaiming prop when it changes
  useEffect(() => {
    setIsClaimingBingo(isClaiming);
  }, [isClaiming]);

  const handleClaimBingo = async () => {
    try {
      return await onClaimBingo();
    } catch (err) {
      console.error("Error claiming bingo:", err);
      return false;
    }
  };

  if (isLoading) {
    return <PlayerGameLoader 
      isLoading={isLoading} 
      errorMessage={errorMessage} 
      currentSession={currentSession} 
    />;
  }

  const showWinResults = claimStatus === 'validated' || claimStatus === 'rejected';
  
  // Pass the current win pattern based on claim status
  const currentWinPattern = activeWinPatterns.length > 0 ? activeWinPatterns[0] : null;
  
  return (
    <PlayerGameLayout
      tickets={tickets}
      calledNumbers={calledNumbers}
      currentNumber={currentNumber}
      currentSession={currentSession}
      autoMarking={autoMarking}
      setAutoMarking={setAutoMarking}
      playerCode={playerCode}
      winPrizes={winPrizes}
      activeWinPatterns={activeWinPatterns}
      currentWinPattern={currentWinPattern}
      onClaimBingo={handleClaimBingo}
      errorMessage={errorMessage}
      isLoading={isLoading}
    >
      <div className="space-y-6">
        {errorMessage && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}
        
        {showWinResults && (
          <Alert 
            variant={claimStatus === 'validated' ? "default" : "destructive"}
            className={claimStatus === 'validated' ? "bg-green-50 border-green-200" : ""}
          >
            {claimStatus === 'validated' ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertTitle>
              {claimStatus === 'validated' ? 'Win Verified!' : 'Claim Rejected'}
            </AlertTitle>
            <AlertDescription>
              {claimStatus === 'validated' 
                ? 'Your win has been verified by the caller.' 
                : 'Your claim was not verified. Please continue playing.'}
            </AlertDescription>
          </Alert>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <PlayerTicketsPanel
              tickets={tickets}
              calledNumbers={calledNumbers}
              autoMarking={autoMarking}
              activeWinPatterns={activeWinPatterns}
              currentWinPattern={currentWinPattern}
            />
          </div>
          
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-3">Win Patterns</h2>
              {activeWinPatterns.map(pattern => (
                <div key={pattern} className="mb-2 last:mb-0">
                  <div className="flex justify-between items-center">
                    <span className={`font-medium capitalize ${pattern === currentWinPattern ? 'text-green-600 font-bold' : ''}`}>
                      {pattern === 'oneLine' ? '1 Line' : 
                       pattern === 'twoLines' ? '2 Lines' : 
                       'Full House'}
                    </span>
                    <span className="text-green-600 font-semibold">
                      {winPrizes[pattern] || 'Prize TBD'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="rounded-lg overflow-hidden shadow">
              <CalledNumbers 
                calledNumbers={calledNumbers}
                currentNumber={null}
              />
            </div>
          </div>
        </div>
      </div>
    </PlayerGameLayout>
  );
}
