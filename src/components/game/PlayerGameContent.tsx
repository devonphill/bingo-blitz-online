
import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import BingoCardGrid from './BingoCardGrid';
import CalledNumbers from './CalledNumbers';
import PlayerGameLayout from './PlayerGameLayout';
import CurrentNumberDisplay from './CurrentNumberDisplay';
import PlayerGameLoader from './PlayerGameLoader';
import BingoWinProgress from './BingoWinProgress';
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

  const handleClaimBingo = async () => {
    setIsClaimingBingo(true);
    try {
      const success = await onClaimBingo();
      if (!success) {
        setIsClaimingBingo(false);
      }
      return success; // Return the success value to match the expected return type
    } catch (err) {
      console.error("Error claiming bingo:", err);
      setIsClaimingBingo(false);
      return false; // Return false in case of error to match the expected return type
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
        
        <CurrentNumberDisplay number={currentNumber} />
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
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
                    <span className="font-medium capitalize">
                      {pattern === 'oneLine' ? '1 Line' : 
                       pattern === 'twoLines' ? '2 Lines' : 
                       'Full House'}
                    </span>
                    <span className="text-green-600 font-semibold">
                      {winPrizes[pattern] || 'Prize TBD'}
                    </span>
                  </div>
                  {tickets[0]?.layoutMask && (
                    <BingoWinProgress 
                      numbers={tickets[0].numbers}
                      layoutMask={tickets[0].layoutMask}
                      calledNumbers={calledNumbers}
                      activeWinPatterns={[pattern]}
                    />
                  )}
                </div>
              ))}
            </div>
            
            <div className="text-center">
              {showWinResults ? (
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
              ) : (
                <Button 
                  className="w-full py-6 text-xl bg-gradient-to-r from-bingo-primary to-bingo-secondary hover:from-bingo-secondary hover:to-bingo-tertiary transition-all"
                  disabled={isClaimingBingo}
                  onClick={handleClaimBingo}
                >
                  {isClaimingBingo ? (
                    <>
                      <Clock className="mr-2 h-4 w-4 animate-spin" />
                      Validating Claim...
                    </>
                  ) : 'CLAIM NOW!'}
                </Button>
              )}
            </div>
            
            <div className="rounded-lg overflow-hidden shadow">
              <CalledNumbers 
                calledNumbers={calledNumbers}
                currentNumber={currentNumber}
              />
            </div>
          </div>
        </div>
      </div>
    </PlayerGameLayout>
  );
}
