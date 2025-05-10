
import React from 'react';

interface PartyBingoGameProps {
  tickets: any[];
  calledNumbers: number[];
  lastCalledNumber: number | null;
  autoMarking?: boolean;
  setAutoMarking?: (value: boolean) => void;
}

export default function PartyBingoGame({
  tickets,
  calledNumbers,
  lastCalledNumber,
  autoMarking = true,
  setAutoMarking
}: PartyBingoGameProps) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">Party Bingo (80 Ball)</h2>
        <p className="text-sm text-gray-600">
          Your party bingo tickets will appear here
        </p>
      </div>
      
      {tickets && tickets.length > 0 ? (
        <div className="space-y-4">
          {tickets.map((ticket, index) => (
            <div key={`ticket-${index}`} className="border rounded-md p-2">
              <p className="text-xs text-gray-500 mb-2">Ticket #{ticket.serial || index + 1}</p>
              {/* Simplified ticket display */}
              <div className="grid grid-cols-8 gap-1">
                {ticket.numbers && ticket.numbers.map((num: number, i: number) => (
                  <div 
                    key={`num-${i}`}
                    className={`w-8 h-8 flex items-center justify-center rounded-full
                      ${calledNumbers.includes(num) 
                        ? 'bg-pink-500 text-white' 
                        : 'bg-gray-100 text-gray-800'}`}
                  >
                    {num}
                  </div>
                ))}
              </div>
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
