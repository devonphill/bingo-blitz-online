
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
  // Log more detailed type info for debugging
  const numberType = Array.isArray(props.numbers) 
    ? (Array.isArray(props.numbers[0]) ? '2D array' : '1D array') 
    : 'not array';
  
  console.log(`SafeBingoTicketDisplay - Ticket ${props.serial}, numbers type: ${numberType}, length: ${
    Array.isArray(props.numbers) ? props.numbers.length : 0
  }`);
  
  return (
    <TicketErrorBoundary serial={props.serial}>
      <SimpleBingoTicketDisplay {...props} />
    </TicketErrorBoundary>
  );
}
