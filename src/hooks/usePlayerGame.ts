
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function usePlayerGame(playerCode?: string | null) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [autoMarking, setAutoMarking] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [winPrizes, setWinPrizes] = useState<{ [key: string]: string }>({});
  const [activeWinPatterns, setActiveWinPatterns] = useState<string[]>([]);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimStatus, setClaimStatus] = useState<'pending' | 'validated' | 'rejected' | undefined>(undefined);
  const { toast } = useToast();

  // Load player and session information
  useEffect(() => {
    // Exit early if no playerCode is provided yet
    // This prevents unnecessary data fetching when the playerCode is still null
    if (!playerCode) {
      return;
    }

    const fetchPlayerData = async () => {
      try {
        console.log("Joining session with player code:", playerCode);
        
        const { data: playerData, error: playerError } = await supabase
          .from('players')
          .select('id, nickname, session_id')
          .eq('player_code', playerCode)
          .single();

        if (playerError) {
          console.error("Error fetching player:", playerError);
          setErrorMessage('Player not found or invalid code');
          setIsLoading(false);
          return;
        }

        console.log("Player found:", playerData.nickname, "session:", playerData.session_id);
        setPlayerId(playerData.id);
        setPlayerName(playerData.nickname);
        setSessionId(playerData.session_id);

        // Fetch session data
        const { data: sessionData, error: sessionError } = await supabase
          .from('game_sessions')
          .select('*')
          .eq('id', playerData.session_id)
          .single();

        if (sessionError) {
          console.error("Error fetching session:", sessionError);
          setErrorMessage('Game session not found');
          setIsLoading(false);
          return;
        }

        setCurrentSession(sessionData);

        // Fetch win patterns for the session
        const { data: patternData, error: patternError } = await supabase
          .from('win_patterns')
          .select('*')
          .eq('session_id', playerData.session_id)
          .single();

        if (!patternError && patternData) {
          const patterns: string[] = [];
          const prizes: { [key: string]: string } = {};
          
          if (patternData.one_line_active) {
            patterns.push('oneLine');
            prizes['oneLine'] = patternData.one_line_prize || '';
          }
          
          if (patternData.two_lines_active) {
            patterns.push('twoLines');
            prizes['twoLines'] = patternData.two_lines_prize || '';
          }
          
          if (patternData.full_house_active) {
            patterns.push('fullHouse');
            prizes['fullHouse'] = patternData.full_house_prize || '';
          }
          
          setActiveWinPatterns(patterns);
          setWinPrizes(prizes);
        }

        // Fetch player's tickets
        const { data: ticketData, error: ticketError } = await supabase
          .from('assigned_tickets')
          .select('*')
          .eq('player_id', playerData.id)
          .eq('session_id', playerData.session_id);

        if (ticketError) {
          console.error("Error fetching tickets:", ticketError);
          setErrorMessage('Could not load your tickets');
          setIsLoading(false);
          return;
        }

        setTickets(ticketData || []);

        // Fetch called numbers for the session
        const { data: numberData, error: numberError } = await supabase
          .from('called_numbers')
          .select('number')
          .eq('session_id', playerData.session_id)
          .order('called_at', { ascending: true });

        if (numberError) {
          console.error("Error fetching called numbers:", numberError);
          setErrorMessage('Could not load called numbers');
          setIsLoading(false);
          return;
        }

        if (numberData && numberData.length > 0) {
          const numbers = numberData.map(item => item.number);
          setCalledNumbers(numbers);
          setCurrentNumber(numbers[numbers.length - 1]);
        }

        // Check if player has a pending claim
        const { data: claimData, error: claimError } = await supabase
          .from('bingo_claims')
          .select('status')
          .eq('player_id', playerData.id)
          .eq('session_id', playerData.session_id)
          .order('claimed_at', { ascending: false })
          .limit(1);

        if (!claimError && claimData && claimData.length > 0) {
          if (claimData[0].status === 'pending') {
            setIsClaiming(true);
            setClaimStatus('pending');
          } else if (claimData[0].status === 'validated') {
            setClaimStatus('validated');
          } else if (claimData[0].status === 'rejected') {
            setClaimStatus('rejected');
          }
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Error in fetchPlayerData:", error);
        setErrorMessage('Failed to load game data');
        setIsLoading(false);
      }
    };

    setIsLoading(true);
    fetchPlayerData();
  }, [playerCode]);

  // Set up realtime listeners for called numbers and claim responses
  useEffect(() => {
    if (!sessionId) return;

    // Listen for new called numbers
    const calledNumbersChannel = supabase
      .channel('called-numbers-for-player')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'called_numbers',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          if (payload.new) {
            const newNumber = payload.new.number;
            console.log("New number called:", newNumber);
            setCalledNumbers(prev => [...prev, newNumber]);
            setCurrentNumber(newNumber);
          }
        }
      )
      .subscribe();

    // Listen for claim result broadcasts
    const gameUpdatesChannel = supabase
      .channel('game-updates')
      .on(
        'broadcast',
        { event: 'claim-result' },
        (payload) => {
          console.log("Received claim result:", payload);
          
          if (payload.payload && payload.payload.playerId === playerId) {
            const result = payload.payload.result;
            
            if (result === 'valid') {
              setClaimStatus('validated');
              setIsClaiming(false);
              toast({
                title: "Win Verified!",
                description: "Your bingo win has been verified by the caller.",
                variant: "default"
              });
            } else if (result === 'rejected') {
              setClaimStatus('rejected');
              setIsClaiming(false);
              toast({
                title: "Claim Rejected",
                description: "Your bingo claim was not verified. Please continue playing.",
                variant: "destructive"
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(calledNumbersChannel);
      supabase.removeChannel(gameUpdatesChannel);
    };
  }, [sessionId, playerId, toast]);

  const handleClaimBingo = useCallback(async (): Promise<boolean> => {
    if (!playerId || !sessionId || !playerName) {
      toast({
        title: "Error",
        description: "Could not claim bingo. Player information is missing.",
        variant: "destructive"
      });
      return false;
    }

    try {
      setIsClaiming(true);
      setClaimStatus('pending');
      
      console.log("Broadcasting bingo claim");
      
      // Create claim record in database to track history
      const { data: claimData, error: claimError } = await supabase
        .from('bingo_claims')
        .insert({
          player_id: playerId,
          session_id: sessionId,
          status: 'pending'
        })
        .select('id')
        .single();
      
      if (claimError) {
        console.error("Error creating claim record:", claimError);
        throw new Error("Failed to save claim");
      }
      
      // Broadcast the claim to all callers using Supabase broadcast
      await supabase
        .channel('caller-claims')
        .send({
          type: 'broadcast',
          event: 'bingo-claim',
          payload: { 
            playerId, 
            playerName,
            sessionId,
            claimId: claimData?.id,
            timestamp: new Date().toISOString()
          }
        });
      
      toast({
        title: "Claim Submitted",
        description: "Your bingo claim is being verified by the caller.",
        variant: "default"
      });
      
      return true;
    } catch (error) {
      console.error("Error claiming bingo:", error);
      setIsClaiming(false);
      setClaimStatus(undefined);
      
      toast({
        title: "Error",
        description: "Failed to submit your bingo claim. Please try again.",
        variant: "destructive"
      });
      
      return false;
    }
  }, [playerId, sessionId, playerName, toast]);

  return {
    tickets,
    calledNumbers,
    currentNumber,
    currentSession,
    autoMarking,
    setAutoMarking,
    playerCode,
    winPrizes,
    activeWinPatterns,
    handleClaimBingo,
    isLoading,
    errorMessage,
    isClaiming,
    claimStatus
  };
}
