
import React from 'react';
import BingoTicketDisplay from '@/components/game/BingoTicketDisplay';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PlayerTicket } from '@/hooks/playerTickets/usePlayerTickets';
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";

interface PlayerTicketViewProps {
  tickets: PlayerTicket[];
  calledNumbers: number[];
  lastCalledNumber?: number | null;
  currentWinPattern?: string | null;
  onClaimBingo?: (ticket: PlayerTicket) => void; // Add ability to claim specific ticket
}

export default function PlayerTicketView({
  tickets,
  calledNumbers,
  lastCalledNumber,
  currentWinPattern,
  onClaimBingo
}: PlayerTicketViewProps) {
  // Debug log to see ticket data
  console.log('CLAIM DEBUG - Available tickets in PlayerTicketView:', 
    tickets.map(t => ({ 
      id: t.id, 
      serial: t.serial_number, 
      perm: t.perm_number, 
      position: t.position, 
      is_winning: t.is_winning,
      hasRawNumbers: Array.isArray(t.raw_numbers)
    }))
  );
  
  if (!tickets || tickets.length === 0) {
    return (
      <div className="p-4">
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>No Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-gray-500">You don't have any tickets for this game yet.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {tickets.map((ticket, index) => (
        <Card key={ticket.id || ticket.serial_number || index} className="mb-4">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm flex justify-between">
              <span>Ticket #{ticket.serial_number || index + 1}</span>
              {ticket.is_winning && <span className="text-green-500">Winning!</span>}
              {onClaimBingo && (
                <Button 
                  size="sm" 
                  variant={ticket.is_winning ? "default" : "outline"}
                  className={`flex items-center gap-1 ${ticket.is_winning ? 'bg-green-500 hover:bg-green-600' : ''}`}
                  onClick={() => {
                    // Log the ticket being claimed
                    console.log('CLAIM DEBUG - Claiming specific ticket:', {
                      id: ticket.id,
                      serial: ticket.serial_number,
                      perm: ticket.perm_number,
                      is_winning: ticket.is_winning
                    });
                    onClaimBingo(ticket);
                  }}
                >
                  <Bell className="h-3 w-3" />
                  <span>{ticket.is_winning ? "Claim Winner!" : "Claim This Ticket"}</span>
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ticket ? (
              <BingoTicketDisplay
                numbers={ticket.raw_numbers || ticket.numbers_grid || []} 
                layoutMask={ticket.layout_mask}
                calledNumbers={calledNumbers}
                serial={ticket.serial_number || `T${index}`}
                perm={ticket.perm_number}
                position={ticket.position || 0}
                autoMarking={true}
                currentWinPattern={currentWinPattern}
                showProgress={true}
              />
            ) : (
              <Skeleton className="h-40 w-full" />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
