
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export interface BingoCardGridProps {
  tickets: any[];
  calledNumbers: number[];
  currentCalledNumber?: number | null;
  autoMarking?: boolean;
  gameType?: string;
  winPattern?: string | null;
  onRefreshTickets?: () => void;
}

export default function BingoCardGrid({
  tickets,
  calledNumbers,
  currentCalledNumber,
  autoMarking = true,
  gameType = 'mainstage',
  winPattern,
  onRefreshTickets
}: BingoCardGridProps) {
  // This is a simplified placeholder until we implement the actual grid
  return (
    <div className="space-y-4">
      {tickets.length === 0 ? (
        <Card className="p-8 text-center">
          <CardContent className="pt-6">
            <p className="text-gray-500">No tickets available</p>
            {onRefreshTickets && (
              <Button 
                variant="outline" 
                onClick={onRefreshTickets}
                className="mt-4"
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh Tickets
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tickets.map((ticket, index) => (
            <Card key={index} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="text-center p-4 bg-gray-50 rounded-md mb-2">
                  <p className="text-sm text-gray-500">Ticket ID: {ticket.serial || index + 1}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm">
                    {autoMarking ? 'Auto marking enabled' : 'Manual marking'}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
