import React, { useState, useEffect, useCallback } from 'react';
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { useGameContext } from '@/contexts/GameContext';
import { usePlayerTickets } from '@/hooks/playerTickets/usePlayerTickets';
import { usePlayerWebSocketNumbers } from '@/hooks/playerWebSocket/usePlayerWebSocketNumbers';
import { TicketGrid } from '@/components/tickets/TicketGrid';
import { BingoButton } from '@/components/tickets/BingoButton';
import { AutoMarkToggle } from '@/components/tickets/AutoMarkToggle';
import { ConnectionStatus } from '@/components/game/ConnectionStatus';
import { NetworkDebugging } from '@/components/game/NetworkDebugging';

interface PlayerGameContentProps {
  currentSession: { id: string; name: string };
  autoMarking: boolean;
  setAutoMarking: React.Dispatch<React.SetStateAction<boolean>>;
  playerCode: string;
  playerName: string;
  playerId: string;
  onReconnect: () => void;
  sessionId: string;
  onClaimBingo: (ticket: any) => void;
}

export function PlayerGameContent({
  currentSession,
  autoMarking,
  setAutoMarking,
  playerCode,
  playerName,
  playerId,
  onReconnect,
  sessionId,
  onClaimBingo
}: PlayerGameContentProps) {
  const { toast } = useToast();
  const { tickets, isLoading: isLoadingTickets } = usePlayerTickets(playerCode, playerId, sessionId);
  const { calledNumbers, lastCalledNumber, isConnected, connectionState, lastUpdateTime, reconnect } = usePlayerWebSocketNumbers(sessionId);
  const { markNumber, isBingo, resetBingo, selectedTicket, setSelectedTicket } = useGameContext();
  const [isClaiming, setIsClaiming] = useState(false);

  // Auto marking effect
  useEffect(() => {
    if (autoMarking && lastCalledNumber !== null) {
      tickets?.forEach(ticket => {
        if (ticket && ticket.numbers) {
          ticket.numbers.forEach((row, rowIndex) => {
            row.forEach((number, colIndex) => {
              if (number === lastCalledNumber) {
                markNumber(ticket.id, rowIndex, colIndex, number);
              }
            });
          });
        }
      });
    }
  }, [autoMarking, lastCalledNumber, markNumber, tickets]);

  // Load auto marking from local storage
  useEffect(() => {
    const storedAutoMarking = localStorage.getItem('autoMarking');
    if (storedAutoMarking !== null) {
      setAutoMarking(storedAutoMarking === 'true');
    }
  }, [setAutoMarking]);

  // Save auto marking to local storage
  useEffect(() => {
    localStorage.setItem('autoMarking', String(autoMarking));
  }, [autoMarking]);

  // Handle bingo claim
  const handleBingo = useCallback(() => {
    if (!selectedTicket) {
      toast({
        title: "No Ticket Selected",
        description: "Please select a ticket to claim Bingo.",
        variant: "destructive",
      });
      return;
    }

    setIsClaiming(true);
    onClaimBingo(selectedTicket);
  }, [onClaimBingo, selectedTicket, toast]);

  return (
    <div className="space-y-4">
      {/* Status Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold">{currentSession.name}</h2>
          <span className="text-sm text-gray-500">Session ID: {currentSession.id}</span>
        </div>

        {/* Game Info */}
        <div className="text-right">
          <p className="text-sm">
            Last Called:{" "}
            <span className="font-medium">{lastCalledNumber !== null ? lastCalledNumber : "N/A"}</span>
          </p>
          <p className="text-sm text-gray-500">
            Last Update: {new Date(lastUpdateTime).toLocaleTimeString()}
          </p>
        </div>
      </div>

      {/* Auto Mark Toggle */}
      <AutoMarkToggle autoMarking={autoMarking} setAutoMarking={setAutoMarking} />
      
      {/* Network status and debugging components */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <ConnectionStatus 
          sessionId={sessionId} 
          onReconnect={onReconnect}
        />
        {sessionId && <NetworkDebugging sessionId={sessionId} />}
      </div>

      {/* Players info and tickets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Players Info */}
        <Card>
          <Card.Header>
            <Card.Title>Player Info</Card.Title>
          </Card.Header>
          <Card.Content className="space-y-1">
            <p>Name: {playerName}</p>
            <p>Code: {playerCode}</p>
            <p>ID: {playerId}</p>
          </Card.Content>
        </Card>

        {/* Tickets */}
        <Card>
          <Card.Header>
            <Card.Title>Your Tickets</Card.Title>
          </Card.Header>
          <Card.Content className="space-y-4">
            {isLoadingTickets ? (
              <div className="grid grid-cols-2 gap-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-[80px]" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-4 w-[120px]" />
                  </div>
                ))}
              </div>
            ) : tickets && tickets.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {tickets.map((ticket, index) => (
                  <div key={ticket.id} className="space-y-2">
                    <button
                      onClick={() => setSelectedTicket(ticket)}
                      className={`w-full text-sm font-medium rounded-md border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground ${selectedTicket?.id === ticket.id
                        ? 'bg-secondary text-secondary-foreground'
                        : 'bg-muted text-muted-foreground'
                        }`}
                    >
                      Ticket #{index + 1}
                    </button>
                    <TicketGrid ticket={ticket} calledNumbers={calledNumbers} markNumber={markNumber} />
                  </div>
                ))}
              </div>
            ) : (
              <p>No tickets available.</p>
            )}
          </Card.Content>
        </Card>
      </div>

      {/* Bingo Claim Button */}
      <BingoButton isBingo={isBingo} handleBingo={handleBingo} isClaiming={isClaiming} />
    </div>
  );
}
