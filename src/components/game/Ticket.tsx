
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface TicketProps {
  ticket: any;
  autoMarking: boolean;
  selected?: boolean;
  onSelect?: () => void;
}

export const Ticket: React.FC<TicketProps> = ({
  ticket,
  autoMarking,
  selected = false,
  onSelect
}) => {
  const ticketNumbers = ticket.numbers || [];
  const ticketLayout = ticket.layout_mask || 0;
  
  // Function to render a cell in the ticket grid
  const renderCell = (rowIndex: number, colIndex: number) => {
    const cellIndex = rowIndex * 9 + colIndex;
    const hasBit = (ticketLayout & (1 << cellIndex)) !== 0;
    const number = hasBit ? ticketNumbers[getCellValueIndex(ticketLayout, cellIndex)] : null;
    
    return (
      <div 
        key={`cell-${rowIndex}-${colIndex}`}
        className={cn(
          "h-8 w-8 flex items-center justify-center rounded-md text-sm font-medium",
          hasBit ? "bg-white border border-gray-300" : "bg-transparent",
          selected && hasBit ? "bg-blue-100 border-blue-400" : ""
        )}
      >
        {number !== null && number}
      </div>
    );
  };
  
  // Function to calculate the index of a value in the numbers array based on layout mask
  const getCellValueIndex = (layoutMask: number, cellPosition: number): number => {
    let count = 0;
    for (let i = 0; i < cellPosition; i++) {
      if ((layoutMask & (1 << i)) !== 0) {
        count++;
      }
    }
    return count;
  };
  
  return (
    <Card 
      className={cn(
        "p-2 cursor-pointer transition-all",
        selected ? "ring-2 ring-blue-500 shadow-lg" : "hover:shadow-md"
      )}
      onClick={onSelect}
    >
      <CardContent className="p-2">
        <div className="text-xs mb-2 flex justify-between">
          <span>Ticket: {ticket.serial || ticket.id}</span>
          <span>{selected ? "Selected" : "Click to select"}</span>
        </div>
        <div className="grid grid-cols-9 gap-1">
          {Array(3).fill(0).map((_, rowIndex) => (
            Array(9).fill(0).map((_, colIndex) => (
              renderCell(rowIndex, colIndex)
            ))
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
