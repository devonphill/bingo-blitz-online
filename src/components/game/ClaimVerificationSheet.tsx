
import React, { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import CallerTicketDisplay from './CallerTicketDisplay';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import BingoWinProgress from './BingoWinProgress';
import { getGameRulesForType } from '@/game-rules/gameRulesRegistry';
import PrizeSharingDialog from './PrizeSharingDialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";
import { useSessionContext } from '@/contexts/SessionProvider';
import { useCallerHub } from '@/hooks/useCallerHub';

interface ClaimVerificationSheetProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId?: string;
  gameNumber?: number;
  currentCalledNumbers: number[];
  gameType?: string;
  playerName?: string;
  tickets?: Array<{
    serial: string;
    numbers: number[];
    layoutMask?: number;
  }>;
  currentNumber?: number | null;
  onValidClaim?: () => void;
  onFalseClaim?: () => void;
  currentWinPattern?: string | null;
  onNext?: () => void;
  currentSession?: any;
  activeWinPatterns?: string[];
}

export default function ClaimVerificationSheet({
  isOpen,
  onClose,
  sessionId,
  gameNumber = 1,
  currentCalledNumbers,
  gameType = 'mainstage',
  playerName,
  tickets = [],
  currentNumber,
  onValidClaim,
  onFalseClaim,
  currentWinPattern,
  onNext,
  currentSession,
  activeWinPatterns = []
}: ClaimVerificationSheetProps) {
  const { toast } = useToast();
  const { currentSession: contextSession } = useSessionContext();
  const [isClaimValid, setIsClaimValid] = useState(false);
  const [rankedTickets, setRankedTickets] = useState<any[]>([]);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'valid' | 'false' | null>(null);
  const [validTickets, setValidTickets] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSharingDialog, setShowSharingDialog] = useState(false);
  const [validClaimsCount, setValidClaimsCount] = useState(0);
  const [isFullHouse, setIsFullHouse] = useState(false);
  const [shouldProgress, setShouldProgress] = useState(false);
  const [isOneLine, setIsOneLine] = useState(false);
  const [needsPatternProgression, setNeedsPatternProgression] = useState(false);
  
  // Get claims from the WebSocket hub
  const callerHub = useCallerHub(sessionId);
  const pendingClaims = callerHub.pendingClaims;

  const session = currentSession || contextSession;
  const normalizedWinPattern = currentWinPattern && !currentWinPattern.includes('_') && 
    (gameType === 'mainstage' || gameType === '90-ball') 
      ? `MAINSTAGE_${currentWinPattern}` 
      : currentWinPattern;

  // If we have claims from the WebSocket hub, use the first pending claim's player info
  const effectivePlayerName = playerName || (pendingClaims.length > 0 ? pendingClaims[0].playerName : "Unknown Player");

  useEffect(() => {
    if (isOpen) {
      console.log("CLAIM SHEET IS OPEN with player:", effectivePlayerName);
      console.log("Ticket data:", tickets);
      console.log("Current win pattern:", normalizedWinPattern);
      console.log("Pending WebSocket claims:", pendingClaims);
      
      const isFullHousePattern = normalizedWinPattern === 'MAINSTAGE_fullHouse' || 
                               normalizedWinPattern === 'fullHouse';
      setIsFullHouse(isFullHousePattern);
      
      const isOneLinePattern = normalizedWinPattern === 'MAINSTAGE_oneLine' || 
                             normalizedWinPattern === 'oneLine';
      setIsOneLine(isOneLinePattern);
      
      setNeedsPatternProgression(isOneLinePattern || normalizedWinPattern === 'MAINSTAGE_twoLines' || normalizedWinPattern === 'twoLines');
    }
    
    if (!isOpen) {
      setIsProcessing(false);
    }
  }, [isOpen, effectivePlayerName, tickets, normalizedWinPattern, pendingClaims]);

  useEffect(() => {
    if (!tickets || tickets.length === 0) return;
    
    console.log("Validating claim against pattern:", normalizedWinPattern);
    
    const ticketsWithScore = tickets.map(ticket => {
      const matchedNumbers = ticket.numbers.filter(num => currentCalledNumbers.includes(num));
      return { 
        ...ticket, 
        score: matchedNumbers.length,
        percentMatched: Math.round((matchedNumbers.length / ticket.numbers.length) * 100),
      };
    });
    
    const sortedTickets = [...ticketsWithScore].sort((a, b) => b.score - a.score);
    setRankedTickets(sortedTickets);
    
    const gameRules = getGameRulesForType(gameType);
    let valid = false;
    const validTicketsFound: any[] = [];
    
    if (normalizedWinPattern) {
      sortedTickets.forEach(ticket => {
        const status = gameRules.getTicketStatus(ticket, currentCalledNumbers, normalizedWinPattern);
        const isValid = status.isWinner;
        
        if (isValid) {
          valid = true;
          validTicketsFound.push({...ticket, validPattern: normalizedWinPattern});
        }
      });
    }
    
    console.log("Claim validity:", valid, "for pattern:", normalizedWinPattern);
    setIsClaimValid(valid);
    setValidTickets(validTicketsFound);
    
    if (validTicketsFound.length > 0) {
      setRankedTickets([...validTicketsFound, ...sortedTickets.filter(
        ticket => !validTicketsFound.some(vt => vt.serial === ticket.serial)
      )]);
    }
  }, [tickets, currentCalledNumbers, normalizedWinPattern, gameType]);

  useEffect(() => {
    if (shouldProgress && onNext && !isProcessing) {
      if (isFullHouse) {
        console.log("ClaimVerificationSheet: Progressing to next game after full house win");
        
        const timer = setTimeout(() => {
          setShouldProgress(false);
          onNext();
          onClose();
        }, 2000);
        
        return () => clearTimeout(timer);
      } else if (needsPatternProgression) {
        console.log("ClaimVerificationSheet: Win pattern confirmed, should progress to next pattern");
        
        const timer = setTimeout(() => {
          setShouldProgress(false);
          onClose();
        }, 2000);
        
        return () => clearTimeout(timer);
      }
    }
  }, [shouldProgress, isFullHouse, needsPatternProgression, onNext, onClose, isProcessing]);

  const handleValidClaim = async () => {
    if (isProcessing) return;
    
    if (validTickets.length > 1) {
      setValidClaimsCount(validTickets.length);
      setShowSharingDialog(true);
    } else {
      setActionType('valid');
      setIsProcessing(true);
      await handlePrizeSharing(false);
      
      // Call the local onValidClaim if provided
      if (onValidClaim) {
        onValidClaim();
      }
      
      // Notify the player through WebSocket if we have their info
      if (callerHub.isConnected && pendingClaims.length > 0) {
        const claim = pendingClaims[0];
        callerHub.respondToClaim(claim.playerCode, 'valid');
      }
      
      if (isFullHouse) {
        console.log("Full house validated, will progress to next game");
        toast({
          title: "Full House Win",
          description: "Full house verified! Advancing to next game.",
        });
        
        setShouldProgress(true);
      } else if (needsPatternProgression) {
        console.log("Pattern win validated, will progress to next pattern");
        toast({
          title: isOneLine ? "One Line Win" : "Two Lines Win",
          description: `${isOneLine ? "One Line" : "Two Lines"} verified! Progressing to next pattern.`,
        });
        
        // Determine the next pattern
        const nextPattern = isOneLine ? 'twoLines' : 'fullHouse';
        
        // Change the pattern via WebSocket if connected
        if (callerHub.isConnected) {
          callerHub.changePattern(nextPattern);
        }
        
        setShouldProgress(true);
      }
    }
  };

  const handleFalseClaim = () => {
    if (isProcessing) return;
    
    console.log("False claim button clicked");
    setActionType('false');
    setConfirmDialogOpen(true);
  };

  const handlePrizeSharing = async (isShared: boolean) => {
    if (!session?.id || !validTickets.length) return;
    
    try {
      const gameTypePrefix = gameType === 'mainstage' ? 'MAINSTAGE_' : 
                           gameType === '90-ball' ? 'MAINSTAGE_' : 
                           gameType ? `${gameType.toUpperCase()}_` : '';
      
      const promises = validTickets.map(async (ticket) => {
        const gameLog = {
          session_id: session.id,
          game_number: gameNumber || 1,
          game_type: `${gameTypePrefix}${gameType || '90-ball'}`,
          win_pattern: normalizedWinPattern || 'MAINSTAGE_fullHouse',
          player_id: ticket.playerId || pendingClaims[0]?.playerCode,
          player_name: effectivePlayerName,
          ticket_serial: ticket.serial,
          ticket_perm: ticket.perm,
          ticket_layout_mask: ticket.layoutMask,
          ticket_numbers: ticket.numbers,
          ticket_position: ticket.position,
          called_numbers: currentCalledNumbers,
          total_calls: currentCalledNumbers.length,
          last_called_number: currentNumber,
          prize_shared: isShared,
          shared_with: isShared ? validTickets.length : 1
        };

        await supabase.from('universal_game_logs').insert([gameLog]);
      });

      await Promise.all(promises);
      
      // Notify the player through WebSocket
      if (callerHub.isConnected && pendingClaims.length > 0) {
        const claim = pendingClaims[0];
        callerHub.respondToClaim(claim.playerCode, 'valid');
      }
      
      const isFullHouseWin = 
        normalizedWinPattern?.includes('fullHouse') || 
        normalizedWinPattern?.includes('MAINSTAGE_fullHouse');
      
      const isOneLineWin = 
        normalizedWinPattern?.includes('oneLine') || 
        normalizedWinPattern?.includes('MAINSTAGE_oneLine');
        
      const isTwoLinesWin =
        normalizedWinPattern?.includes('twoLines') ||
        normalizedWinPattern?.includes('MAINSTAGE_twoLines');
      
      console.log("Is this a full house win?", isFullHouseWin);
      console.log("Is this a one line win?", isOneLineWin);
      console.log("Is this a two lines win?", isTwoLinesWin);
      
      if (isFullHouseWin && onNext) {
        console.log("Full house win validated in handlePrizeSharing, will progress to next game");
        toast({
          title: "Full House Win",
          description: "Full house verified! Advancing to next game.",
        });
        
        setShouldProgress(true);
      } else if (isOneLineWin || isTwoLinesWin) {
        // Determine the next pattern
        const nextPattern = isOneLineWin ? 'twoLines' : 'fullHouse';
        
        // Change the pattern via WebSocket if connected
        if (callerHub.isConnected) {
          callerHub.changePattern(nextPattern);
        }
        
        console.log("Pattern progression event sent");
        setShouldProgress(true);
      } else {
        onClose();
      }
    } catch (error) {
      console.error('Error saving game logs:', error);
      toast({
        title: "Error",
        description: "Failed to save game logs",
        variant: "destructive"
      });
      onClose();
    }
  };

  const confirmAction = () => {
    if (isProcessing) return;
    
    console.log("Confirming action:", actionType);
    setConfirmDialogOpen(false);
    setIsProcessing(true);
    
    if (actionType === 'valid') {
      if (onValidClaim) {
        onValidClaim();
      }
      
      // Notify the player through WebSocket
      if (callerHub.isConnected && pendingClaims.length > 0) {
        const claim = pendingClaims[0];
        callerHub.respondToClaim(claim.playerCode, 'valid');
      }
      
      if (isFullHouse && onNext) {
        console.log("Full house validated in confirmAction, will progress to next game");
        toast({
          title: "Full House Win",
          description: "Full house verified! Advancing to next game.",
        });
        
        setTimeout(() => {
          onNext();
        }, 1500);
      } else if (needsPatternProgression) {
        console.log("Pattern win validated in confirmAction, will progress to next pattern");
        toast({
          title: isOneLine ? "One Line Win" : "Two Lines Win",
          description: `${isOneLine ? "One Line" : "Two Lines"} verified! Progressing to next pattern.`,
        });
        
        // Determine the next pattern and change via WebSocket if connected
        if (callerHub.isConnected) {
          const nextPattern = isOneLine ? 'twoLines' : 'fullHouse';
          callerHub.changePattern(nextPattern);
        }
      }
    } else if (actionType === 'false') {
      if (onFalseClaim) {
        onFalseClaim();
      }
      
      // Notify the player through WebSocket of rejected claim
      if (callerHub.isConnected && pendingClaims.length > 0) {
        const claim = pendingClaims[0];
        callerHub.respondToClaim(claim.playerCode, 'rejected');
      }
    }
    
    setIsProcessing(false);
    onClose();
  };

  const getWinPatternDisplayName = (patternId: string | null | undefined): string => {
    if (!patternId) return 'Full House';
    
    const normalizedId = patternId.replace(/^[A-Z]+_/, '');
    
    switch (normalizedId) {
      case 'oneLine': return 'One Line';
      case 'twoLines': return 'Two Lines';
      case 'fullHouse': return 'Full House';
      case 'corners': return 'Corners';
      case 'threeLines': return 'Three Lines';
      default: return patternId;
    }
  };

  // Use either provided tickets or get from WebSocket claims
  const ticketsToDisplay = tickets.length > 0 ? tickets : 
    (pendingClaims.length > 0 && pendingClaims[0].ticketData ? [pendingClaims[0].ticketData] : []);

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Verify Claim: {effectivePlayerName}</SheetTitle>
          </SheetHeader>
          
          <div className="mt-4 flex flex-col space-y-4">
            <div className="bg-gray-50 p-3 rounded-md">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium">Pattern:</span>
                <span className="text-green-600">{getWinPatternDisplayName(normalizedWinPattern)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-medium">Called Numbers:</span>
                <span>{currentCalledNumbers.length}</span>
              </div>
            </div>
            
            {ticketsToDisplay.length > 0 ? (
              <>
                <ScrollArea className="h-[400px] p-2">
                  {ticketsToDisplay.map((ticket, index) => (
                    <div key={ticket.serial || index} className="mb-6">
                      <div className="bg-gray-50 p-2 rounded-md mb-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">Ticket {index + 1}</span>
                          <span className="text-xs text-gray-500">Serial: {ticket.serial}</span>
                        </div>
                      </div>
                      
                      <CallerTicketDisplay 
                        ticket={ticket} 
                        calledNumbers={currentCalledNumbers}
                        gameType={gameType}
                        winPattern={normalizedWinPattern || undefined}
                      />
                      
                      <div className="mt-2 text-xs text-right text-gray-500">
                        {rankedTickets[index]?.percentMatched || 0}% matched
                      </div>
                    </div>
                  ))}
                </ScrollArea>
                
                <div className="space-y-2">
                  <div className="bg-gray-50 p-3 rounded-md flex items-center justify-between">
                    <span className="font-medium">Claim Status:</span>
                    <span className={`px-2 py-1 rounded text-sm ${isClaimValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {isClaimValid ? 'VALID' : 'INVALID'}
                    </span>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleValidClaim}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      disabled={isProcessing}
                    >
                      <Check className="mr-1 h-4 w-4" /> Valid Claim
                    </Button>
                    
                    <Button
                      onClick={handleFalseClaim}
                      variant="destructive"
                      className="flex-1"
                      disabled={isProcessing}
                    >
                      <X className="mr-1 h-4 w-4" /> False Claim
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center p-8">
                <div className="text-amber-500 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                </div>
                <h3 className="text-lg font-semibold">No Ticket Data Available</h3>
                <p className="text-gray-500 text-center mt-2">
                  The player has claimed a bingo, but no ticket data is available for verification.
                </p>
                
                <div className="mt-6 grid grid-cols-2 gap-4 w-full">
                  <Button
                    onClick={handleValidClaim}
                    className="bg-green-600 hover:bg-green-700"
                    disabled={isProcessing}
                  >
                    <Check className="mr-1 h-4 w-4" /> Accept Claim
                  </Button>
                  
                  <Button
                    onClick={handleFalseClaim}
                    variant="destructive"
                    disabled={isProcessing}
                  >
                    <X className="mr-1 h-4 w-4" /> Reject Claim
                  </Button>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
      
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === 'valid' ? 'Confirm Valid Claim' : 'Confirm False Claim'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === 'valid' 
                ? 'Are you sure this is a valid bingo claim? This will mark the claim as verified.'
                : 'Are you sure this is a false claim? This will reject the claim and notify the player.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmAction}
              className={actionType === 'valid' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <PrizeSharingDialog
        isOpen={showSharingDialog}
        onClose={() => setShowSharingDialog(false)}
        onConfirm={async (isShared) => {
          setShowSharingDialog(false);
          setIsProcessing(true);
          await handlePrizeSharing(isShared);
          if (onValidClaim) onValidClaim();
          setIsProcessing(false);
        }}
        winnerCount={validClaimsCount}
      />
    </>
  );
}
