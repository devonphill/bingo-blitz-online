
import React from 'react';
import ClaimItem from './ClaimItem';
import { Button } from "@/components/ui/button";
import { RefreshCw } from 'lucide-react';
import { ClaimData } from '@/types/claim';

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

const ClaimsList: React.FC<ClaimsListProps> = ({
  claims,
  currentCalledNumbers,
  currentNumber,
  gameType,
  currentWinPattern,
  onVerify,
  onReject,
  isProcessingClaim,
  onRefresh
}) => {
  // Log claims data to verify we're getting all needed information
  React.useEffect(() => {
    console.log('[ClaimsList] Claims to render:', claims);
  }, [claims]);

  if (!claims || claims.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-gray-50 border border-dashed rounded-lg">
        <p className="text-gray-500 mb-4">No claims to verify</p>
        <Button 
          variant="outline" 
          onClick={onRefresh} 
          className="flex items-center gap-1"
          size="sm"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {claims.map((claim) => (
        <ClaimItem
          key={claim.id}
          claim={claim}
          currentCalledNumbers={currentCalledNumbers}
          currentNumber={currentNumber}
          gameType={gameType}
          currentWinPattern={currentWinPattern}
          onVerify={onVerify}
          onReject={onReject}
          isProcessingClaim={isProcessingClaim && claim.id === claims[0].id}
        />
      ))}
    </div>
  );
};

export default ClaimsList;
