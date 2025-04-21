
// BingoCard.tsx -- splits to use BingoCardGrid and BingoCell

import React, { useState, useEffect } from 'react';
import BingoCardGrid from './BingoCardGrid';
import { useAutoMark } from './useAutoMark';

interface BingoCardProps {
  numbers?: number[];
  layoutMask?: number;
  calledNumbers?: number[];
  autoMarking?: boolean;
}

export default function BingoCard({
  numbers = [],
  layoutMask,
  calledNumbers = [],
  autoMarking = true
}: BingoCardProps) {
  const {
    card,
    markedCells,
    setMarkedCells,
    generateCardFromNumbersAndMask,
    generateCardFromNumbers,
    generateCard
  } = useAutoMark({ numbers, layoutMask, calledNumbers, autoMarking });

  // Reset marked cells when prop changes and not autoMarking
  useEffect(() => {
    if (autoMarking) setMarkedCells(new Set());
  }, [autoMarking, numbers, layoutMask, setMarkedCells]);

  return (
    <BingoCardGrid
      card={card}
      markedCells={markedCells}
      calledNumbers={calledNumbers}
      autoMarking={autoMarking}
      setMarkedCells={setMarkedCells}
    />
  );
}
