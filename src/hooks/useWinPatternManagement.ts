
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useWinPatternManagement(sessionId: string | undefined) {
  const [winPatterns, setWinPatterns] = useState<string[]>(["oneLine", "twoLines", "fullHouse"]);
  const [winPrizes, setWinPrizes] = useState<{ [key: string]: string }>({
    oneLine: "",
    twoLines: "",
    fullHouse: "",
  });
  const [currentGameWinPattern, setCurrentGameWinPattern] = useState<string | null>("oneLine");
  const { toast } = useToast();

  const progressWinPattern = () => {
    if (!currentGameWinPattern) return null;
    const patterns = ["oneLine", "twoLines", "fullHouse"];
    const currentIndex = patterns.indexOf(currentGameWinPattern);
    const nextPattern = patterns[currentIndex + 1];
    
    if (nextPattern && winPatterns.includes(nextPattern)) {
      setCurrentGameWinPattern(nextPattern);
      return nextPattern;
    }
    return null;
  };

  // Save win patterns and prizes to database
  const saveWinPatterns = async () => {
    if (!sessionId) return;

    try {
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

      const patternsData = {
        session_id: sessionId,
        one_line_active: winPatterns.includes("oneLine"),
        two_lines_active: winPatterns.includes("twoLines"),
        full_house_active: winPatterns.includes("fullHouse"),
        one_line_prize: winPrizes.oneLine || null,
        two_lines_prize: winPrizes.twoLines || null,
        full_house_prize: winPrizes.fullHouse || null
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
  };

  // Fetch win patterns from database
  useEffect(() => {
    const fetchWinPatterns = async () => {
      if (!sessionId) return;
      
      const { data, error } = await supabase
        .from('win_patterns')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching win patterns:", error);
        return;
      }

      if (data) {
        const activePatterns: string[] = [];
        const prizes: { [key: string]: string } = {};

        if (data.one_line_active) {
          activePatterns.push("oneLine");
          prizes.oneLine = data.one_line_prize || "";
        }
        if (data.two_lines_active) {
          activePatterns.push("twoLines");
          prizes.twoLines = data.two_lines_prize || "";
        }
        if (data.full_house_active) {
          activePatterns.push("fullHouse");
          prizes.fullHouse = data.full_house_prize || "";
        }

        setWinPatterns(activePatterns);
        setWinPrizes(prizes);
      }
    };

    fetchWinPatterns();
  }, [sessionId]);

  // Save changes when win patterns or prizes change
  useEffect(() => {
    if (sessionId) {
      saveWinPatterns();
    }
  }, [winPatterns, winPrizes, sessionId]);

  return {
    winPatterns,
    winPrizes,
    currentGameWinPattern,
    setCurrentGameWinPattern,
    progressWinPattern,
    setWinPatterns,
    setWinPrizes,
    saveWinPatterns
  };
}
