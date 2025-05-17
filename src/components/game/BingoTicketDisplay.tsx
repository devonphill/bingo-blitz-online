
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
  // Convert 2D array to flat array if necessary
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
  
  // Log incoming data for debugging
  console.log(`BingoTicketDisplay - Rendering ticket ${props.serial}, numbers type: ${
    Array.isArray(props.numbers) ? 
      (Array.isArray(props.numbers[0]) ? '2D array' : '1D array') : 'not array'
  }, length: ${Array.isArray(props.numbers) ? props.numbers.length : 0}`);
  
  return <SafeBingoTicketDisplay 
    {...props} 
    numbers={flatNumbers} 
  />;
}
