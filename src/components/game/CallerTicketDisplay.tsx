
import React from 'react';
import { cn } from "@/lib/utils";

interface CallerTicketDisplayProps {
  ticket: {
    numbers: number[];
    layoutMask: number;
    serial: string;
    perm: number;
    position: number;
  };
  calledNumbers: number[];
  lastCalledNumber: number | null;
  gameType: string;
  winPattern?: string | null;
}

export default function CallerTicketDisplay({
  ticket,
  calledNumbers,
  lastCalledNumber,
  gameType = 'mainstage',
  winPattern
}: CallerTicketDisplayProps) {
  // Process the ticket layout from numbers and mask
  const grid = React.useMemo(() => {
    const rows: (number | null)[][] = [[], [], []];
    
    // Default layout for mainstage (90-ball) bingo: 3 rows x 9 columns
    const columns = gameType === 'mainstage' ? 9 : 5;
    
    // Fill with nulls initially
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < columns; j++) {
        rows[i][j] = null;
      }
    }
    
    if (!ticket || !ticket.numbers || !ticket.layoutMask) {
      return rows;
    }
    
    // Parse layout mask into a grid
    const maskBinary = ticket.layoutMask.toString(2).padStart(27, '0');
    let numberIndex = 0;
    
    for (let row = 0; row < 3; row++) {
      const startIndex = row * 9;
      const rowMask = maskBinary.substring(startIndex, startIndex + 9);
      
      for (let col = 0; col < 9; col++) {
        if (rowMask[col] === '1' && numberIndex < ticket.numbers.length) {
          rows[row][col] = ticket.numbers[numberIndex++];
        }
      }
    }
    
    return rows;
  }, [ticket, gameType]);

  if (!ticket) return null;

  return (
    <div className="ticket-display border rounded-md p-2 text-xs">
      <div className="text-center mb-2 text-gray-500 font-mono">
        Ticket {ticket.serial} ({ticket.perm}/{ticket.position})
      </div>
      <div className="grid grid-rows-3 gap-1">
        {grid.map((row, rowIndex) => (
          <div key={`row-${rowIndex}`} className="flex justify-center gap-1">
            {row.map((number, colIndex) => (
              <div
                key={`cell-${rowIndex}-${colIndex}`}
                className={cn(
                  "w-7 h-7 flex items-center justify-center rounded-sm border",
                  !number && "bg-gray-100 border-gray-200",
                  number && calledNumbers.includes(number) && "bg-green-100 border-green-300",
                  number && lastCalledNumber === number && "bg-blue-200 border-blue-400",
                  number && !calledNumbers.includes(number) && "bg-white border-gray-300"
                )}
              >
                {number || ""}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="text-center mt-2 text-xs text-gray-500">
        {ticket.numbers.filter(n => calledNumbers.includes(n)).length}/{ticket.numbers.length} numbers called
      </div>
    </div>
  );
}
