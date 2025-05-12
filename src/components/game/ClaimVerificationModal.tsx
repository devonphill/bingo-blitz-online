import React, { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import CallerTicketDisplay from './CallerTicketDisplay';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import BingoWinProgress from './BingoWinProgress';
import { normalizeWinPattern, getWinPatternDisplayName } from '@/utils/winPatternUtils';

interface ClaimVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  tickets: Array<{
    serial: string;
    numbers: number[];
    layoutMask?: number;
  }>;
  calledNumbers: number[];
  currentNumber: number | null;
  onValidClaim: () => void;
  onFalseClaim: () => void;
  currentWinPattern?: string | null;
}

export default function ClaimVerificationModal({
  isOpen,
  onClose,
  playerName,
  tickets,
  calledNumbers,
  currentNumber,
  onValidClaim,
  onFalseClaim,
  currentWinPattern
}: ClaimVerificationModalProps) {
  const [isClaimValid, setIsClaimValid] = useState(false);
  const [rankedTickets, setRankedTickets] = useState<any[]>([]);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'valid' | 'false' | null>(null);
  const [validTickets, setValidTickets] = useState<any[]>([]);
  const [missedClaims, setMissedClaims] = useState<any[]>([]);
  
  // Always normalize the currentWinPattern to ensure it has the MAINSTAGE_ prefix
  const normalizedWinPattern = normalizeWinPattern(currentWinPattern, 'mainstage');
  
  console.log("ClaimVerificationModal rendered with isOpen:", isOpen, "playerName:", playerName, "currentWinPattern:", currentWinPattern, "normalized pattern:", normalizedWinPattern);
  
  // Debug use useEffect to log when isOpen changes
  useEffect(() => {
    console.log("ClaimVerificationModal isOpen changed to:", isOpen);
    
    if (isOpen) {
      console.log("MODAL IS OPEN NOW with player:", playerName);
      console.log("Ticket data:", tickets);
      console.log("Current win pattern:", normalizedWinPattern);
    }
  }, [isOpen, playerName, tickets, normalizedWinPattern]);
  
  // Recalculate claim validity and rank tickets when props change
  useEffect(() => {
    if (!tickets || tickets.length === 0) return;
    
    console.log("Calculating ticket scores with called numbers:", calledNumbers.length);
    
    // Array to collect valid tickets and missed claims
    const validTicketsFound: any[] = [];
    const missedClaimsFound: any[] = [];
    
    // Calculate score for each ticket (number of matched called numbers)
    const ticketsWithScore = tickets.map(ticket => {
      const matchedNumbers = ticket.numbers.filter(num => calledNumbers.includes(num));
      const percentMatched = Math.round((matchedNumbers.length / ticket.numbers.length) * 100);
      
      // Check if this ticket is a valid winner
      let isValid = false;
      let missedBy = 0;
      
      // Convert ticket to check against the normalized win pattern
      if (normalizedWinPattern === "MAINSTAGE_oneLine" || !normalizedWinPattern) {
        // For one line, check if any row is complete
        const layoutMask = ticket.layoutMask || 0;
        const maskBits = layoutMask.toString(2).padStart(27, "0").split("").reverse();
        const rows: number[][] = [[], [], []];
        let numIndex = 0;
        
        // Reconstruct the ticket rows
        for (let i = 0; i < 27; i++) {
          const row = Math.floor(i / 9);
          if (maskBits[i] === '1') {
            rows[row].push(ticket.numbers[numIndex]);
            numIndex++;
          }
        }
        
        // Check if any row is complete
        isValid = rows.some(row => 
          row.length > 0 && row.every(num => calledNumbers.includes(num))
        );
        
        // Check for missed claim 
        if (isValid) {
          // Find when this ticket became a winner by removing numbers one at a time
          for (let i = calledNumbers.length - 1; i >= 0; i--) {
            const testNumbers = calledNumbers.slice(0, i);
            const isStillValid = rows.some(row => 
              row.length > 0 && row.every(num => testNumbers.includes(num))
            );
            
            if (!isStillValid) {
              // We've found the point when this ticket became a winner
              missedBy = calledNumbers.length - i - 1;
              break;
            }
          }
        }
      } else if (normalizedWinPattern === "MAINSTAGE_twoLines") {
        // For two lines, we need to check if any two rows are complete
        const layoutMask = ticket.layoutMask || 0;
        const maskBits = layoutMask.toString(2).padStart(27, "0").split("").reverse();
        const rows: number[][] = [[], [], []];
        let numIndex = 0;
        
        // Reconstruct the ticket rows
        for (let i = 0; i < 27; i++) {
          const row = Math.floor(i / 9);
          if (maskBits[i] === '1') {
            rows[row].push(ticket.numbers[numIndex]);
            numIndex++;
          }
        }
        
        // Count complete rows
        const completeRows = rows.filter(row => 
          row.length > 0 && row.every(num => calledNumbers.includes(num))
        ).length;
        
        isValid = completeRows >= 2;
        
        // Check for missed claim
        if (isValid) {
          for (let i = calledNumbers.length - 1; i >= 0; i--) {
            const testNumbers = calledNumbers.slice(0, i);
            const completedRows = rows.filter(row => 
              row.length > 0 && row.every(num => testNumbers.includes(num))
            ).length;
            
            if (completedRows < 2) {
              // We've found when this ticket became valid
              missedBy = calledNumbers.length - i - 1;
              break;
            }
          }
        }
      } else if (normalizedWinPattern === "MAINSTAGE_fullHouse") {
        // For full house or default, check if all numbers have been called
        isValid = ticket.numbers.every(number => calledNumbers.includes(number));
        
        // Check for missed claim
        if (isValid) {
          for (let i = calledNumbers.length - 1; i >= 0; i--) {
            const testNumbers = calledNumbers.slice(0, i);
            const stillValid = ticket.numbers.every(number => testNumbers.includes(number));
            
            if (!stillValid) {
              // We've found when this ticket became valid
              missedBy = calledNumbers.length - i - 1;
              break;
            }
          }
        }
      }
      
      // Add to appropriate collection
      if (isValid) {
        const enrichedTicket = {
          ...ticket,
          score: matchedNumbers.length,
          percentMatched,
          validPattern: normalizedWinPattern,
          missedBy
        };
        
        if (missedBy > 0) {
          missedClaimsFound.push(enrichedTicket);
        } else {
          validTicketsFound.push(enrichedTicket);
        }
      }
      
      return { 
        ...ticket, 
        score: matchedNumbers.length,
        percentMatched,
        isValid,
        missedBy
      };
    });
    
    // Sort tickets by score (highest first)
    const sortedTickets = [...ticketsWithScore].sort((a, b) => {
      // Perfect claims (valid with missedBy = 0) go first
      if (a.isValid && !a.missedBy && (!b.isValid || b.missedBy > 0)) return -1;
      if (b.isValid && !b.missedBy && (!a.isValid || a.missedBy > 0)) return 1;
      
      // Then missed claims (valid but missedBy > 0)
      if (a.isValid && a.missedBy > 0 && !b.isValid) return -1;
      if (b.isValid && b.missedBy > 0 && !a.isValid) return 1;
      
      // Then sort by score
      return b.score - a.score;
    });
    
    console.log("Claim validity for pattern", normalizedWinPattern, ":", validTicketsFound.length > 0);
    console.log("Valid tickets found:", validTicketsFound.length);
    console.log("Missed claims found:", missedClaimsFound.length);
    
    setIsClaimValid(validTicketsFound.length > 0 || missedClaimsFound.length > 0);
    setValidTickets(validTicketsFound);
    setMissedClaims(missedClaimsFound);
    setRankedTickets(sortedTickets);
    
  }, [tickets, calledNumbers, normalizedWinPattern]);

  const handleValidClaim = () => {
    console.log("Valid claim button clicked");
    setActionType('valid');
    setConfirmDialogOpen(true);
  };

  const handleFalseClaim = () => {
    console.log("False claim button clicked");
    setActionType('false');
    setConfirmDialogOpen(true);
  };

  const confirmAction = () => {
    console.log("Confirming action:", actionType);
    setConfirmDialogOpen(false);
    if (actionType === 'valid') {
      onValidClaim();
    } else if (actionType === 'false') {
      onFalseClaim();
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => {
        console.log("Dialog onOpenChange called with:", open);
        if (!open) onClose();
      }}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className={`text-2xl font-bold ${isClaimValid ? 'text-green-600' : 'text-red-600'}`}>
              {isClaimValid ? 'CLAIM VALID' : 'CLAIM INVALID'} - {playerName}
            </DialogTitle>
            <div className="text-sm text-gray-500">
              Current win pattern: <span className="font-semibold">{getWinPatternDisplayName(normalizedWinPattern)}</span>
            </div>
            {validTickets.length > 0 && (
              <div className="text-sm text-green-600 font-medium mt-1">
                Found {validTickets.length} valid winning ticket{validTickets.length > 1 ? 's' : ''}
              </div>
            )}
            {missedClaims.length > 0 && (
              <div className="text-sm text-orange-500 font-medium mt-1">
                Found {missedClaims.length} missed claim{missedClaims.length > 1 ? 's' : ''}
              </div>
            )}
          </DialogHeader>

          <ScrollArea className="mt-4 h-[50vh]">
            <div className="space-y-4">
              {rankedTickets.map((ticket) => (
                <div 
                  key={ticket.serial} 
                  className={`p-2 border rounded-md ${
                    validTickets.some(vt => vt.serial === ticket.serial) 
                      ? 'border-green-500 bg-green-50' 
                      : missedClaims.some(mc => mc.serial === ticket.serial)
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200'
                  }`}
                >
                  <div className="flex justify-between text-sm text-gray-500 mb-1">
                    <span>Ticket: {ticket.serial}</span>
                    <span className={`font-bold ${
                      validTickets.some(vt => vt.serial === ticket.serial) 
                        ? 'text-green-600' 
                        : missedClaims.some(mc => mc.serial === ticket.serial)
                          ? 'text-orange-600'
                          : ''
                    }`}>
                      Score: {ticket.score}/{ticket.numbers.length} numbers ({ticket.percentMatched}%)
                      {validTickets.some(vt => vt.serial === ticket.serial) && ' - WINNING TICKET'}
                      {missedClaims.some(mc => mc.serial === ticket.serial) && (
                        ` - MISSED BY ${ticket.missedBy} CALL${ticket.missedBy > 1 ? 'S' : ''}`
                      )}
                    </span>
                  </div>
                  <CallerTicketDisplay
                    ticket={ticket}
                    calledNumbers={calledNumbers}
                    lastCalledNumber={currentNumber}
                    gameType="mainstage" // Add missing gameType prop
                  />
                  {ticket.layoutMask && (
                    <div className="mt-1 text-sm">
                      Win progress: <BingoWinProgress 
                        numbers={ticket.numbers}
                        layoutMask={ticket.layoutMask}
                        calledNumbers={calledNumbers}
                        activeWinPatterns={normalizedWinPattern ? [normalizedWinPattern] : ["MAINSTAGE_fullHouse"]}
                        currentWinPattern={normalizedWinPattern}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="flex justify-end space-x-2 mt-4">
            <Button
              variant="destructive"
              onClick={handleFalseClaim}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              False Call
            </Button>
            <Button
              onClick={handleValidClaim}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
            >
              <Check className="h-4 w-4" />
              Valid Claim
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === 'valid' ? 'Confirm Valid Claim' : 'Confirm False Call'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === 'valid' 
                ? 'Are you sure this is a valid claim? This will update the game state and may affect prizes.' 
                : 'Are you sure this is a false call? This will reject the player\'s claim.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDialogOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction} className={actionType === 'valid' ? 'bg-green-600' : 'bg-red-600'}>
              {actionType === 'valid' ? 'Confirm Valid' : 'Confirm False'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
