
import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import SafeBingoTicketDisplay from './SafeBingoTicketDisplay';
import { normalizeWinPattern } from '@/utils/winPatternUtils';

interface MainstageBingoGameProps {
  tickets: any[];
  calledNumbers: number[];
  lastCalledNumber: number | null;
  autoMarking?: boolean;
  setAutoMarking?: (value: boolean) => void;
  currentWinPattern?: string | null;
}

export default function MainstageBingoGame({
  tickets,
  calledNumbers,
  lastCalledNumber,
  autoMarking = true,
  setAutoMarking,
  currentWinPattern = 'oneLine'
}: MainstageBingoGameProps) {
  // Always use MAINSTAGE_ prefixed patterns for this game type
  const normalizedWinPattern = normalizeWinPattern(currentWinPattern, 'MAINSTAGE');

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">Mainstage Bingo (90 Ball)</h2>
        <p className="text-sm text-gray-600 mb-2">
          Your bingo tickets will appear here
        </p>
        
        {setAutoMarking && (
          <div className="flex items-center justify-center gap-2 mb-4">
            <Switch
              id="auto-marking"
              checked={autoMarking}
              onCheckedChange={setAutoMarking}
            />
            <Label htmlFor="auto-marking">Auto Marking</Label>
          </div>
        )}
      </div>
      
      {tickets && tickets.length > 0 ? (
        <div className="space-y-6">
          {tickets.map((ticket, index) => (
            <div key={`ticket-${index}`} className="border rounded-md p-3">
              <SafeBingoTicketDisplay
                numbers={ticket.numbers || []}
                layoutMask={ticket.layout_mask || ticket.layoutMask || 0}
                calledNumbers={calledNumbers}
                serial={ticket.serial || `T-${index + 1}`}
                perm={ticket.perm || 0}
                position={ticket.position}
                autoMarking={autoMarking}
                currentWinPattern={normalizedWinPattern}
                showProgress={true}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          No tickets available for this game
        </div>
      )}
    </div>
  );
}
