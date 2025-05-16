
import React from 'react';
import { PlayerTicket } from '@/hooks/playerTickets/usePlayerTickets';

interface TicketGridProps {
  ticket: PlayerTicket;
  calledNumbers: number[];
  markNumber?: (ticketId: string, row: number, col: number, value: number) => void;
}

export const TicketGrid: React.FC<TicketGridProps> = ({ 
  ticket, 
  calledNumbers, 
  markNumber
}) => {
  const handleCellClick = (row: number, col: number, value: number) => {
    if (markNumber) {
      markNumber(ticket.id, row, col, value);
    }
  };
  
  const isNumberCalled = (num: number) => {
    return num !== 0 && calledNumbers.includes(num);
  };
  
  const isNumberMarked = (row: number, col: number) => {
    return ticket.markedPositions?.some(
      pos => pos.row === row && pos.col === col
    ) || false;
  };
  
  return (
    <div className="bg-white border rounded-md overflow-hidden">
      <table className="w-full border-collapse text-center">
        <tbody>
          {ticket.numbers?.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`} className="border-b last:border-b-0">
              {row.map((num, colIndex) => (
                <td 
                  key={`cell-${rowIndex}-${colIndex}`}
                  className={`p-1 border-r last:border-r-0 ${
                    num === 0 ? 'bg-gray-200' : ''
                  } ${
                    (isNumberCalled(num) || isNumberMarked(rowIndex, colIndex)) && num !== 0 ? 'bg-blue-100' : ''
                  }`}
                  onClick={() => num !== 0 && handleCellClick(rowIndex, colIndex, num)}
                >
                  {num === 0 ? '' : (
                    <div className={`w-full h-full flex items-center justify-center ${
                      isNumberCalled(num) || isNumberMarked(rowIndex, colIndex) ? 'text-blue-600 font-bold' : ''
                    }`}>
                      {num}
                    </div>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
