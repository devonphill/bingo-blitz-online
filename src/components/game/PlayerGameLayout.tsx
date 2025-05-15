
import React, { useState, useEffect, useCallback } from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { MainLayout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PlayerGameContent } from "@/components/game";

interface PlayerGameLayoutProps {
    playerCode: string;
}

export const PlayerGameLayout: React.FC<PlayerGameLayoutProps> = ({ playerCode }) => {
    const [showConfetti, setShowConfetti] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [tickets, setTickets] = useState<any[]>([]);
    const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
    const { toast } = useToast();

    // Simulate loading state - in a real implementation you'd fetch tickets
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 1500);
        
        return () => clearTimeout(timer);
    }, []);

    const handleWin = useCallback(() => {
        setShowConfetti(true);
        toast({
            title: "You Won!",
            description: "Congratulations! You have a winning ticket!",
        });
        setTimeout(() => {
            setShowConfetti(false);
        }, 5000);
    }, [toast]);

    return (
        <MainLayout>
            <div className="flex flex-col h-screen">
                <div className="p-4 bg-primary/10 border-b">
                    <h1 className="text-2xl font-bold">Game Session</h1>
                    <p className="text-sm text-muted-foreground">Player Code: {playerCode}</p>
                </div>
                <div className="flex-grow overflow-auto p-4">
                    {isLoading ? (
                        <Card className="w-full h-full flex items-center justify-center">
                            <CardContent>
                                <div className="flex flex-col items-center justify-center">
                                    <Skeleton className="w-[200px] h-[20px] mb-4" />
                                    <Skeleton className="w-[150px] h-[15px]" />
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <PlayerGameContent 
                            tickets={tickets}
                            playerCode={playerCode}
                            currentSession={{ id: "", name: "Game Session" }}
                            autoMarking={true}
                            setAutoMarking={() => {}}
                            playerName=""
                            playerId=""
                            onReconnect={() => {}}
                            sessionId=""
                            onClaimBingo={() => {}}
                        />
                    )}
                </div>
                <div className="p-4 border-t">
                    <div className="flex items-center justify-between">
                        <Badge variant="outline">Connected</Badge>
                        <span className="text-xs text-muted-foreground">Connection Status</span>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
};
