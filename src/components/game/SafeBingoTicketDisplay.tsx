
import React, { useMemo } from 'react';
import TicketErrorBoundary from './TicketErrorBoundary';
import SimpleBingoTicketDisplay from './SimpleBingoTicketDisplay';

interface SafeBingoTicketDisplayProps {
  numbers: number[] | number[][];  // Allow either format
  layoutMask: number;
  calledNumbers: number[];
  serial: string;
  perm: number;
  position?: number;
  autoMarking?: boolean;
  currentWinPattern?: string | null;
  showProgress?: boolean;
}

/**
 * Error-protected bingo ticket display component
 * Wraps the SimpleBingoTicketDisplay with an error boundary
 */
export default function SafeBingoTicketDisplay(props: SafeBingoTicketDisplayProps) {
  // Ensure we have a flat array of numbers
  const flatNumbers = useMemo(() => {
    if (!Array.isArray(props.numbers)) {
      console.error(`Invalid numbers prop: ${props.numbers}`);
      return [];
    }
    
    // Check if it's already a flat array
    if (props.numbers.length > 0 && !Array.isArray(props.numbers[0])) {
      return props.numbers as number[];
    }
    
    // It's a 2D array, flatten it
    return (props.numbers as number[][]).flat().filter(n => n !== null && n !== undefined) as number[];
  }, [props.numbers]);
  
  // Log more detailed type info for debugging
  console.log(`SafeBingoTicketDisplay - Ticket ${props.serial}, numbers: ${flatNumbers.length}, layout mask: ${props.layoutMask}`);
  
  return (
    <TicketErrorBoundary serial={props.serial}>
      <SimpleBingoTicketDisplay 
        numbers={flatNumbers}
        layoutMask={props.layoutMask}
        calledNumbers={props.calledNumbers}
        serial={props.serial}
        perm={props.perm}
        autoMarking={props.autoMarking}
        showHeader={true}
      />
    </TicketErrorBoundary>
  );
}
