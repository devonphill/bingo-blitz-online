
import React from 'react';

interface ClaimToastDisplayProps {
  description: string;
  ticketData: any;
  calledNumbers: number[];
}

/**
 * A specialized component for displaying ticket information in toast notifications
 */
export default function ClaimToastDisplay({
  description,
  ticketData,
  calledNumbers = []
}: ClaimToastDisplayProps) {
  // Get first 5 numbers to show in simplified view
  const displayNumbers = ticketData?.numbers?.slice(0, 5) || [];
  const totalMarked = ticketData?.numbers?.filter((n: number) => calledNumbers.includes(n)).length || 0;
  
  return (
    <div className="flex flex-col">
      <div className="text-sm">{description}</div>
      <div className="flex items-center gap-1 mt-1">
        {displayNumbers.map((num: number, i: number) => (
          <div 
            key={`toast-num-${i}`}
            className={`w-6 h-6 flex items-center justify-center rounded-full text-xs 
              ${calledNumbers.includes(num) ? "bg-amber-500 text-white" : "bg-gray-200 text-gray-700"}`
            }
          >
            {num}
          </div>
        ))}
        {ticketData?.numbers?.length > 5 && (
          <div className="text-xs ml-1">+{ticketData.numbers.length - 5} more</div>
        )}
      </div>
      <div className="text-xs text-gray-500 mt-1">
        Ticket: {ticketData?.serial} • {totalMarked}/{ticketData?.numbers?.length || 0} called
      </div>
    </div>
  );
}
