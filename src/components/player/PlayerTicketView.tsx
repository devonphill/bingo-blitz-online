
import React from 'react';
import BingoTicketDisplay from '@/components/game/BingoTicketDisplay';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface PlayerTicketViewProps {
  tickets: any[];
  calledNumbers: number[];
  lastCalledNumber?: number | null;
  currentWinPattern?: string | null;
}

export default function PlayerTicketView({
  tickets,
  calledNumbers,
  lastCalledNumber,
  currentWinPattern
}: PlayerTicketViewProps) {
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
        <Card key={ticket.id || ticket.serial || index} className="mb-4">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm flex justify-between">
              <span>Ticket #{ticket.serial || index + 1}</span>
              {ticket.isWinning && <span className="text-green-500">Winning!</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ticket ? (
              <BingoTicketDisplay
                numbers={ticket.numbers || []}
                layoutMask={ticket.layoutMask || 0}
                calledNumbers={calledNumbers}
                serial={ticket.serial || `T${index}`}
                perm={ticket.perm || 0}
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
