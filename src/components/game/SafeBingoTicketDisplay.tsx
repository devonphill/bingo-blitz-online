
import React from 'react';
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
  let flatNumbers: number[] = [];
  
  if (Array.isArray(props.numbers)) {
    // Check if it's already a flat array
    if (!Array.isArray(props.numbers[0])) {
      flatNumbers = props.numbers as number[];
    } else {
      // It's a 2D array, flatten it
      flatNumbers = (props.numbers as number[][]).flat().filter(n => n !== null && n !== undefined) as number[];
    }
  }
  
  // Log more detailed type info for debugging
  const numberType = Array.isArray(props.numbers) 
    ? (Array.isArray(props.numbers[0]) ? '2D array' : '1D array') 
    : 'not array';
  
  console.log(`SafeBingoTicketDisplay - Ticket ${props.serial}, numbers type: ${numberType}, length: ${
    Array.isArray(props.numbers) ? props.numbers.length : 0
  }`);
  
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
