import React, { useState, useEffect, useCallback } from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { MainLayout } from "@/components/layout";
import { GameHeader } from "@/components/game/GameHeader";
import { GameBoard } from "@/components/game/GameBoard";
import { GameController } from "@/components/game/GameController";
import { useGameContext } from "@/context/game.context";
import { PlayerGameContent, PlayerGameContentProps } from "@/components/game/PlayerGameContent";
import { useConnection } from "@/context/connection.context";
import { useToast } from "@/components/ui/use-toast";
import { ConnectionStatus } from "@/components/connection/ConnectionStatus";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface PlayerGameLayoutProps {
    playerCode: string;
}

export const PlayerGameLayout: React.FC<PlayerGameLayoutProps> = ({ playerCode }) => {
    const {
        tickets,
        calledNumbers,
        gameId,
        setGameId,
        setTickets,
        setCalledNumbers,
        resetGame,
        isLoading
    } = useGameContext();
    const { isConnected } = useConnection();
    const { toast } = useToast();
    const [showConfetti, setShowConfetti] = useState(false);

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

    useEffect(() => {
        if (gameId) {
            // Check for win condition here, for example:
            if (tickets && tickets.length > 0 && calledNumbers && calledNumbers.length > 0) {
                const hasWinningTicket = tickets.some(ticket =>
                    ticket.numbers.every(number => calledNumbers.includes(number))
                );
                if (hasWinningTicket) {
                    handleWin();
                }
            }
        }
    }, [calledNumbers, tickets, gameId, handleWin]);

    return (
        <MainLayout>
            <div className="flex flex-col h-screen">
                <GameHeader playerCode={playerCode} />
                <div className="flex-grow overflow-auto">
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
                        <PlayerGameContent tickets={tickets} playerCode={playerCode} />
                    )}
                </div>
                <ConnectionStatus />
            </div>
        </MainLayout>
    );
};
