
import React, { createContext, useContext, ReactNode } from "react";
import { GameSession, Player } from "@/types";
import { usePlayers, AdminTempPlayer } from "./usePlayers";
import { useTickets } from "./useTickets";
import { useSessions } from "./useSessions";

// Define the context type
interface SessionContextType {
  sessions: GameSession[];
  currentSession: GameSession | null;
  setCurrentSession: (sessionId: string | null) => void;
  getSessionByCode: (code: string) => GameSession | null;
  fetchSessions: () => Promise<void>;
  // Player logic
  players: Player[];
  joinSession: ReturnType<typeof usePlayers>["joinSession"];
  addPlayer: ReturnType<typeof usePlayers>["addPlayer"];
  bulkAddPlayers: (sessionId: string, newPlayers: AdminTempPlayer[]) => Promise<{ success: boolean; message?: string }>;
  // Ticket logic
  assignTicketsToPlayer: ReturnType<typeof useTickets>["assignTicketsToPlayer"];
  getPlayerAssignedTickets: ReturnType<typeof useTickets>["getPlayerAssignedTickets"];
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  // Split out session logic
  const {
    sessions,
    currentSession,
    setCurrentSession,
    getSessionByCode,
    fetchSessions,
  } = useSessions();

  // Ticket and player hooks (delegated)
  const ticketHook = useTickets();
  const playerHook = usePlayers(
    sessions,
    fetchSessions,
    ticketHook.assignTicketsToPlayer
  );

  return (
    <SessionContext.Provider
      value={{
        sessions,
        currentSession,
        setCurrentSession,
        getSessionByCode,
        fetchSessions,
        players: playerHook.players,
        joinSession: playerHook.joinSession,
        addPlayer: playerHook.addPlayer,
        bulkAddPlayers: playerHook.bulkAddPlayers,
        assignTicketsToPlayer: ticketHook.assignTicketsToPlayer,
        getPlayerAssignedTickets: ticketHook.getPlayerAssignedTickets,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
