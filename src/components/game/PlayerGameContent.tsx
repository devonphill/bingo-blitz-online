import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { BellRing, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { NetworkDebugging } from '@/components/game';
import { Spinner } from "@/components/ui/spinner";
import { PlayerTicketManager } from '@/components/player/PlayerTicketManager';

interface PlayerGameContentProps {
  tickets?: any[];
  currentSession: any;
  autoMarking: boolean;
  setAutoMarking: (value: boolean) => void;
  playerCode: string;
  playerName?: string;
  playerId?: string;
  onRefreshTickets?: () => void;
  onReconnect?: () => void;
  sessionId?: string;
  onClaimBingo?: (ticket: any) => void;
}

export function PlayerGameContent({
  currentSession,
  autoMarking,
  setAutoMarking,
  playerCode,
  playerName,
  onReconnect,
  onClaimBingo
}: PlayerGameContentProps) {
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Handle saving auto-marking preference to localStorage
  const handleAutoMarkingChange = (checked: boolean) => {
    setAutoMarking(checked);
    localStorage.setItem('autoMarking', checked.toString());
    toast({
      title: checked ? "Auto-marking enabled" : "Auto-marking disabled",
      description: checked 
        ? "Numbers will be automatically marked on your tickets." 
        : "You'll need to mark numbers manually.",
    });
  };
  
  const handleClaimBingo = () => {
    if (onClaimBingo) {
      console.log('CLAIM DEBUG - Initiating claim from PlayerGameContent');
      // Pass an empty object as the ticket - this will make the handler use the first available ticket
      // This is likely part of the problem - we're not specifying which ticket to claim
      onClaimBingo({});
      toast({
        title: "Bingo Claim Submitted",
        description: "Your claim has been submitted and is awaiting verification.",
      });
    } else {
      toast({
        title: "Claim Not Available",
        description: "The claim function is not available at this time.",
        variant: "destructive",
      });
    }
  };
  
  const handleRefreshClick = () => {
    if (onReconnect) {
      setIsRefreshing(true);
      onReconnect();
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Game Header */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>
            {currentSession?.name || "Game Session"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <p className="text-sm text-gray-500">
                Playing as: <span className="font-semibold">{playerName || playerCode}</span>
              </p>
              <p className="text-sm text-gray-500">
                Game Type: <span className="font-semibold">{currentSession?.gameType || "Standard"}</span>
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex items-center space-x-2">
                <Switch 
                  id="auto-marking" 
                  checked={autoMarking} 
                  onCheckedChange={handleAutoMarkingChange} 
                />
                <Label htmlFor="auto-marking">Auto-marking</Label>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex items-center gap-2" 
                onClick={handleRefreshClick}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <>
                    <Spinner size="sm" />
                    <span>Reconnecting...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3 w-3" />
                    <span>Reconnect</span>
                  </>
                )}
              </Button>
              <Button 
                variant="secondary" 
                size="sm"
                className="flex items-center gap-2"
                onClick={handleClaimBingo}
              >
                <BellRing className="h-4 w-4" />
                <span>Claim Bingo</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Tickets Display */}
      <PlayerTicketManager 
        autoMarking={autoMarking}
        onClaimBingo={onClaimBingo}
      />
      
      {/* Network Debugging (for development only) */}
      <div className="mt-8 border-t pt-4">
        <details className="text-sm">
          <summary className="cursor-pointer text-gray-500 hover:text-gray-700">Debug Information</summary>
          <div className="mt-2 p-4 bg-gray-50 rounded-md">
            <NetworkDebugging />
          </div>
        </details>
      </div>
    </div>
  );
}
