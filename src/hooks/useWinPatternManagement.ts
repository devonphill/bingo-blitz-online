
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getGameRulesForType } from '@/game-rules/gameRulesRegistry';

export interface WinPatternConfig {
  id: string;
  name: string;
  active: boolean;
  prize: string;
  order: number;
}

export function useWinPatternManagement(sessionId: string | undefined, gameType: string = '90-ball') {
  const [winPatterns, setWinPatterns] = useState<string[]>(["oneLine", "twoLines", "fullHouse"]);
  const [winPrizes, setWinPrizes] = useState<{ [key: string]: string }>({
    oneLine: "",
    twoLines: "",
    fullHouse: "",
  });
  const [winPatternConfigs, setWinPatternConfigs] = useState<WinPatternConfig[]>([]);
  const [currentGameWinPattern, setCurrentGameWinPattern] = useState<string | null>("oneLine");
  const { toast } = useToast();

  // Load the game rules based on game type
  const gameRules = getGameRulesForType(gameType);
  
  // Fetch win patterns for the specific game type
  const fetchWinPatternConfigs = useCallback(async () => {
    if (!sessionId) return;
    
    console.log("Fetching win pattern configs for session:", sessionId, "game type:", gameType);
    
    try {
      // First check if this session already has win patterns defined
      const { data: existingPatterns, error: fetchError } = await supabase
        .from('win_patterns')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();
      
      if (fetchError) {
        console.error("Error fetching win patterns:", fetchError);
        return;
      }
      
      // If we have patterns, convert them to our config format
      if (existingPatterns) {
        const configs: WinPatternConfig[] = [];
        const prizes: { [key: string]: string } = {};
        const activePatterns: string[] = [];
        
        // Process "one line" pattern
        if (existingPatterns.one_line_active) {
          configs.push({
            id: "oneLine",
            name: "One Line",
            active: true,
            prize: existingPatterns.one_line_prize || "",
            order: 1
          });
          prizes.oneLine = existingPatterns.one_line_prize || "";
          activePatterns.push("oneLine");
        }
        
        // Process "two lines" pattern
        if (existingPatterns.two_lines_active) {
          configs.push({
            id: "twoLines",
            name: "Two Lines",
            active: true,
            prize: existingPatterns.two_lines_prize || "",
            order: 2
          });
          prizes.twoLines = existingPatterns.two_lines_prize || "";
          activePatterns.push("twoLines");
        }
        
        // Process "full house" pattern
        if (existingPatterns.full_house_active) {
          configs.push({
            id: "fullHouse",
            name: "Full House",
            active: true,
            prize: existingPatterns.full_house_prize || "",
            order: 3
          });
          prizes.fullHouse = existingPatterns.full_house_prize || "";
          activePatterns.push("fullHouse");
        }
        
        // Update state
        setWinPatternConfigs(configs);
        setWinPrizes(prizes);
        setWinPatterns(activePatterns);
        
        // Set current game win pattern to the first active pattern if not set already
        if (activePatterns.length > 0 && !currentGameWinPattern) {
          const sortedPatterns = [...configs].sort((a, b) => a.order - b.order);
          const firstActive = sortedPatterns.find(p => p.active);
          if (firstActive) {
            setCurrentGameWinPattern(firstActive.id);
          }
        }
        
        console.log("Loaded win patterns from DB:", configs);
      } else {
        // No patterns exist yet for this session, use default patterns from game rules
        console.log("No existing win patterns found, using defaults from game rules");
        const defaultConfigs = gameRules.getDefaultWinPatterns();
        setWinPatternConfigs(defaultConfigs);
        
        // Convert to prizes and active patterns for backwards compatibility
        const prizes: { [key: string]: string } = {};
        const activePatterns: string[] = [];
        
        defaultConfigs.forEach(config => {
          if (config.active) {
            prizes[config.id] = config.prize;
            activePatterns.push(config.id);
          }
        });
        
        setWinPrizes(prizes);
        setWinPatterns(activePatterns);
        
        // Set current win pattern to first active pattern
        const sortedPatterns = [...defaultConfigs].sort((a, b) => a.order - b.order);
        const firstActive = sortedPatterns.find(p => p.active);
        if (firstActive) {
          setCurrentGameWinPattern(firstActive.id);
        }
      }
    } catch (error) {
      console.error("Exception fetching win patterns:", error);
    }
  }, [sessionId, gameType, gameRules, currentGameWinPattern]);

  // Initialize win patterns
  useEffect(() => {
    fetchWinPatternConfigs();
  }, [fetchWinPatternConfigs]);

  // Progress to the next win pattern
  const progressWinPattern = useCallback(() => {
    if (!currentGameWinPattern) return null;
    
    // Sort win pattern configs by order
    const sortedPatterns = [...winPatternConfigs]
      .filter(pattern => pattern.active)
      .sort((a, b) => a.order - b.order);
    
    const currentIndex = sortedPatterns.findIndex(pattern => pattern.id === currentGameWinPattern);
    
    // Find the next pattern after the current one
    const nextPattern = currentIndex < sortedPatterns.length - 1 
      ? sortedPatterns[currentIndex + 1] 
      : null;
    
    if (nextPattern) {
      console.log(`Progressing from ${currentGameWinPattern} to ${nextPattern.id}`);
      setCurrentGameWinPattern(nextPattern.id);
      
      // Notify players about win pattern change
      if (sessionId) {
        supabase.channel('game-updates').send({
          type: 'broadcast',
          event: 'win-pattern-change',
          payload: {
            previousPattern: currentGameWinPattern,
            newPattern: nextPattern.id,
            sessionId
          }
        });
        
        toast({
          title: "Win Pattern Updated",
          description: `The win pattern has been updated to ${nextPattern.name}`,
        });
      }
      
      return nextPattern.id;
    }
    
    console.log("No next pattern available - this was the last pattern");
    return null;
  }, [currentGameWinPattern, winPatternConfigs, sessionId, toast]);

  // Update win pattern config
  const updateWinPatternConfig = useCallback((patternId: string, updates: Partial<WinPatternConfig>) => {
    setWinPatternConfigs(prev => {
      const updated = prev.map(pattern => 
        pattern.id === patternId ? { ...pattern, ...updates } : pattern
      );
      
      // If we're updating prizes, also update winPrizes for backward compatibility
      if (updates.prize !== undefined) {
        setWinPrizes(prev => ({ ...prev, [patternId]: updates.prize || "" }));
      }
      
      // If we're updating active state, also update winPatterns for backward compatibility
      if (updates.active !== undefined) {
        setWinPatterns(prev => {
          if (updates.active) {
            return prev.includes(patternId) ? prev : [...prev, patternId];
          } else {
            return prev.filter(id => id !== patternId);
          }
        });
      }
      
      return updated;
    });
  }, []);

  // Toggle pattern active state
  const togglePatternActive = useCallback((patternId: string) => {
    setWinPatternConfigs(prev => {
      const pattern = prev.find(p => p.id === patternId);
      if (!pattern) return prev;
      
      const newActive = !pattern.active;
      
      // Update winPatterns array for backward compatibility
      if (newActive) {
        setWinPatterns(prev => prev.includes(patternId) ? prev : [...prev, patternId]);
      } else {
        setWinPatterns(prev => prev.filter(id => id !== patternId));
      }
      
      return prev.map(p => 
        p.id === patternId ? { ...p, active: newActive } : p
      );
    });
  }, []);

  // Update prize value
  const updatePrizeValue = useCallback((patternId: string, value: string) => {
    // Update both prize in config and winPrizes for backward compatibility
    updateWinPatternConfig(patternId, { prize: value });
    setWinPrizes(prev => ({ ...prev, [patternId]: value }));
  }, [updateWinPatternConfig]);

  // Save win patterns to database
  const saveWinPatterns = useCallback(async () => {
    if (!sessionId) return;

    try {
      console.log("Saving win patterns:", winPatternConfigs);
      
      // First check if patterns already exist for this session
      const { data: existingData, error: checkError } = await supabase
        .from('win_patterns')
        .select('id')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (checkError) {
        console.error("Error checking for existing win patterns:", checkError);
        return;
      }

      // Convert our configs back to the database format
      const oneLineConfig = winPatternConfigs.find(p => p.id === "oneLine");
      const twoLinesConfig = winPatternConfigs.find(p => p.id === "twoLines");
      const fullHouseConfig = winPatternConfigs.find(p => p.id === "fullHouse");
      
      const patternsData = {
        session_id: sessionId,
        one_line_active: oneLineConfig?.active || false,
        two_lines_active: twoLinesConfig?.active || false,
        full_house_active: fullHouseConfig?.active || false,
        one_line_prize: oneLineConfig?.prize || null,
        two_lines_prize: twoLinesConfig?.prize || null,
        full_house_prize: fullHouseConfig?.prize || null
      };

      let error;
      
      if (existingData) {
        // Update existing patterns
        const { error: updateError } = await supabase
          .from('win_patterns')
          .update(patternsData)
          .eq('session_id', sessionId);
        
        error = updateError;
      } else {
        // Insert new patterns
        const { error: insertError } = await supabase
          .from('win_patterns')
          .insert([patternsData]);
        
        error = insertError;
      }

      if (error) {
        console.error("Error saving win patterns:", error);
        toast({
          title: "Error",
          description: "Failed to save win patterns.",
          variant: "destructive"
        });
      } else {
        console.log("Win patterns saved successfully");
      }
    } catch (error) {
      console.error("Exception saving win patterns:", error);
    }
  }, [sessionId, winPatternConfigs, toast]);

  // Save changes when win patterns or prizes change
  useEffect(() => {
    if (sessionId && winPatternConfigs.length > 0) {
      console.log("Scheduling save of win patterns:", winPatternConfigs);
      const timeoutId = setTimeout(() => {
        saveWinPatterns();
      }, 500); // Debounce saves
      
      return () => clearTimeout(timeoutId);
    }
  }, [winPatternConfigs, sessionId, saveWinPatterns]);

  // Validate a win claim based on the current pattern
  const validateWinClaim = useCallback((ticket: any, calledNumbers: number[]) => {
    if (!currentGameWinPattern || !gameRules) return false;
    
    return gameRules.validateWin(currentGameWinPattern, ticket, calledNumbers);
  }, [currentGameWinPattern, gameRules]);

  return {
    winPatterns,
    winPrizes,
    winPatternConfigs,
    currentGameWinPattern,
    setCurrentGameWinPattern,
    progressWinPattern,
    setWinPatterns,
    setWinPrizes,
    saveWinPatterns,
    togglePatternActive,
    updatePrizeValue,
    updateWinPatternConfig,
    validateWinClaim
  };
}
