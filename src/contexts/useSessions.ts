
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GameSession, GameConfig } from '@/types';
import { convertFromLegacyConfig } from '@/utils/callerSessionHelper';
import { jsonToGameConfigs, gameConfigsToJson } from '@/utils/jsonUtils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export function useSessions() {
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [currentSession, setCurrentSession] = useState<GameSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log("Fetching all game sessions");
      
      // Create a query that filters by the current user's ID if a user is logged in
      let query = supabase.from('game_sessions').select('*');
      
      if (user) {
        console.log(`Filtering sessions for user: ${user.id}`);
        query = query.eq('created_by', user.id);
      }
      
      // Add ordering
      const { data, error: fetchError } = await query.order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching sessions:', fetchError);
        throw new Error(`Database error: ${fetchError.message}`);
      }

      if (data) {
        console.log(`Retrieved ${data.length} sessions from database for ${user ? 'user ' + user.id : 'anonymous user'}`);
        
        // Convert raw data to GameSession objects
        const sessionObjects: GameSession[] = data.map(session => {
          // Process games_config to ensure it's in the correct format
          let processedGamesConfig: GameConfig[] = [];
          
          if (session.games_config) {
            console.log(`Session ${session.id} - Raw games_config:`, session.games_config);
            
            try {
              // Use jsonToGameConfigs to safely convert the JSON data
              // This explicitly handles the active flag to ensure it's only true if explicitly set to true
              processedGamesConfig = jsonToGameConfigs(session.games_config);
              console.log(`Session ${session.id} - Processed games_config:`, processedGamesConfig);
            } catch (parseError) {
              console.error(`Error parsing games_config for session ${session.id}:`, parseError);
            }
          }
          
          return {
            id: session.id,
            name: session.name,
            gameType: session.game_type as any,
            createdBy: session.created_by,
            accessCode: session.access_code,
            status: session.status as any,
            createdAt: session.created_at,
            sessionDate: session.session_date,
            numberOfGames: session.number_of_games,
            current_game: session.current_game,
            lifecycle_state: session.lifecycle_state as any,
            games_config: processedGamesConfig
          };
        });
        
        console.log("Final processed sessions:", sessionObjects);
        setSessions(sessionObjects);
      }
    } catch (err) {
      const errorMessage = `An error occurred while fetching sessions: ${(err as Error).message}`;
      console.error(errorMessage);
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, user]);

  const setSessionById = useCallback((sessionId: string | null) => {
    if (!sessionId) {
      setCurrentSession(null);
      return;
    }

    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      console.log("Setting current session:", session);
      setCurrentSession(session);
    } else {
      console.warn(`Session with ID ${sessionId} not found.`);
      toast({
        title: "Warning",
        description: `Session with ID ${sessionId} not found.`,
        variant: "destructive" // Changed from "warning" to "destructive"
      });
    }
  }, [sessions, toast]);

  const getSessionByCode = useCallback((code: string): GameSession | null => {
    return sessions.find(s => s.accessCode === code) || null;
  }, [sessions]);

  const updateSession = useCallback(async (sessionId: string, updates: Partial<GameSession>): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!sessionId) {
        throw new Error("No session ID provided for update");
      }
      
      console.log(`Updating session ${sessionId} with:`, updates);
      
      // Convert the updates to database column names
      const dbUpdates: Record<string, any> = {};
      if ('gameType' in updates) dbUpdates.game_type = updates.gameType;
      
      if ('games_config' in updates && updates.games_config) {
        console.log("games_config updates to save:", updates.games_config);
        
        // Convert the GameConfig[] to JSON for storage
        // This ensures patterns are only active if explicitly true
        try {
          dbUpdates.games_config = gameConfigsToJson(updates.games_config);
        } catch (jsonError) {
          console.error("Error converting games_config to JSON:", jsonError);
          throw new Error(`Failed to convert game configs to JSON: ${(jsonError as Error).message}`);
        }
        
        console.log("Converted games_config for database:", dbUpdates.games_config);
      }
      
      if ('status' in updates) dbUpdates.status = updates.status;
      if ('lifecycle_state' in updates) dbUpdates.lifecycle_state = updates.lifecycle_state;
      if ('current_game' in updates) dbUpdates.current_game = updates.current_game;
      if ('numberOfGames' in updates) dbUpdates.number_of_games = updates.numberOfGames;
      if ('name' in updates) dbUpdates.name = updates.name;

      // Save to the database
      const { error: updateError } = await supabase
        .from('game_sessions')
        .update(dbUpdates)
        .eq('id', sessionId);

      if (updateError) {
        console.error('Error updating session:', updateError);
        throw new Error(`Database error: ${updateError.message}`);
      }

      // Update local state
      setSessions(prev => 
        prev.map(session => 
          session.id === sessionId ? { ...session, ...updates } : session
        )
      );

      // Update current session if it's the one being updated
      if (currentSession?.id === sessionId) {
        setCurrentSession(prevSession => 
          prevSession ? { ...prevSession, ...updates } : null
        );
      }

      console.log(`Session ${sessionId} updated successfully`);
      return true;
    } catch (err) {
      const errorMessage = `Failed to update session: ${(err as Error).message}`;
      console.error(errorMessage);
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [currentSession, toast]);

  return {
    sessions,
    currentSession,
    setCurrentSession: setSessionById,
    getSessionByCode,
    fetchSessions,
    updateSession,
    isLoading,
    error
  };
}
