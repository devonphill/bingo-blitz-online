
import React from 'react';

interface CallerTicketDisplayProps {
  ticket: {
    numbers: number[];
    serial: string;
  };
  calledNumbers: number[];
  lastCalledNumber: number | null;
}

export default function CallerTicketDisplay({ 
  ticket, 
  calledNumbers, 
  lastCalledNumber 
}: CallerTicketDisplayProps) {
  return (
    <div className="grid grid-cols-9 gap-1 p-2 border rounded">
      {ticket.numbers.map((number, index) => (
        <div
          key={`${ticket.serial}-${index}`}
          className={`
            aspect-square flex items-center justify-center text-sm font-medium p-2 rounded
            ${calledNumbers.includes(number) 
              ? 'bg-green-500 text-white' 
              : 'bg-red-500 text-white'}
            ${lastCalledNumber === number 
              ? 'animate-[pulse_1s_ease-in-out_infinite]' 
              : ''}
          `}
        >
          {number}
        </div>
      ))}
    </div>
  );
}
