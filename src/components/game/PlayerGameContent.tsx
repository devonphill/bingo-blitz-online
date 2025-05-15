import React, { useState, useEffect, useCallback } from 'react';
import { Grid } from '@/components/ui/grid';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { useNetwork } from '@/contexts/NetworkStatusContext';
import { logWithTimestamp } from '@/utils/logUtils';
import { Ticket } from '@/components/game/Ticket';
import { ClaimStatus } from '@/types/claim';
import { useGameContext } from '@/contexts/GameContext';

interface PlayerGameContentProps {
  tickets: any[];
  currentSession: any;
  autoMarking: boolean;
  setAutoMarking: React.Dispatch<React.SetStateAction<boolean>>;
  playerCode: string;
  playerName: string;
  playerId: string;
  onRefreshTickets: () => void;
  onReconnect: () => void;
  sessionId: string; // Add this prop
}

export const PlayerGameContent: React.FC<PlayerGameContentProps> = ({
  tickets,
  currentSession,
  autoMarking,
  setAutoMarking,
  playerCode,
  playerName,
  playerId,
  onRefreshTickets,
  onReconnect,
  sessionId
}) => {
  const { toast } = useToast();
  const { submitBingoClaim } = useNetwork();
  const { claimStatus, setClaimStatus } = useGameContext();
  const [isClaiming, setIsClaiming] = useState(false);
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [isClaimButtonEnabled, setIsClaimButtonEnabled] = useState(false);
  const [isClaimValidating, setIsClaimValidating] = useState(false);
  const [isClaimSubmitted, setIsClaimSubmitted] = useState(false);
  const [isClaimRejected, setIsClaimRejected] = useState(false);
  const [isClaimValidated, setIsClaimValidated] = useState(false);
  const [isClaimNone, setIsClaimNone] = useState(true);
  const [isClaimPending, setIsClaimPending] = useState(false);
  const [isClaimValid, setIsClaimValid] = useState(false);
  const [isClaimInvalid, setIsClaimInvalid] = useState(false);

  // Update claim status state variables based on claimStatus context
  useEffect(() => {
    setIsClaimNone(claimStatus === "none");
    setIsClaimPending(claimStatus === "pending");
    setIsClaimValid(claimStatus === "valid");
    setIsClaimInvalid(claimStatus === "invalid");
  }, [claimStatus]);

  // Function to handle ticket selection
  const toggleTicketSelection = (ticketId: string) => {
    setSelectedTicketIds((prevSelected) =>
      prevSelected.includes(ticketId)
        ? prevSelected.filter((id) => id !== ticketId)
        : [...prevSelected, ticketId]
    );
  };

  // Function to handle claim submission
  const handleClaimBingo = useCallback(async () => {
    if (!selectedTicketIds.length) {
      toast({
        title: "No Tickets Selected",
        description: "Please select at least one ticket to claim Bingo.",
      });
      return;
    }

    setIsClaiming(true);
    setClaimStatus("pending");

    try {
      // Prepare the tickets data for submission
      const ticketsToSubmit = tickets.filter(ticket => selectedTicketIds.includes(ticket.id));

      // Submit the claim for each selected ticket
      for (const ticket of ticketsToSubmit) {
        const success = submitBingoClaim(ticket, playerCode, sessionId);
        if (!success) {
          toast({
            title: "Claim Submission Failed",
            description: `Failed to submit claim for ticket ${ticket.id}. Please try again.`,
            variant: "destructive",
          });
          setClaimStatus("none");
          return;
        }
      }

      // If all claims were successfully submitted
      toast({
        title: "Claim Submitted",
        description: "Your claim has been submitted and is awaiting validation.",
      });
      setClaimStatus("pending");
    } catch (error: any) {
      console.error("Error submitting claim:", error);
      toast({
        title: "Claim Submission Error",
        description: error.message || "Failed to submit claim. Please try again.",
        variant: "destructive",
      });
      setClaimStatus("none");
    } finally {
      setIsClaiming(false);
    }
  }, [tickets, selectedTicketIds, playerCode, sessionId, submitBingoClaim, toast, setClaimStatus]);

  // Enable/disable claim button based on ticket selection
  useEffect(() => {
    setIsClaimButtonEnabled(selectedTicketIds.length > 0);
  }, [selectedTicketIds]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Game Details</CardTitle>
          <CardDescription>
            Session: {currentSession?.id || 'N/A'} | Player: {playerName || 'N/A'} ({playerCode || 'N/A'})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <Checkbox
              id="auto-marking"
              checked={autoMarking}
              onCheckedChange={(checked) => {
                setAutoMarking(!!checked);
                localStorage.setItem('autoMarking', JSON.stringify(!!checked));
              }}
            />
            <label
              htmlFor="auto-marking"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Auto-Marking
            </label>
            <Button variant="outline" size="sm" onClick={onRefreshTickets}>
              Refresh Tickets
            </Button>
            <Button variant="destructive" size="sm" onClick={onReconnect}>
              Reconnect
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Tickets</CardTitle>
          <CardDescription>Select tickets to claim Bingo!</CardDescription>
        </CardHeader>
        <CardContent>
          {tickets.length > 0 ? (
            <Grid className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tickets.map((ticket) => (
                <div key={ticket.id}>
                  <Ticket
                    ticket={ticket}
                    autoMarking={autoMarking}
                    selected={selectedTicketIds.includes(ticket.id)}
                    onSelect={() => toggleTicketSelection(ticket.id)}
                  />
                </div>
              ))}
            </Grid>
          ) : (
            <p>No tickets available. Please refresh or join a game.</p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button
          size="lg"
          variant="default"
          disabled={!isClaimButtonEnabled || isClaiming || isClaimPending || isClaimValid || isClaimInvalid}
          onClick={handleClaimBingo}
        >
          {isClaiming ? "Submitting Claim..." :
            isClaimPending ? "Claim Pending..." :
              isClaimValid ? "Claim Validated!" :
                isClaimInvalid ? "Claim Rejected" :
                  "Claim Bingo!"}
        </Button>
      </div>
    </div>
  );
};
