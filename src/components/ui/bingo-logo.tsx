
import React from 'react';

export interface BingoLogoProps {
  className?: string;
}

export const BingoLogo: React.FC<BingoLogoProps> = ({ className }) => {
  return (
    <div className={`font-bold text-xl ${className}`}>
      <span className="text-bingo-primary">B</span>
      <span className="text-bingo-secondary">I</span>
      <span className="text-bingo-tertiary">N</span>
      <span className="text-amber-500">G</span>
      <span className="text-indigo-500">O</span>
    </div>
  );
};
