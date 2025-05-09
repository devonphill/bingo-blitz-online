
import React from 'react';
import { Button } from "@/components/ui/button";
import { RefreshCw } from 'lucide-react';
import { ClaimData } from '@/types/claim';
import ClaimItem from './ClaimItem';

interface ClaimsListProps {
  claims: ClaimData[];
  currentCalledNumbers: number[];
  currentNumber: number | null;
  gameType: string;
  currentWinPattern: string | null;
  onVerify: (claim: ClaimData) => Promise<void>;
  onReject: (claim: ClaimData) => Promise<void>;
  isProcessingClaim: boolean;
  onRefresh: () => void;
}

export default function ClaimsList({
  claims,
  currentCalledNumbers,
  currentNumber,
  gameType,
  currentWinPattern,
  onVerify,
  onReject,
  isProcessingClaim,
  onRefresh
}: ClaimsListProps) {
  if (!claims || claims.length === 0) {
    return (
      <div className="text-center text-gray-500 p-8">
        <p className="mb-2">No claims to review at this time.</p>
        <p className="text-sm text-muted-foreground mb-4">
          Claims will appear here automatically when players submit them.
        </p>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onRefresh}
          className="mx-auto"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Force Refresh
        </Button>
      </div>
    );
  }

  return (
    <>
      {claims.map((claim, index) => (
        <ClaimItem
          key={claim.id || index}
          claim={claim}
          currentCalledNumbers={currentCalledNumbers}
          currentNumber={currentNumber}
          gameType={gameType}
          currentWinPattern={currentWinPattern}
          onVerify={onVerify}
          onReject={onReject}
          isProcessingClaim={isProcessingClaim}
        />
      ))}
    </>
  );
}
