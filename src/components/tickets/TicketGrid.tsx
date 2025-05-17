
import React from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Bell } from 'lucide-react';
import { PlayerTicket } from '@/hooks/playerTickets/usePlayerTickets';

interface TicketGridProps {
  tickets: PlayerTicket[];
  calledNumbers: number[];
  claimTicket: (ticket: PlayerTicket) => void;
}

export default function TicketGrid({ tickets, calledNumbers, claimTicket }: TicketGridProps) {
  if (!tickets || tickets.length === 0) {
    return (
      <div className="text-center p-4">
        <p className="text-gray-500">No tickets available.</p>
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {tickets.map((ticket, index) => {
        // Check if ticket has winning status
        const isWinning = Boolean(ticket.is_winning);
        
        // Ensure we have access to raw_numbers or numbers_grid
        const ticketNumbers = ticket.raw_numbers || ticket.numbers_grid || [];
        
        return (
          <Card key={ticket.id || `ticket-${index}`} className={`p-4 ${isWinning ? 'border-green-500 border-2' : ''}`}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">
                Ticket #{ticket.serial_number || index + 1}
              </h3>
              <Button
                size="sm"
                variant={isWinning ? "default" : "outline"}
                className={`${isWinning ? "bg-green-500 hover:bg-green-600" : ""}`}
                onClick={() => claimTicket(ticket)}
              >
                <Bell className="h-3 w-3 mr-1" />
                {isWinning ? "Claim Winner!" : "Claim"}
              </Button>
            </div>
            
            <div className="grid grid-cols-9 gap-1">
              {/* This would be your ticket display based on the numbers */}
              {Array.isArray(ticketNumbers) && ticketNumbers.map((num, idx) => (
                <div 
                  key={idx}
                  className={`
                    aspect-square flex items-center justify-center 
                    border rounded-sm text-xs
                    ${calledNumbers.includes(num) ? "bg-green-100 border-green-500" : "bg-white"}
                  `}
                >
                  {num || ''}
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
