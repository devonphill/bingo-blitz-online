
import React from 'react';
import SafeBingoTicketDisplay from './SafeBingoTicketDisplay';

/**
 * This is a wrapper component that forwards to SafeBingoTicketDisplay
 * Created to maintain backward compatibility with existing code
 */
interface BingoTicketDisplayProps {
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

export default function BingoTicketDisplay(props: BingoTicketDisplayProps) {
  // Log incoming data for debugging
  console.log(`BingoTicketDisplay - Rendering ticket ${props.serial}, numbers type: ${
    Array.isArray(props.numbers) ? 
      (Array.isArray(props.numbers[0]) ? '2D array' : '1D array') : 'not array'
  }, length: ${Array.isArray(props.numbers) ? props.numbers.length : 0}`);
  
  return <SafeBingoTicketDisplay {...props} />;
}
